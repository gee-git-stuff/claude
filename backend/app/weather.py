"""Fetches weather from Open-Meteo and classifies it into the coarse
buckets the frontend scene engine understands (time-of-day period +
weather condition). The classification functions are pure so they can be
unit tested without any network access.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Literal

import httpx

from .config import LOCATION, MOCK_WEATHER

Period = Literal["dawn", "day", "dusk", "night"]
Condition = Literal[
    "clear", "partly_cloudy", "cloudy", "fog", "rain", "snow", "thunderstorm"
]

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather codes (https://open-meteo.com/en/docs) collapsed into the
# handful of scene-overlay conditions we actually render.
_WMO_CONDITION: dict[int, Condition] = {
    0: "clear",
    1: "partly_cloudy",
    2: "partly_cloudy",
    3: "cloudy",
    45: "fog",
    48: "fog",
    51: "rain",
    53: "rain",
    55: "rain",
    56: "rain",
    57: "rain",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",
    67: "rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow",
    80: "rain",
    81: "rain",
    82: "rain",
    85: "snow",
    86: "snow",
    95: "thunderstorm",
    96: "thunderstorm",
    99: "thunderstorm",
}

TWILIGHT_WINDOW = timedelta(minutes=40)


def classify_condition(weather_code: int) -> Condition:
    return _WMO_CONDITION.get(weather_code, "cloudy")


def classify_period(now: datetime, sunrise: datetime, sunset: datetime) -> Period:
    """`now`, `sunrise`, and `sunset` must share the same (or no) tzinfo."""
    if sunrise - TWILIGHT_WINDOW <= now <= sunrise + TWILIGHT_WINDOW:
        return "dawn"
    if sunset - TWILIGHT_WINDOW <= now <= sunset + TWILIGHT_WINDOW:
        return "dusk"
    if sunrise + TWILIGHT_WINDOW < now < sunset - TWILIGHT_WINDOW:
        return "day"
    return "night"


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


def build_weather_summary(raw: dict[str, Any]) -> dict[str, Any]:
    """Turns a raw Open-Meteo payload into the shape the frontend consumes."""
    current = raw["current"]
    daily = raw["daily"]
    hourly = raw["hourly"]

    now = _parse_iso(current["time"])
    sunrise = _parse_iso(daily["sunrise"][0])
    sunset = _parse_iso(daily["sunset"][0])

    condition = classify_condition(current["weather_code"])
    period = classify_period(now, sunrise, sunset)

    # Next 8 hourly points from "now" onward for the forecast strip.
    hourly_times = [_parse_iso(t) for t in hourly["time"]]
    start_idx = next(
        (i for i, t in enumerate(hourly_times) if t >= now), 0
    )
    upcoming = [
        {
            "time": hourly["time"][i],
            "temperature": hourly["temperature_2m"][i],
            "condition": classify_condition(hourly["weather_code"][i]),
        }
        for i in range(start_idx, min(start_idx + 8, len(hourly_times)))
    ]

    return {
        "location": LOCATION,
        "now": current["time"],
        "period": period,
        "condition": condition,
        "temperature": current["temperature_2m"],
        "feels_like": current.get("apparent_temperature"),
        "humidity": current.get("relative_humidity_2m"),
        "wind_speed": current.get("wind_speed_10m"),
        "sunrise": daily["sunrise"][0],
        "sunset": daily["sunset"][0],
        "hourly": upcoming,
    }


async def fetch_raw_weather() -> dict[str, Any]:
    if MOCK_WEATHER:
        return _sample_payload()

    params = {
        "latitude": LOCATION["lat"],
        "longitude": LOCATION["lon"],
        "timezone": LOCATION["timezone"],
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
        "weather_code,wind_speed_10m,is_day",
        "hourly": "temperature_2m,weather_code",
        "daily": "sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min",
        "forecast_days": 2,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        return response.json()


async def get_weather_summary() -> dict[str, Any]:
    raw = await fetch_raw_weather()
    return build_weather_summary(raw)


def _sample_payload() -> dict[str, Any]:
    """A realistic Open-Meteo response for Merrimack, NH used when
    MOCK_WEATHER is set, or as fixture data in tests."""
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    today = now.date().isoformat()
    hours = [f"{today}T{h:02d}:00" for h in range(24)]
    return {
        "current": {
            "time": now.isoformat(timespec="minutes"),
            "temperature_2m": 58.0,
            "apparent_temperature": 56.0,
            "relative_humidity_2m": 64,
            "weather_code": 61,
            "wind_speed_10m": 7.2,
            "is_day": 1,
        },
        "hourly": {
            "time": hours,
            "temperature_2m": [50 + (i % 12) for i in range(24)],
            "weather_code": [61 if 8 <= i <= 14 else 2 for i in range(24)],
        },
        "daily": {
            "sunrise": [f"{today}T06:42"],
            "sunset": [f"{today}T18:57"],
            "weather_code": [61],
            "temperature_2m_max": [61.0],
            "temperature_2m_min": [47.0],
        },
    }
