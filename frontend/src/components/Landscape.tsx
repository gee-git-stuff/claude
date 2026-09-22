import type { ScenePalette } from "../types";
import { mix } from "../lib/color";

interface Props {
  palette: ScenePalette;
}

/** Three parallax ridge layers for atmospheric depth: distant peaks fade
 * toward the sky color (haze), nearer hills read closer to true ground
 * color. Rendered as part of the sky, well behind hotspots and weather. */
export default function Landscape({ palette }: Props) {
  const far = mix(palette.skyBottom, palette.ground, 0.28);
  const mid = mix(palette.skyBottom, palette.ground, 0.62);
  const near = palette.ground;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <path
        d="M 0 100 L 0 58 Q 12 44 22 53 Q 34 64 46 51 Q 58 40 70 54 Q 82 65 92 52 Q 98 46 100 50 L 100 100 Z"
        fill={far}
      />
      <path
        d="M 0 100 L 0 74 Q 20 61 35 71 Q 50 80 65 68 Q 80 58 100 70 L 100 100 Z"
        fill={mid}
      />
      <path d="M 0 100 L 0 84 Q 25 80 50 84 Q 75 88 100 82 L 100 100 Z" fill={near} />

      {/* a thin treeline of little conifers along the near ridge for texture */}
      <g fill={mix(near, "#000000", 0.18)}>
        {[6, 14, 20, 27, 62, 70, 77, 85, 93].map((x, i) => {
          const y = 84 + Math.sin(i) * 1.2 - 0.6;
          const h = 3 + (i % 3);
          return <polygon key={x} points={`${x},${y - h} ${x - h * 0.4},${y} ${x + h * 0.4},${y}`} />;
        })}
      </g>
    </svg>
  );
}
