import type { WeatherSummary } from "../types";
import WeatherIcon from "./WeatherIcon";

function formatHour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric" });
}

export default function ForecastStrip({ weather }: { weather: WeatherSummary }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        gap: 12,
        padding: "10px 16px",
        overflowX: "auto",
        background: "rgba(20, 20, 30, 0.4)",
        backdropFilter: "blur(4px)",
        zIndex: 15,
      }}
    >
      {weather.hourly.map((h) => (
        <div
          key={h.time}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: "#fff",
            minWidth: 46,
            fontSize: 13,
          }}
        >
          <span>{formatHour(h.time)}</span>
          <WeatherIcon condition={h.condition} size={20} />
          <span>{Math.round(h.temperature)}°</span>
        </div>
      ))}
    </div>
  );
}
