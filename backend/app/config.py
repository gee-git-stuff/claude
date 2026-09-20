import os

LOCATION = {
    "name": "Merrimack, NH",
    "lat": 42.8654,
    "lon": -71.4934,
    "timezone": "America/New_York",
}

# When set (any truthy value), the weather endpoint returns a bundled sample
# payload instead of calling Open-Meteo. Useful for offline development, or
# for environments where outbound network access to the weather API is
# restricted (e.g. a sandboxed dev container).
MOCK_WEATHER = os.environ.get("MOCK_WEATHER", "").lower() in ("1", "true", "yes")

# Comma-separated list of extra allowed CORS origins beyond the default
# Vite dev server, e.g. "http://localhost:5174,http://192.168.1.20:5173"
EXTRA_CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("EXTRA_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
