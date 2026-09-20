import { useEffect, useState } from "react";
import { fetchWeather } from "./api";
import { loadScene } from "./lib/sceneEngine";
import type { SceneConfig, WeatherSummary } from "./types";
import Scene from "./components/Scene";
import ForecastStrip from "./components/ForecastStrip";
import WeatherIcon from "./components/WeatherIcon";

const REFRESH_MS = 10 * 60 * 1000;

export default function App() {
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [scene, setScene] = useState<SceneConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const summary = await fetchWeather();
        if (cancelled) return;
        setWeather(summary);
        setError(null);
        const sceneConfig = await loadScene(summary.period);
        if (cancelled) return;
        setScene(sceneConfig);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1>Little Sky Station</h1>
        <p>Couldn't load the weather: {error}</p>
        <p>Is the backend running? Try: <code>cd backend &amp;&amp; uvicorn app.main:app --reload</code></p>
      </div>
    );
  }

  if (!weather || !scene) {
    return (
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <p>Loading today's sky…</p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Scene scene={scene} condition={weather.condition} lat={weather.location.lat} lon={weather.location.lon} />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 15,
          color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <WeatherIcon condition={weather.condition} size={40} />
        <div>
          <div style={{ fontSize: 28, fontWeight: "bold", lineHeight: 1 }}>
            {Math.round(weather.temperature)}°F
          </div>
          <div style={{ fontSize: 14 }}>{weather.location.name}</div>
        </div>
      </div>

      <ForecastStrip weather={weather} />
    </div>
  );
}
