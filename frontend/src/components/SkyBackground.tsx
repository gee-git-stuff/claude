import type { ScenePalette } from "../types";

interface Props {
  palette: ScenePalette;
}

export default function SkyBackground({ palette }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(to bottom, ${palette.skyTop} 0%, ${palette.skyMid} 55%, ${palette.skyBottom} 78%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "22%",
          background: palette.ground,
          borderTop: `2px solid rgba(0,0,0,0.1)`,
        }}
      />
    </div>
  );
}
