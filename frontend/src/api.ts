import type { Location, WeatherSummary } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function getJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchWeather(): Promise<WeatherSummary> {
  return getJSON<WeatherSummary>("/api/weather");
}

export function fetchLocation(): Promise<Location> {
  return getJSON<Location>("/api/location");
}
