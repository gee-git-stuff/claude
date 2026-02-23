import robin_stocks.robinhood as rh
from config import ROBINHOOD_USERNAME, ROBINHOOD_PASSWORD

_logged_in = False


def _login():
    global _logged_in
    if not _logged_in:
        rh.login(ROBINHOOD_USERNAME, ROBINHOOD_PASSWORD)
        _logged_in = True


def get_portfolio() -> dict:
    """Get current Robinhood portfolio summary."""
    _login()
    profile = rh.load_portfolio_profile()
    return {
        "equity": profile.get("equity"),
        "extended_hours_equity": profile.get("extended_hours_equity"),
        "market_value": profile.get("market_value"),
        "excess_margin": profile.get("excess_margin"),
        "withdrawable_amount": profile.get("withdrawable_amount"),
    }


def get_positions() -> list:
    """Get current open stock positions."""
    _login()
    positions = rh.get_open_stock_positions()
    result = []
    for pos in positions:
        instrument = rh.get_instrument_by_url(pos.get("instrument"))
        result.append({
            "symbol": instrument.get("symbol"),
            "quantity": pos.get("quantity"),
            "average_buy_price": pos.get("average_buy_price"),
        })
    return result


def get_account_info() -> dict:
    """Get account info including buying power and cash balances."""
    _login()
    info = rh.load_account_profile()
    return {
        "buying_power": info.get("buying_power"),
        "cash": info.get("cash"),
        "cash_available_for_withdrawal": info.get("cash_available_for_withdrawal"),
        "unsettled_funds": info.get("unsettled_funds"),
    }


def buy_stock(symbol: str, quantity: float) -> dict:
    """Place a market buy order."""
    _login()
    order = rh.order_buy_market(symbol.upper(), quantity)
    return {
        "id": order.get("id"),
        "symbol": symbol.upper(),
        "quantity": quantity,
        "state": order.get("state"),
        "type": "buy",
    }


def sell_stock(symbol: str, quantity: float) -> dict:
    """Place a market sell order."""
    _login()
    order = rh.order_sell_market(symbol.upper(), quantity)
    return {
        "id": order.get("id"),
        "symbol": symbol.upper(),
        "quantity": quantity,
        "state": order.get("state"),
        "type": "sell",
    }
