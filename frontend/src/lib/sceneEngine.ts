import type { Period, SceneConfig, SceneOverride } from "../types";

function mergeScene(base: SceneConfig, override: SceneOverride | null): SceneConfig {
  if (!override) return base;
  return {
    ...base,
    ...override,
    palette: { ...base.palette, ...(override.palette ?? {}) },
  };
}

async function loadJSON<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

const cache = new Map<Period, SceneConfig>();

/** Loads a scene by time-of-day period, layering an optional user override
 * (public/scenes/user/<period>.json) on top of the shipped default
 * (public/scenes/default/<period>.json). Results are cached per period for
 * the lifetime of the page. */
export async function loadScene(period: Period): Promise<SceneConfig> {
  const cached = cache.get(period);
  if (cached) return cached;

  const [base, override] = await Promise.all([
    loadJSON<SceneConfig>(`/scenes/default/${period}.json`),
    loadJSON<SceneOverride>(`/scenes/user/${period}.json`),
  ]);

  if (!base) {
    throw new Error(`Missing default scene for period "${period}"`);
  }

  const scene = mergeScene(base, override);
  cache.set(period, scene);
  return scene;
}
