import json
import anthropic
from config import ANTHROPIC_API_KEY, MODEL, MAX_TOKENS
from tools import market_data, news, knowledge_base, robinhood

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

TOOLS = [
    {
        "name": "get_stock_price",
        "description": "Get the current price and basic market data for a stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Stock ticker symbol, e.g. AAPL"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_stock_history",
        "description": "Get historical OHLCV price data for a stock.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Stock ticker symbol"},
                "period": {
                    "type": "string",
                    "description": "Time period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y",
                    "default": "1mo",
                },
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_stock_info",
        "description": "Get detailed company fundamentals, sector, analyst ratings, and price targets.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Stock ticker symbol"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_market_news",
        "description": "Fetch the latest market news from major financial RSS feeds.",
        "input_schema": {
            "type": "object",
            "properties": {
                "max_items": {
                    "type": "integer",
                    "description": "Max number of articles to return (default 10)",
                    "default": 10,
                },
            },
        },
    },
    {
        "name": "search_news",
        "description": "Search for recent news articles about a specific stock or topic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query, e.g. 'AAPL earnings'"},
                "max_items": {
                    "type": "integer",
                    "description": "Max number of articles to return (default 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_strategies",
        "description": "List available trading strategy documents stored in the knowledge base.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_strategy",
        "description": "Read a trading strategy document from the knowledge base.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Filename of the strategy, e.g. 'momentum.md'",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "get_portfolio",
        "description": "Get the current Robinhood portfolio summary (equity, market value, etc.).",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_positions",
        "description": "Get all currently open stock positions from Robinhood.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_account_info",
        "description": "Get Robinhood account info including buying power and cash balances.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "buy_stock",
        "description": "Place a market buy order on Robinhood. Only call this after the user explicitly confirms.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Stock ticker symbol"},
                "quantity": {"type": "number", "description": "Number of shares to buy"},
            },
            "required": ["symbol", "quantity"],
        },
    },
    {
        "name": "sell_stock",
        "description": "Place a market sell order on Robinhood. Only call this after the user explicitly confirms.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Stock ticker symbol"},
                "quantity": {"type": "number", "description": "Number of shares to sell"},
            },
            "required": ["symbol", "quantity"],
        },
    },
]

TOOL_MAP = {
    "get_stock_price": market_data.get_stock_price,
    "get_stock_history": market_data.get_stock_history,
    "get_stock_info": market_data.get_stock_info,
    "get_market_news": news.get_market_news,
    "search_news": news.search_news,
    "list_strategies": knowledge_base.list_strategies,
    "get_strategy": knowledge_base.get_strategy,
    "get_portfolio": robinhood.get_portfolio,
    "get_positions": robinhood.get_positions,
    "get_account_info": robinhood.get_account_info,
    "buy_stock": robinhood.buy_stock,
    "sell_stock": robinhood.sell_stock,
}

SYSTEM_PROMPT = """You are an intelligent stock trading assistant with access to real-time market \
data, financial news, a knowledge base of trading strategies, and a live Robinhood brokerage account.

You can:
- Look up stock prices, historical data, and company fundamentals
- Fetch and summarize the latest market news
- Search for news about specific stocks or topics
- Read trading strategies from the knowledge base
- View the user's portfolio, positions, and account info
- Execute buy and sell market orders on Robinhood

Critical rules:
- NEVER place a buy or sell order unless the user has explicitly confirmed the trade in their message.
- When a user asks to trade, first summarize the intended action (symbol, quantity, estimated cost) \
and ask them to confirm before executing.
- Always cite specific data (prices, percentages, dates) when giving analysis or recommendations.
- Be concise and direct."""


def run_agent(user_message: str) -> str:
    """Run the agentic loop for a single user message and return the final text response."""
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return ""

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    fn = TOOL_MAP.get(block.name)
                    try:
                        result = fn(**block.input) if fn else {"error": f"Unknown tool: {block.name}"}
                    except Exception as e:
                        result = {"error": str(e)}
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })
            messages.append({"role": "user", "content": tool_results})
        else:
            break

    return "Agent stopped unexpectedly."
