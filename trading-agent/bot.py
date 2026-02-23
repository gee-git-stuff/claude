import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from config import TELEGRAM_BOT_TOKEN
from agent import run_agent

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

HELP_TEXT = (
    "I'm your AI stock trading assistant powered by Claude.\n\n"
    "*What I can do:*\n"
    "• Look up stock prices and fundamentals\n"
    "• Fetch market news and search by ticker\n"
    "• View your Robinhood portfolio and positions\n"
    "• Place buy/sell orders (with your confirmation)\n"
    "• Read trading strategies from your knowledge base\n\n"
    "*Example messages:*\n"
    "• What's the price of TSLA?\n"
    "• Show me my portfolio\n"
    "• What's in the news about NVDA?\n"
    "• Analyze AAPL using the momentum strategy\n"
    "• Buy 2 shares of MSFT"
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT, parse_mode="Markdown")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT, parse_mode="Markdown")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    logger.info("User [%s]: %s", update.effective_user.id, user_text)

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    try:
        reply = run_agent(user_text)
    except Exception as e:
        logger.exception("Agent error")
        reply = f"Sorry, something went wrong: {e}"

    logger.info("Agent reply (%d chars)", len(reply))
    # Telegram has a 4096 char message limit
    for i in range(0, len(reply), 4096):
        await update.message.reply_text(reply[i:i + 4096])


def run_bot():
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    logger.info("Bot is running...")
    app.run_polling()
