"""
Document ingestion: extract text from PDFs and plain text files,
generate a short AI summary via Claude.
"""
import os
import re
import anthropic
import pdfplumber

UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
)

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".csv"}


def extract_text(file_path: str) -> str:
    """Extract raw text from a file. Returns empty string on failure."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext in {".txt", ".md", ".csv"}:
        return _extract_text_file(file_path)
    return ""


def _extract_pdf(file_path: str) -> str:
    try:
        pages = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
        return "\n\n".join(pages)
    except Exception as e:
        return f"[PDF extraction error: {e}]"


def _extract_text_file(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"[Text extraction error: {e}]"


def classify_document(filename: str, text_sample: str) -> str:
    """
    Heuristically classify a document type from filename and first 500 chars.
    Returns a label like 'purchase_agreement', 'inspection_report', etc.
    """
    name_lower = filename.lower()
    text_lower = text_sample[:500].lower()

    patterns = {
        "purchase_agreement": ["purchase agreement", "sales contract", "purchase contract", "offer to purchase"],
        "inspection_report": ["inspection report", "home inspection", "property inspection"],
        "contractor_bid": ["proposal", "estimate", "scope of work", "contractor", "bid"],
        "appraisal": ["appraisal report", "market analysis", "appraised value"],
        "settlement_statement": ["settlement statement", "hud-1", "alta", "closing disclosure", "cd form"],
        "title_commitment": ["title commitment", "title insurance", "schedule a", "schedule b"],
        "lease_agreement": ["lease agreement", "rental agreement", "tenancy"],
        "permit": ["building permit", "permit application"],
        "insurance": ["homeowner", "insurance policy", "declarations page"],
    }

    for doc_type, keywords in patterns.items():
        if any(kw in name_lower or kw in text_lower for kw in keywords):
            return doc_type

    return "general"


async def summarize_document(filename: str, extracted_text: str) -> str:
    """Generate a concise AI summary of the document using Claude Haiku (fast + cheap)."""
    if not extracted_text or len(extracted_text.strip()) < 50:
        return "Document appears to be empty or could not be parsed."

    client = anthropic.Anthropic()
    # Truncate to avoid excessive tokens
    text_sample = extracted_text[:12000]

    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"You are a real estate document analyst. Summarize the key information "
                        f"from this document in 3-5 bullet points. Focus on: parties involved, "
                        f"key financial figures, dates, property address, and any important terms "
                        f"or contingencies.\n\nFilename: {filename}\n\nDocument:\n{text_sample}"
                    ),
                }
            ],
        )
        return response.content[0].text
    except Exception as e:
        return f"Summary unavailable: {e}"


def save_upload(filename: str, file_bytes: bytes) -> str:
    """
    Save uploaded file bytes to disk. Returns the saved file path.
    Sanitizes filename to prevent path traversal.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Sanitize: keep only safe characters
    safe_name = re.sub(r"[^\w.\-]", "_", os.path.basename(filename))
    if not safe_name or safe_name in (".", ".."):
        safe_name = "upload"

    # Avoid collisions with a simple counter suffix
    base, ext = os.path.splitext(safe_name)
    target = os.path.join(UPLOAD_DIR, safe_name)
    counter = 1
    while os.path.exists(target):
        target = os.path.join(UPLOAD_DIR, f"{base}_{counter}{ext}")
        counter += 1

    with open(target, "wb") as f:
        f.write(file_bytes)

    return target
