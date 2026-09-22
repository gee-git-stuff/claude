import type { AccentStyle } from "../types";
import { shade } from "../lib/color";

interface Props {
  accent: AccentStyle;
  accentColor: string;
}

function WoodDefs({ accentColor, uid }: { accentColor: string; uid: string }) {
  const light = shade(accentColor, 30);
  const dark = shade(accentColor, -30);
  return (
    <defs>
      {/* userSpaceOnUse (rather than the default objectBoundingBox) so these
       * still render correctly on thin <line> strokes, whose own bounding
       * box is zero-width or zero-height. */}
      <linearGradient id={`wood-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
        <stop offset="0%" stopColor={light} />
        <stop offset="45%" stopColor={accentColor} />
        <stop offset="100%" stopColor={dark} />
      </linearGradient>
      <linearGradient id={`woodH-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
        <stop offset="0%" stopColor={light} />
        <stop offset="45%" stopColor={accentColor} />
        <stop offset="100%" stopColor={dark} />
      </linearGradient>
    </defs>
  );
}

function GlassGlare() {
  return (
    <g fill="#ffffff" opacity={0.07}>
      <polygon points="10,0 22,0 4,100 -8,100" />
      <polygon points="30,0 36,0 18,100 12,100" />
    </g>
  );
}

function WindowFrame({ accentColor }: { accentColor: string }) {
  const uid = "window";
  const sill = shade(accentColor, -20);
  const sillLight = shade(accentColor, 15);
  const curtain = shade(accentColor, 55);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <WoodDefs accentColor={accentColor} uid={uid} />

      <GlassGlare />

      {/* curtains: simple straight-edged corner drapes, safe under non-uniform scaling */}
      <polygon points="0,0 9,0 0,16" fill={curtain} opacity={0.85} />
      <polygon points="100,0 91,0 100,16" fill={curtain} opacity={0.85} />

      {/* frame border */}
      <rect x="0" y="0" width="100" height="100" fill="none" stroke={`url(#wood-${uid})`} strokeWidth="7" />
      {/* mullions */}
      <line x1="50" y1="3.5" x2="50" y2="96.5" stroke={`url(#wood-${uid})`} strokeWidth="3" />
      <line x1="3.5" y1="50" x2="96.5" y2="50" stroke={`url(#woodH-${uid})`} strokeWidth="3" />

      {/* windowsill: a beveled ledge with a lit top edge */}
      <rect x="0" y="93" width="100" height="7" fill={sill} />
      <rect x="0" y="93" width="100" height="1.4" fill={sillLight} />

      {/* potted plant */}
      <g transform="translate(14 93)">
        <polygon points="-4,0 4,0 3,6 -3,6" fill={sill} />
        <polygon points="-4,0 4,0 3.5,1.4 -3.5,1.4" fill={sillLight} />
        <line x1="0" y1="0" x2="0" y2="-10" stroke="#3f7a3f" strokeWidth="2" />
        <line x1="0" y1="-6" x2="-6" y2="-14" stroke="#3f7a3f" strokeWidth="2" />
        <line x1="0" y1="-6" x2="6" y2="-13" stroke="#3f7a3f" strokeWidth="2" />
        <circle cx="-6" cy="-14" r="1.6" fill="#5a9448" />
        <circle cx="6" cy="-13" r="1.6" fill="#5a9448" />
        <circle cx="0" cy="-10" r="1.6" fill="#79b364" />
      </g>
    </svg>
  );
}

function PorchRail({ accentColor }: { accentColor: string }) {
  const uid = "porch";
  const posts = Array.from({ length: 7 }, (_, i) => 8 + i * 14);
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <WoodDefs accentColor={accentColor} uid={uid} />

      {/* eave shadow */}
      <path d="M 0 0 L 100 0 L 100 6 Q 50 14 0 6 Z" fill={accentColor} opacity={0.5} />

      {/* rail posts */}
      {posts.map((x) => (
        <rect key={x} x={x - 1.2} y={78} width={2.4} height={20} fill={`url(#wood-${uid})`} />
      ))}
      {/* top and bottom rails */}
      <rect x="0" y="80" width="100" height="3" fill={`url(#woodH-${uid})`} />
      <rect x="0" y="95" width="100" height="3" fill={`url(#woodH-${uid})`} />
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
