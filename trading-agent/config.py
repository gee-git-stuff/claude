import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ROBINHOOD_USERNAME = os.getenv("ROBINHOOD_USERNAME")
ROBINHOOD_PASSWORD = os.getenv("ROBINHOOD_PASSWORD")

STRATEGIES_DIR = os.path.join(os.path.dirname(__file__), "data", "strategies")

MODEL = "claude-opus-4-6"
MAX_TOKENS = 8096
