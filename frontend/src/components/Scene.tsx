import { useState } from "react";
import type { Condition, Hotspot, SceneConfig } from "../types";
import SkyBackground from "./SkyBackground";
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

export default function Scene({ scene, condition, lat, lon }: Props) {
  const [active, setActive] = useState<Hotspot | null>(null);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SkyBackground palette={scene.palette} />
      {scene.starChart && <StarChart lat={lat} lon={lon} />}
      <WeatherOverlay condition={condition} />
      {scene.hotspots.map((h) => (
        <HotspotMarker key={h.id} hotspot={h} onSelect={setActive} />
      ))}
      <SceneAccent accent={scene.accent} accentColor={scene.palette.accent} />
      {active && <LessonModal hotspot={active} onClose={() => setActive(null)} />}
    </div>
  );
}
