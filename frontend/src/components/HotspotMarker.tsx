import type { Hotspot } from "../types";

const ICONS: Record<string, JSX.Element> = {
  sun: (
    <g>
      <circle r="18" fill="#ffd35c" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const x1 = Math.cos(angle) * 22;
        const y1 = Math.sin(angle) * 22;
        const x2 = Math.cos(angle) * 30;
        const y2 = Math.sin(angle) * 30;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#ffd35c"
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}
      <circle r="18" fill="#fff2b8" opacity={0.5}>
        <animate attributeName="r" values="16;20;16" dur="3s" repeatCount="indefinite" />
      </circle>
    </g>
  ),
  cloud: (
    <g fill="#ffffff" stroke="#e4e9f2" strokeWidth={1}>
      <ellipse cx="-14" cy="4" rx="16" ry="12" />
      <ellipse cx="10" cy="0" rx="20" ry="15" />
      <ellipse cx="28" cy="6" rx="13" ry="10" />
    </g>
  ),
  tree: (
    <g>
      <rect x="-4" y="10" width="8" height="20" fill="#6b4423" />
      <circle cx="0" cy="-2" r="22" fill="#4c8c3b" />
      <circle cx="-14" cy="8" r="14" fill="#4c8c3b" />
      <circle cx="14" cy="8" r="14" fill="#4c8c3b" />
    </g>
  ),
  hill: (
    <g>
      <path d="M -30 15 Q 0 -25 30 15 Z" fill="#5f9a49" />
      <path d="M -30 15 Q -10 0 10 15 Z" fill="#4c8c3b" opacity={0.7} />
    </g>
  ),
  glow: (
    <g>
      <circle r="26" fill="#ffb15c" opacity={0.9} />
      <circle r="40" fill="#ffb15c" opacity={0.25} />
    </g>
  ),
  bird: (
    <g stroke="#3a2c1a" strokeWidth={3} strokeLinecap="round" fill="none">
      <path d="M -14 0 Q -6 -10 0 0" />
      <path d="M 0 0 Q 6 -10 14 0" />
    </g>
  ),
  star: (
    <g fill="#fff6d8">
      <polygon points="0,-16 4,-4 16,-4 6,3 10,16 0,8 -10,16 -6,3 -16,-4 -4,-4" />
    </g>
  ),
};

interface Props {
  hotspot: Hotspot;
  onSelect: (hotspot: Hotspot) => void;
}

export default function HotspotMarker({ hotspot, onSelect }: Props) {
  const icon = ICONS[hotspot.icon] ?? ICONS.star;
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
        {icon}
      </svg>
    </button>
  );
}
