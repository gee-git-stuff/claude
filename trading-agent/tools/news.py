import feedparser

NEWS_FEEDS = {
    "reuters_business": "https://feeds.reuters.com/reuters/businessNews",
    "yahoo_finance": "https://finance.yahoo.com/news/rssindex",
    "marketwatch": "https://feeds.marketwatch.com/marketwatch/topstories",
    "cnbc": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    "seeking_alpha": "https://seekingalpha.com/feed.xml",
}


def get_market_news(max_items: int = 10) -> list:
    """Fetch top market news from multiple RSS feeds."""
    articles = []
    for source, url in NEWS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:3]:
                articles.append({
                    "source": source,
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", "")[:300],
                    "link": entry.get("link", ""),
                    "published": entry.get("published", ""),
                })
        except Exception:
            continue
    return articles[:max_items]


def search_news(query: str, max_items: int = 5) -> list:
    """Search for news about a specific stock or topic via Google News RSS."""
    url = f"https://news.google.com/rss/search?q={query}+stock&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(url)
    articles = []
    for entry in feed.entries[:max_items]:
        articles.append({
            "title": entry.get("title", ""),
            "summary": entry.get("summary", "")[:300],
            "link": entry.get("link", ""),
            "published": entry.get("published", ""),
        })
    return articles
