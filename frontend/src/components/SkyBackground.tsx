import type { ScenePalette } from "../types";
import Landscape from "./Landscape";

interface Props {
  palette: ScenePalette;
}

export default function SkyBackground({ palette }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(to bottom, ${palette.skyTop} 0%, ${palette.skyMid} 55%, ${palette.skyBottom} 82%)`,
      }}
    >
      {/* horizon haze: softens the seam between sky gradient and the landscape */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "10%",
          height: "20%",
          background: `linear-gradient(to bottom, transparent, ${palette.skyBottom})`,
          opacity: 0.6,
        }}
      />
      <Landscape palette={palette} />
    </div>
  );
}
