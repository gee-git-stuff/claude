import type { Hotspot } from "../types";

type IconRenderer = (uid: string) => JSX.Element;

const ICONS: Record<string, IconRenderer> = {
  sun: (uid) => (
    <g>
      <defs>
        <radialGradient id={`sunCore-${uid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff7d6" />
          <stop offset="45%" stopColor="#ffd35c" />
          <stop offset="100%" stopColor="#ffb027" />
        </radialGradient>
        <radialGradient id={`sunHalo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd35c" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#ffd35c" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r="42" fill={`url(#sunHalo-${uid})`} />
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const x1 = Math.cos(angle) * 21;
        const y1 = Math.sin(angle) * 21;
        const x2 = Math.cos(angle) * (i % 2 === 0 ? 31 : 27);
        const y2 = Math.sin(angle) * (i % 2 === 0 ? 31 : 27);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#ffd35c"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      <circle r="19" fill={`url(#sunCore-${uid})`} />
    </g>
  ),

  cloud: (uid) => (
    <g>
      <defs>
        <linearGradient id={`cloudBody-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dfe7f2" />
        </linearGradient>
      </defs>
      <g opacity={0.25} transform="translate(2 4)">
        <ellipse cx="-14" cy="4" rx="16" ry="11" fill="#7a8aa5" />
        <ellipse cx="9" cy="-1" rx="21" ry="14" fill="#7a8aa5" />
        <ellipse cx="29" cy="6" rx="13" ry="9" fill="#7a8aa5" />
      </g>
      <g fill={`url(#cloudBody-${uid})`}>
        <ellipse cx="-14" cy="4" rx="16" ry="11" />
        <ellipse cx="9" cy="-1" rx="21" ry="14" />
        <ellipse cx="29" cy="6" rx="13" ry="9" />
        <ellipse cx="-2" cy="-8" rx="13" ry="10" />
      </g>
      <ellipse cx="-6" cy="-6" rx="7" ry="4" fill="#ffffff" opacity={0.8} />
    </g>
  ),

  tree: () => (
    <g>
      <path d="M -3 8 Q -5 20 -4 30 L 4 30 Q 5 20 3 8 Z" fill="#6b4423" />
      <g fill="#3d6e30">
        <circle cx="-16" cy="6" r="15" />
        <circle cx="15" cy="8" r="16" />
        <circle cx="0" cy="-10" r="20" />
        <circle cx="-6" cy="14" r="13" />
        <circle cx="10" cy="16" r="12" />
      </g>
      <g fill="#5a9448">
        <circle cx="-8" cy="-14" r="12" />
        <circle cx="10" cy="-8" r="10" />
        <circle cx="-14" cy="2" r="9" />
      </g>
      <g fill="#79b364" opacity={0.7}>
        <circle cx="-4" cy="-18" r="6" />
        <circle cx="14" cy="-12" r="5" />
      </g>
    </g>
  ),

  hill: () => (
    <g>
      <path d="M -30 15 Q 0 -25 30 15 Z" fill="#5f9a49" />
      <path d="M -30 15 Q -10 0 10 15 Z" fill="#4c8c3b" opacity={0.7} />
    </g>
  ),

  /** A subtle "look here" glint used over parts of the landscape art that
   * already depict the thing being taught about (e.g. the hills), so we
   * don't draw a second, redundant shape on top of it. */
  sparkle: () => (
    <g fill="#fff7d6" stroke="#fff7d6">
      <polygon points="0,-14 2.5,-2.5 14,0 2.5,2.5 0,14 -2.5,2.5 -14,0 -2.5,-2.5">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" repeatCount="indefinite" />
      </polygon>
      <circle r="3" fill="#ffffff" />
    </g>
  ),

  glow: (uid) => (
    <g>
      <defs>
        <radialGradient id={`glowGrad-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffcf8a" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#ffb15c" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#ffb15c" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r="40" fill={`url(#glowGrad-${uid})`} />
      <circle r="14" fill="#ffdca0" />
    </g>
  ),

  bird: () => (
    <g stroke="#3a2c1a" strokeWidth={2.5} strokeLinecap="round" fill="none">
      <path d="M -13 0 Q -6 -9 0 -1" />
      <path d="M 0 -1 Q 6 -9 13 0" />
    </g>
  ),

  star: () => (
    <g fill="#fff6d8">
      <polygon points="0,-16 4,-4 16,-4 6,3 10,16 0,8 -10,16 -6,3 -16,-4 -4,-4">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="1.8s" repeatCount="indefinite" />
      </polygon>
    </g>
  ),
};

interface Props {
  hotspot: Hotspot;
  onSelect: (hotspot: Hotspot) => void;
}

export default function HotspotMarker({ hotspot, onSelect }: Props) {
  const renderIcon = ICONS[hotspot.icon] ?? ICONS.star;
  return (
    <button
      onClick={() => onSelect(hotspot)}
      aria-label={hotspot.label}
      title={hotspot.label}
      style={{
        position: "absolute",
        left: `${hotspot.x}%`,
        top: `${hotspot.y}%`,
        transform: "translate(-50%, -50%)",
        width: `${hotspot.radius * 2}vmin`,
        height: `${hotspot.radius * 2}vmin`,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <svg viewBox="-50 -50 100 100" width="100%" height="100%" overflow="visible">
        {renderIcon(hotspot.id)}
      </svg>
    </button>
  );
}
