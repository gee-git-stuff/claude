from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import EXTRA_CORS_ORIGINS, LOCATION
from .weather import get_weather_summary

app = FastAPI(title="Weather Station API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *EXTRA_CORS_ORIGINS,
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/location")
def location():
    return LOCATION


@app.get("/api/weather")
async def weather():
    try:
        return await get_weather_summary()
    except Exception as exc:  # network/API failure -> surface a clean 502
        raise HTTPException(
            status_code=502, detail=f"Could not fetch weather: {exc}"
        ) from exc
