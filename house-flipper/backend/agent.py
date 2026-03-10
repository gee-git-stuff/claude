"""
House Flipper AI Agent powered by Claude Opus 4.6 with tool use.
Tools give the agent access to calculations, property data, and documents.
"""
import json
import anthropic
from calculator import (
    calculate_roi,
    estimate_closing_costs,
    estimate_repair_costs,
    analyze_deal_summary,
)
import database as db

MODEL = "claude-opus-4-6"

SYSTEM_PROMPT = """You are FlipperAI, an expert house-flipping and real estate investment advisor. You combine deep knowledge of:

**Home Buying & Investing**
- The full home purchase process: offer, inspection, appraisal, title, escrow, closing
- Financing options: conventional, FHA, hard money, DSCR, HELOC, seller financing
- Closing costs, title fees, transfer taxes, prepaid items by state
- The 70% rule, ARV calculation, comps analysis
- Cash-on-cash return, cap rate, ROI, annualized return metrics

**House Flipping Strategy**
- Deal sourcing: MLS, off-market, wholesalers, auctions, direct mail, driving for dollars
- Scope of work: prioritizing cosmetic vs. structural repairs for max ROI
- Contractor management: getting bids, vetting subs, draw schedules, lien waivers
- Timeline planning and carrying cost management
- Exit strategies: retail flip, BRRRR, wholesale, seller finance

**Repair & Renovation**
- National average repair costs per trade (roofing, HVAC, kitchen, bath, flooring, etc.)
- Common inspection findings and their cost to remediate
- Permit requirements and what triggers them
- Signs of foundation, water, electrical, and structural issues

**Document Analysis**
- Interpreting purchase agreements, addenda, inspection reports
- Reading contractor proposals, scopes of work, draw schedules
- Analyzing settlement statements (HUD-1, ALTA), title commitments
- Reviewing lease agreements for rental properties

**Your Behavior**
- Always use the calculation tools when numbers are involved — don't guess
- When a user uploads a document, use the analyze_document tool to reference its content
- Ask clarifying questions when key numbers (ARV, repair estimate, purchase price) are missing
- Be direct with recommendations: clearly flag bad deals and explain why
- Cite the 70% rule, cash-on-cash benchmarks, and other investor heuristics when relevant
- Format financial summaries as clear tables when possible
- You can access stored property data and documents using the provided tools

Today's date and market context: Real estate markets vary by location. Always recommend users verify ARV with recent comparable sales (within 0.5 miles, similar sqft, sold within 90 days).
"""

TOOLS = [
    {
        "name": "calculate_roi",
        "description": "Calculate return on investment, profit, and key metrics for a flip deal. Use this whenever the user asks about profitability, ROI, or whether a deal 'pencils out'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "purchase_price": {"type": "number", "description": "Purchase price of the property in dollars"},
                "repair_costs": {"type": "number", "description": "Total estimated repair/renovation costs in dollars"},
                "arv": {"type": "number", "description": "After Repair Value — the estimated resale price after renovation"},
                "holding_months": {"type": "integer", "description": "Number of months you expect to hold the property (default 6)"},
                "monthly_holding_cost": {"type": "number", "description": "Monthly carrying costs: taxes + insurance + utilities + loan interest (default 1500)"},
                "selling_costs_pct": {"type": "number", "description": "Selling costs as decimal — agent commissions + transfer taxes, typically 0.06 (default 0.06)"},
                "financing_costs": {"type": "number", "description": "Total financing costs: points, origination fees (default 0)"},
            },
            "required": ["purchase_price", "repair_costs", "arv"],
        },
    },
    {
        "name": "estimate_closing_costs",
        "description": "Estimate buyer or seller closing costs for a transaction. Use when the user asks about closing costs, fees, or wants a full cost breakdown.",
        "input_schema": {
            "type": "object",
            "properties": {
                "purchase_price": {"type": "number", "description": "Purchase/sale price of the property"},
                "state": {"type": "string", "description": "Two-letter state abbreviation (e.g., 'CA', 'TX', 'NY') or 'general'"},
                "is_buyer": {"type": "boolean", "description": "True for buyer closing costs, False for seller closing costs"},
                "loan_amount": {"type": "number", "description": "Loan amount if financing (0 for cash purchase)"},
            },
            "required": ["purchase_price"],
        },
    },
    {
        "name": "estimate_repair_costs",
        "description": "Estimate repair/renovation costs based on scope of work. Use when user asks about repair budgets or renovation costs.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sqft": {"type": "number", "description": "Square footage of the property"},
                "roof": {"type": "boolean", "description": "True if roof replacement needed"},
                "hvac": {"type": "boolean", "description": "True if HVAC replacement needed"},
                "kitchen": {"type": "string", "description": "Kitchen remodel level: 'light' (paint/hardware), 'mid' (cabinets/counters), 'full' (gut remodel)"},
                "bathrooms": {"type": "integer", "description": "Number of bathrooms to remodel"},
                "flooring": {"type": "boolean", "description": "True if new flooring throughout"},
                "paint": {"type": "boolean", "description": "True if interior paint needed"},
                "windows": {"type": "boolean", "description": "True if window replacements needed"},
                "window_count": {"type": "integer", "description": "Number of windows to replace"},
                "electrical": {"type": "boolean", "description": "True if electrical update/panel upgrade needed"},
                "plumbing": {"type": "boolean", "description": "True if plumbing update needed"},
                "foundation": {"type": "boolean", "description": "True if foundation repair needed"},
                "landscaping": {"type": "boolean", "description": "True if landscaping/curb appeal work needed"},
            },
            "required": ["sqft"],
        },
    },
    {
        "name": "analyze_deal",
        "description": "Run a comprehensive deal analysis scorecard combining ROI, closing costs, and a letter-grade recommendation. Best for a full deal overview.",
        "input_schema": {
            "type": "object",
            "properties": {
                "purchase_price": {"type": "number", "description": "Purchase price"},
                "repair_costs": {"type": "number", "description": "Total repair costs"},
                "arv": {"type": "number", "description": "After Repair Value"},
                "holding_months": {"type": "integer", "description": "Months to hold (default 6)"},
                "monthly_holding_cost": {"type": "number", "description": "Monthly carrying cost (default 1500)"},
                "loan_amount": {"type": "number", "description": "Loan amount if using financing (0 = all cash)"},
            },
            "required": ["purchase_price", "repair_costs", "arv"],
        },
    },
    {
        "name": "get_property",
        "description": "Retrieve stored property data from the database. Use when the user mentions a specific property they've saved.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "integer", "description": "The numeric ID of the property"},
            },
            "required": ["property_id"],
        },
    },
    {
        "name": "list_properties",
        "description": "List all saved properties in the database. Use when the user asks 'what properties do I have' or wants to see their deal pipeline.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_documents",
        "description": "Retrieve uploaded documents for a property or all documents. Use when the user asks about documents, contracts, or uploaded files.",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "integer", "description": "Property ID to filter by, or omit for all documents"},
            },
            "required": [],
        },
    },
    {
        "name": "get_document_content",
        "description": "Get the full extracted text and summary of a specific uploaded document. Use when the user wants you to analyze or reference a specific document.",
        "input_schema": {
            "type": "object",
            "properties": {
                "document_id": {"type": "integer", "description": "The numeric ID of the document"},
            },
            "required": ["document_id"],
        },
    },
]


async def run_tool(tool_name: str, tool_input: dict) -> str:
    """Execute a tool call and return the result as a JSON string."""
    try:
        if tool_name == "calculate_roi":
            result = calculate_roi(**tool_input)
        elif tool_name == "estimate_closing_costs":
            result = estimate_closing_costs(**tool_input)
        elif tool_name == "estimate_repair_costs":
            result = estimate_repair_costs(tool_input)
        elif tool_name == "analyze_deal":
            result = analyze_deal_summary(tool_input)
        elif tool_name == "get_property":
            result = await db.get_property(tool_input["property_id"])
            if not result:
                result = {"error": f"Property {tool_input['property_id']} not found"}
        elif tool_name == "list_properties":
            result = await db.list_properties()
        elif tool_name == "get_documents":
            property_id = tool_input.get("property_id")
            result = await db.get_documents(property_id)
        elif tool_name == "get_document_content":
            doc = await db.get_document(tool_input["document_id"])
            if doc:
                result = {
                    "filename": doc["filename"],
                    "doc_type": doc["doc_type"],
                    "summary": doc["summary"],
                    "extracted_text": doc["extracted_text"][:8000] if doc["extracted_text"] else "",
                    "text_truncated": len(doc.get("extracted_text") or "") > 8000,
                }
            else:
                result = {"error": f"Document {tool_input['document_id']} not found"}
        else:
            result = {"error": f"Unknown tool: {tool_name}"}

        return json.dumps(result, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


async def chat(
    messages_history: list[dict],
    user_message: str,
    document_context: str = "",
) -> tuple[str, list[dict]]:
    """
    Send a message to the agent and get a response.
    Returns (assistant_text, updated_messages_history).

    messages_history: list of {"role": "user"|"assistant", "content": str}
    document_context: optional text from recently uploaded documents to inject
    """
    client = anthropic.Anthropic()

    # Build the user message content
    user_content = user_message
    if document_context:
        user_content = f"{user_message}\n\n[Recently uploaded document content:]\n{document_context}"

    # Add new user message to history
    messages = list(messages_history) + [{"role": "user", "content": user_content}]

    # Agentic loop — run until end_turn
    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            # Extract text from content blocks (skip thinking blocks)
            text_parts = [
                block.text for block in response.content
                if hasattr(block, "text")
            ]
            assistant_text = "".join(text_parts)

            # Append assistant turn to history (store only text for simplicity)
            messages.append({"role": "assistant", "content": assistant_text})
            return assistant_text, messages

        elif response.stop_reason == "tool_use":
            # Execute all tool calls
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result_str = await run_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                    })

            # Append assistant response (with tool_use blocks) then tool results
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        else:
            # Unexpected stop reason
            break

    return "I encountered an unexpected error. Please try again.", messages_history
