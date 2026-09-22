import * as Astronomy from "astronomy-engine";
import { STARS } from "./starCatalog";

export interface PlottedStar {
  name: string;
  mag: number;
  azimuth: number;
  altitude: number;
}

export interface MoonInfo {
  azimuth: number;
  altitude: number;
  illumination: number; // 0..1
  phaseName: string;
}

export interface SunInfo {
  azimuth: number;
  altitude: number;
}

/** Real sun position for this moment/location, used to drive the
 * physically-based sky shader and the scene's directional light -- so the
 * 3D scene's lighting genuinely matches where the sun actually is, not
 * just a fixed "day/dawn/dusk/night" bucket. */
export function computeSun(date: Date, lat: number, lon: number): SunInfo {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const equator = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
  const horizontal = Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");
  return { azimuth: horizontal.azimuth, altitude: horizontal.altitude };
}

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

function phaseNameFor(phaseAngleDeg: number): string {
  const index = Math.round((phaseAngleDeg % 360) / 45) % 8;
  return PHASE_NAMES[index];
}

export function computeVisibleStars(date: Date, lat: number, lon: number): PlottedStar[] {
  const observer = new Astronomy.Observer(lat, lon, 0);
  return STARS.map((star) => {
    const horizontal = Astronomy.Horizon(date, observer, star.raDeg / 15, star.decDeg, "normal");
    return {
      name: star.name,
      mag: star.mag,
      azimuth: horizontal.azimuth,
      altitude: horizontal.altitude,
    };
  }).filter((star) => star.altitude > -1);
}

export function computeMoon(date: Date, lat: number, lon: number): MoonInfo {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const equator = Astronomy.Equator(Astronomy.Body.Moon, date, observer, true, true);
  const horizontal = Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const phaseAngle = Astronomy.MoonPhase(date);
  return {
    azimuth: horizontal.azimuth,
    altitude: horizontal.altitude,
    illumination: illum.phase_fraction,
    phaseName: phaseNameFor(phaseAngle),
  };
}

/** Stereographic "sky dome" projection: zenith at the center, horizon at
 * the circle's edge, azimuth measured clockwise from north = up. Returns
 * null when the object is below the horizon. */
export function projectToDome(
  azimuthDeg: number,
  altitudeDeg: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (altitudeDeg < 0) return null;
  const radius = (Math.min(width, height) / 2) * 0.96;
  const cx = width / 2;
  const cy = height / 2;
  const r = ((90 - altitudeDeg) / 90) * radius;
  const theta = (azimuthDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(theta),
    y: cy - r * Math.cos(theta),
  };
}
