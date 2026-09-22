import * as THREE from "three";
import type { Condition, Period } from "../../types";

/** Which compass direction each scene's window/porch faces, expressed as
 * the offset that places that azimuth on the camera's forward (-Z) axis.
 * (With three.js's setFromSphericalCoords, x = sinφ·sinθ and z = sinφ·cosθ,
 * so theta = azimuth + offset places `azimuth` on -Z when offset = -azimuth
 * ... concretely: offset = 90 centers east, offset = -90 centers west.)
 *
 * A south-facing window sounds like the obvious "centered" choice, but
 * it's actually a bad one: at solar noon the sun is both closest to due
 * south AND at its highest elevation for the day, so exactly when it's
 * centered horizontally it's also most likely to be above the window's
 * vertical field of view (a wall window isn't a skylight) -- the two
 * effects cancel out and the sun is rarely actually visible.
 *
 * Instead each time-of-day scene faces the direction where the sun is
 * both centered AND low enough to be in frame right when that scene is
 * about the sun: dawn/day face east for the sunrise and morning sun, dusk
 * faces west for the sunset. Night's ground/mountains don't have a sun to
 * chase, so it keeps facing east for visual continuity with day. */
const AZ_OFFSET_BY_PERIOD: Record<Period, number> = {
  dawn: 90,
  day: 90,
  dusk: -90,
  night: 90,
};

export function azimuthOffsetForPeriod(period: Period): number {
  return AZ_OFFSET_BY_PERIOD[period];
}

export function directionFromAzAlt(azimuthDeg: number, altitudeDeg: number, azOffsetDeg: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - altitudeDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg + azOffsetDeg);
  const v = new THREE.Vector3();
  v.setFromSphericalCoords(1, phi, theta);
  return v;
}

export interface SkyTuning {
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  exposure: number;
}

const TUNING: Record<Condition, SkyTuning> = {
  clear: { turbidity: 2, rayleigh: 1.2, mieCoefficient: 0.005, mieDirectionalG: 0.75, exposure: 0.55 },
  partly_cloudy: { turbidity: 4, rayleigh: 1.4, mieCoefficient: 0.008, mieDirectionalG: 0.75, exposure: 0.5 },
  cloudy: { turbidity: 8, rayleigh: 1.6, mieCoefficient: 0.02, mieDirectionalG: 0.8, exposure: 0.4 },
  fog: { turbidity: 10, rayleigh: 0.6, mieCoefficient: 0.04, mieDirectionalG: 0.85, exposure: 0.35 },
  rain: { turbidity: 9, rayleigh: 0.6, mieCoefficient: 0.03, mieDirectionalG: 0.8, exposure: 0.32 },
  thunderstorm: { turbidity: 10, rayleigh: 0.4, mieCoefficient: 0.03, mieDirectionalG: 0.8, exposure: 0.24 },
  snow: { turbidity: 5, rayleigh: 1.8, mieCoefficient: 0.02, mieDirectionalG: 0.8, exposure: 0.5 },
};

export function skyTuningFor(condition: Condition): SkyTuning {
  return TUNING[condition] ?? TUNING.clear;
}

/** Fog draw distance in world units, tightest for literal fog. */
export function fogDistanceFor(condition: Condition): { near: number; far: number } {
  switch (condition) {
    case "fog":
      return { near: 4, far: 70 };
    case "rain":
    case "thunderstorm":
      return { near: 20, far: 220 };
    case "cloudy":
      return { near: 40, far: 320 };
    default:
      return { near: 60, far: 480 };
  }
}
