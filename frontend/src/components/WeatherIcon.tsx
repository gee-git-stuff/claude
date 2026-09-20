import type { Condition } from "../types";

const EMOJI: Record<Condition, string> = {
  clear: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  fog: "🌫️",
  rain: "🌧️",
  snow: "❄️",
  thunderstorm: "⛈️",
};

export default function WeatherIcon({ condition, size = 24 }: { condition: Condition; size?: number }) {
  return <span style={{ fontSize: size }}>{EMOJI[condition]}</span>;
}
