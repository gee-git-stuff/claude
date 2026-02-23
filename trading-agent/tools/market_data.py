import yfinance as yf


def get_stock_price(symbol: str) -> dict:
    """Get current price and basic market data for a stock."""
    ticker = yf.Ticker(symbol.upper())
    info = ticker.fast_info
    prev = info.previous_close or 1
    return {
        "symbol": symbol.upper(),
        "price": round(info.last_price, 2),
        "previous_close": round(prev, 2),
        "change_pct": round((info.last_price - prev) / prev * 100, 2),
        "market_cap": info.market_cap,
        "volume": info.three_month_average_volume,
    }


def get_stock_history(symbol: str, period: str = "1mo") -> dict:
    """Get historical OHLCV data. Period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y."""
    ticker = yf.Ticker(symbol.upper())
    hist = ticker.history(period=period)
    if hist.empty:
        return {"error": f"No data found for {symbol}"}
    records = []
    for date, row in hist.tail(30).iterrows():
        records.append({
            "date": date.strftime("%Y-%m-%d"),
            "open": round(row["Open"], 2),
            "high": round(row["High"], 2),
            "low": round(row["Low"], 2),
            "close": round(row["Close"], 2),
            "volume": int(row["Volume"]),
        })
    return {"symbol": symbol.upper(), "period": period, "history": records}


def get_stock_info(symbol: str) -> dict:
    """Get detailed company fundamentals and analyst info."""
    ticker = yf.Ticker(symbol.upper())
    info = ticker.info
    keys = [
        "longName", "sector", "industry", "country", "website",
        "longBusinessSummary", "marketCap", "trailingPE", "forwardPE",
        "dividendYield", "52WeekChange", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
        "targetMeanPrice", "recommendationMean", "numberOfAnalystOpinions",
    ]
    return {k: info.get(k) for k in keys if info.get(k) is not None}
