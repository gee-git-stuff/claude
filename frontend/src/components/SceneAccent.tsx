import type { AccentStyle } from "../types";

interface Props {
  accent: AccentStyle;
  accentColor: string;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function WindowFrame({ accentColor }: { accentColor: string }) {
  const sill = shade(accentColor, -20);
  const highlight = shade(accentColor, 25);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* curtains: simple straight-edged corner drapes, safe under non-uniform scaling */}
      <polygon points="0,0 9,0 0,16" fill={highlight} opacity={0.85} />
      <polygon points="100,0 91,0 100,16" fill={highlight} opacity={0.85} />

      {/* frame border */}
      <rect x="0" y="0" width="100" height="100" fill="none" stroke={accentColor} strokeWidth="7" />
      {/* mullions */}
      <line x1="50" y1="3.5" x2="50" y2="96.5" stroke={accentColor} strokeWidth="3" />
      <line x1="3.5" y1="50" x2="96.5" y2="50" stroke={accentColor} strokeWidth="3" />

      {/* windowsill */}
      <rect x="0" y="93" width="100" height="7" fill={sill} />
      {/* potted plant */}
      <g transform="translate(14 93)">
        <polygon points="-4,0 4,0 3,6 -3,6" fill={sill} />
        <line x1="0" y1="0" x2="0" y2="-10" stroke="#3f7a3f" strokeWidth="2" />
        <line x1="0" y1="-6" x2="-6" y2="-14" stroke="#3f7a3f" strokeWidth="2" />
        <line x1="0" y1="-6" x2="6" y2="-13" stroke="#3f7a3f" strokeWidth="2" />
      </g>
    </svg>
  );
}

function PorchRail({ accentColor }: { accentColor: string }) {
  const posts = Array.from({ length: 7 }, (_, i) => 8 + i * 14);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* eave shadow */}
      <path d="M 0 0 L 100 0 L 100 6 Q 50 14 0 6 Z" fill={accentColor} opacity={0.5} />

      {/* rail posts */}
      {posts.map((x) => (
        <rect key={x} x={x - 1.2} y={78} width={2.4} height={20} fill={accentColor} />
      ))}
      {/* top and bottom rails */}
      <rect x="0" y="80" width="100" height="3" fill={accentColor} />
      <rect x="0" y="95" width="100" height="3" fill={accentColor} />
    </svg>
  );
}

export default function SceneAccent({ accent, accentColor }: Props) {
  if (accent === "none") return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {accent === "window-frame" && <WindowFrame accentColor={accentColor} />}
      {accent === "porch-rail" && <PorchRail accentColor={accentColor} />}
    </div>
  );
}
