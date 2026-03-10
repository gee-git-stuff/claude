"""
House Flipper Helper — FastAPI backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Try multiple encodings — Windows PowerShell often saves .env as UTF-16
for _enc in ('utf-8-sig', 'utf-16', 'utf-8'):
    try:
        load_dotenv(encoding=_enc)
        break
    except (UnicodeDecodeError, Exception):
        continue

import database as db
import agent
import document_handler as doc_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    yield


app = FastAPI(title="House Flipper Helper", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic models ---

class PropertyCreate(BaseModel):
    name: str
    address: Optional[str] = None
    status: Optional[str] = "analyzing"
    purchase_price: Optional[float] = None
    repair_costs: Optional[float] = None
    arv: Optional[float] = None
    holding_months: Optional[int] = 6
    monthly_holding_cost: Optional[float] = 1500
    loan_amount: Optional[float] = 0
    notes: Optional[str] = None

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    purchase_price: Optional[float] = None
    repair_costs: Optional[float] = None
    arv: Optional[float] = None
    holding_months: Optional[int] = None
    monthly_holding_cost: Optional[float] = None
    loan_amount: Optional[float] = None
    notes: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    property_id: Optional[int] = None

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"
    property_id: Optional[int] = None


# --- Properties API ---

@app.get("/api/properties")
async def list_properties():
    return await db.list_properties()

@app.post("/api/properties", status_code=201)
async def create_property(data: PropertyCreate):
    return await db.create_property(data.model_dump())

@app.get("/api/properties/{property_id}")
async def get_property(property_id: int):
    prop = await db.get_property(property_id)
    if not prop:
        raise HTTPException(404, "Property not found")
    return prop

@app.patch("/api/properties/{property_id}")
async def update_property(property_id: int, data: PropertyUpdate):
    prop = await db.get_property(property_id)
    if not prop:
        raise HTTPException(404, "Property not found")
    return await db.update_property(property_id, data.model_dump(exclude_none=True))

@app.delete("/api/properties/{property_id}", status_code=204)
async def delete_property(property_id: int):
    prop = await db.get_property(property_id)
    if not prop:
        raise HTTPException(404, "Property not found")
    await db.delete_property(property_id)


# --- Documents API ---

@app.post("/api/documents", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    property_id: Optional[int] = Form(None),
    doc_type: Optional[str] = Form(None),
):
    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(413, "File too large. Maximum size is 50 MB.")

    file_path = doc_handler.save_upload(file.filename, file_bytes)
    extracted = doc_handler.extract_text(file_path)

    # Auto-classify if not provided
    if not doc_type:
        doc_type = doc_handler.classify_document(file.filename, extracted)

    # Generate AI summary (async)
    summary = await doc_handler.summarize_document(file.filename, extracted)

    saved = await db.save_document(
        property_id=property_id,
        filename=file.filename,
        file_path=file_path,
        doc_type=doc_type,
        extracted_text=extracted,
        summary=summary,
    )
    # Don't return extracted_text in list responses (too large)
    saved.pop("extracted_text", None)
    return saved

@app.get("/api/documents")
async def list_documents(property_id: Optional[int] = None):
    docs = await db.get_documents(property_id)
    # Strip extracted text from list view
    for d in docs:
        d.pop("extracted_text", None)
    return docs

@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: int):
    doc = await db.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


# --- Conversations & Chat API ---

@app.get("/api/conversations")
async def list_conversations(property_id: Optional[int] = None):
    return await db.list_conversations(property_id)

@app.post("/api/conversations", status_code=201)
async def create_conversation(data: ConversationCreate):
    return await db.create_conversation(data.property_id, data.title)

@app.get("/api/conversations/{conv_id}/messages")
async def get_messages(conv_id: int):
    conv = await db.get_conversation(conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return await db.get_messages(conv_id)

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Main chat endpoint. Creates a conversation if needed, then calls the agent.
    """
    # Get or create conversation
    if request.conversation_id:
        conv = await db.get_conversation(request.conversation_id)
        if not conv:
            raise HTTPException(404, "Conversation not found")
        conv_id = request.conversation_id
    else:
        conv = await db.create_conversation(
            property_id=request.property_id,
            title=request.message[:60],
        )
        conv_id = conv["id"]

    # Load message history
    history_rows = await db.get_messages(conv_id)
    # Filter to only user/assistant messages (skip system)
    messages_history = [
        {"role": row["role"], "content": row["content"]}
        for row in history_rows
        if row["role"] in ("user", "assistant")
    ]

    # If a property is linked, inject its data as context
    doc_context = ""
    if request.property_id:
        prop = await db.get_property(request.property_id)
        if prop:
            doc_context = f"Context: The user is asking about property '{prop['name']}' at {prop.get('address', 'unknown address')}. "
            if prop.get("purchase_price"):
                doc_context += f"Purchase price: ${prop['purchase_price']:,.0f}. "
            if prop.get("arv"):
                doc_context += f"ARV: ${prop['arv']:,.0f}. "
            if prop.get("repair_costs"):
                doc_context += f"Repair costs: ${prop['repair_costs']:,.0f}."

    # Run the agent
    response_text, _ = await agent.chat(
        messages_history=messages_history,
        user_message=request.message,
        document_context=doc_context,
    )

    # Persist messages
    await db.add_message(conv_id, "user", request.message)
    await db.add_message(conv_id, "assistant", response_text)

    return {
        "conversation_id": conv_id,
        "message": response_text,
    }


# --- Quick Calculator APIs (no AI, instant) ---

@app.post("/api/calculate/roi")
async def calc_roi(data: dict):
    from calculator import calculate_roi
    try:
        return calculate_roi(**{k: v for k, v in data.items() if v is not None})
    except TypeError as e:
        raise HTTPException(400, str(e))

@app.post("/api/calculate/closing-costs")
async def calc_closing(data: dict):
    from calculator import estimate_closing_costs
    try:
        return estimate_closing_costs(**{k: v for k, v in data.items() if v is not None})
    except TypeError as e:
        raise HTTPException(400, str(e))

@app.post("/api/calculate/repairs")
async def calc_repairs(data: dict):
    from calculator import estimate_repair_costs
    return estimate_repair_costs(data)

@app.post("/api/calculate/deal")
async def calc_deal(data: dict):
    from calculator import analyze_deal_summary
    return analyze_deal_summary(data)


# --- Static frontend ---

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
