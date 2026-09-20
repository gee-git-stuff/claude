export type Period = "dawn" | "day" | "dusk" | "night";

export type Condition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunderstorm";

export interface Location {
  name: string;
  lat: number;
  lon: number;
  timezone: string;
}

export interface HourlyPoint {
  time: string;
  temperature: number;
  condition: Condition;
}

export interface WeatherSummary {
  location: Location;
  now: string;
  period: Period;
  condition: Condition;
  temperature: number;
  feels_like: number | null;
  humidity: number | null;
  wind_speed: number | null;
  sunrise: string;
  sunset: string;
  hourly: HourlyPoint[];
}

export interface Lesson {
  title: string;
  fact: string;
  question: string;
  choices: string[];
  answerIndex: number;
  successMessage: string;
}

export interface Hotspot {
  id: string;
  label: string;
  /** Position as a percentage of the scene width/height, 0-100. */
  x: number;
  y: number;
  /** Click-target radius as a percentage of scene width. */
  radius: number;
  icon: string;
  lesson: Lesson;
}

export interface ScenePalette {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  ground: string;
  accent: string;
}

export type AccentStyle = "window-frame" | "porch-rail" | "none";

export interface SceneConfig {
  key: Period;
  label: string;
  feel: string;
  palette: ScenePalette;
  accent: AccentStyle;
  hotspots: Hotspot[];
  /** When true, the night sky star chart renders instead of (in addition
   * to) the static hotspots above. */
  starChart: boolean;
}

/** A partial scene used for user overrides: any field may be omitted, in
 * which case the shipped default for that field is kept. */
export type SceneOverride = Partial<Omit<SceneConfig, "palette">> & {
  palette?: Partial<ScenePalette>;
};
