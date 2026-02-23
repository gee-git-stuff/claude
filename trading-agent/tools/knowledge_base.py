import os
from config import STRATEGIES_DIR


def list_strategies() -> list:
    """List available trading strategy files in the knowledge base."""
    os.makedirs(STRATEGIES_DIR, exist_ok=True)
    return [f for f in os.listdir(STRATEGIES_DIR) if f.endswith((".md", ".txt"))]


def get_strategy(name: str) -> dict:
    """Read a trading strategy document by filename."""
    path = os.path.join(STRATEGIES_DIR, name)
    if not os.path.exists(path):
        return {"error": f"Strategy '{name}' not found. Use list_strategies to see available files."}
    with open(path) as f:
        return {"name": name, "content": f.read()}
