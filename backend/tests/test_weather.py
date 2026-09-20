from datetime import datetime

from app.weather import build_weather_summary, classify_condition, classify_period


def test_classify_condition_maps_wmo_codes():
    assert classify_condition(0) == "clear"
    assert classify_condition(3) == "cloudy"
    assert classify_condition(63) == "rain"
    assert classify_condition(75) == "snow"
    assert classify_condition(95) == "thunderstorm"
    assert classify_condition(9999) == "cloudy"  # unknown code -> safe default


def test_classify_period_buckets_around_sunrise_and_sunset():
    sunrise = datetime(2026, 9, 20, 6, 42)
    sunset = datetime(2026, 9, 20, 18, 57)

    assert classify_period(datetime(2026, 9, 20, 6, 42), sunrise, sunset) == "dawn"
    assert classify_period(datetime(2026, 9, 20, 12, 0), sunrise, sunset) == "day"
    assert classify_period(datetime(2026, 9, 20, 18, 57), sunrise, sunset) == "dusk"
    assert classify_period(datetime(2026, 9, 20, 23, 0), sunrise, sunset) == "night"
    assert classify_period(datetime(2026, 9, 20, 3, 0), sunrise, sunset) == "night"


SAMPLE_RAW = {
    "current": {
        "time": "2026-09-20T12:00",
        "temperature_2m": 58.0,
        "apparent_temperature": 56.0,
        "relative_humidity_2m": 64,
        "weather_code": 61,
        "wind_speed_10m": 7.2,
        "is_day": 1,
    },
    "hourly": {
        "time": [f"2026-09-20T{h:02d}:00" for h in range(24)],
        "temperature_2m": [50 + i for i in range(24)],
        "weather_code": [61 if 8 <= i <= 14 else 0 for i in range(24)],
    },
    "daily": {
        "sunrise": ["2026-09-20T06:42"],
        "sunset": ["2026-09-20T18:57"],
        "weather_code": [61],
        "temperature_2m_max": [61.0],
        "temperature_2m_min": [47.0],
    },
}


def test_build_weather_summary_shapes_output():
    summary = build_weather_summary(SAMPLE_RAW)

    assert summary["period"] == "day"
    assert summary["condition"] == "rain"
    assert summary["temperature"] == 58.0
    assert summary["sunrise"] == "2026-09-20T06:42"
    assert summary["sunset"] == "2026-09-20T18:57"
    assert len(summary["hourly"]) == 8
    assert summary["hourly"][0]["time"] == "2026-09-20T12:00"
    assert summary["location"]["name"] == "Merrimack, NH"
