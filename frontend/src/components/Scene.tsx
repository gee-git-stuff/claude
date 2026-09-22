import { useCallback, useState } from "react";
import type { Condition, Hotspot, SceneConfig } from "../types";
import Scene3D, { type ScreenPos } from "./Scene3D";
import WeatherOverlay from "./WeatherOverlay";
import SceneAccent from "./SceneAccent";
import HotspotMarker from "./HotspotMarker";
import LessonModal from "./LessonModal";
import StarChart from "./StarChart";

interface Props {
  scene: SceneConfig;
  condition: Condition;
  lat: number;
  lon: number;
}

type LiveObjects = { sun: ScreenPos | null; cloud: ScreenPos | null; tree: ScreenPos | null };

/** Hotspot ids whose on-screen position should track the live 3D object
 * they refer to (the real sun, a decorative cloud, a decorative tree)
 * rather than the fixed percentage authored in the scene JSON -- since
 * the sun's real position genuinely moves through the day/year. */
const LIVE_TRACKED_IDS: Record<string, keyof LiveObjects> = {
  sun: "sun",
  clouds: "cloud",
  tree: "tree",
};

export default function Scene({ scene, condition, lat, lon }: Props) {
  const [active, setActive] = useState<Hotspot | null>(null);
  const [liveObjects, setLiveObjects] = useState<LiveObjects>({ sun: null, cloud: null, tree: null });

  const handleObjectPositions = useCallback((positions: LiveObjects) => {
    setLiveObjects(positions);
  }, []);

  const resolvedHotspots = scene.hotspots
    .map((h) => {
      const trackedKey = LIVE_TRACKED_IDS[h.id];
      if (!trackedKey) return h;
      const live = liveObjects[trackedKey];
      // The tracked object isn't in view right now (e.g. the sun is behind
      // the window at this time of day) -- skip the hotspot entirely
      // rather than show it floating somewhere disconnected from reality.
      if (!live) return null;
      return { ...h, x: live.x, y: live.y };
    })
    .filter((h): h is Hotspot => h !== null);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Scene3D
        palette={scene.palette}
        period={scene.key}
        condition={condition}
        lat={lat}
        lon={lon}
        onObjectPositions={handleObjectPositions}
      />
      {scene.starChart && <StarChart lat={lat} lon={lon} />}
      <WeatherOverlay condition={condition} />
      {resolvedHotspots.map((h) => (
        <HotspotMarker key={h.id} hotspot={h} onSelect={setActive} />
      ))}
      <SceneAccent accent={scene.accent} accentColor={scene.palette.accent} />
      {active && <LessonModal hotspot={active} onClose={() => setActive(null)} />}
    </div>
  );
}
