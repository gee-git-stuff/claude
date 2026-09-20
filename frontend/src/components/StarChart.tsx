import { useEffect, useMemo, useState } from "react";
import { CONSTELLATIONS } from "../lib/starCatalog";
import { computeMoon, computeVisibleStars, projectToDome, type MoonInfo, type PlottedStar } from "../lib/astronomyClient";
import type { Constellation } from "../lib/starCatalog";

interface Props {
  lat: number;
  lon: number;
}

const WIDTH = 100;
const HEIGHT = 100;

function starRadius(mag: number): number {
  // Brighter stars have lower (even negative) magnitudes.
  return Math.max(0.35, 1.7 - mag * 0.32);
}

export default function StarChart({ lat, lon }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [activeConstellation, setActiveConstellation] = useState<Constellation | null>(null);
  const [showMoonInfo, setShowMoonInfo] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const stars = useMemo(() => computeVisibleStars(now, lat, lon), [now, lat, lon]);
  const moon: MoonInfo = useMemo(() => computeMoon(now, lat, lon), [now, lat, lon]);

  const starByName = useMemo(() => {
    const map = new Map<string, PlottedStar>();
    for (const s of stars) map.set(s.name, s);
    return map;
  }, [stars]);

  const moonPos = projectToDome(moon.azimuth, moon.altitude, WIDTH, HEIGHT);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {/* constellation lines */}
        {CONSTELLATIONS.map((c) =>
          c.lines.map(([a, b]) => {
            const pa = starByName.get(a);
            const pb = starByName.get(b);
            if (!pa || !pb) return null;
            const pta = projectToDome(pa.azimuth, pa.altitude, WIDTH, HEIGHT);
            const ptb = projectToDome(pb.azimuth, pb.altitude, WIDTH, HEIGHT);
            if (!pta || !ptb) return null;
            return (
              <line
                key={`${c.id}-${a}-${b}`}
                x1={pta.x}
                y1={pta.y}
                x2={ptb.x}
                y2={ptb.y}
                stroke="rgba(150,180,255,0.35)"
                strokeWidth={0.25}
              />
            );
          }),
        )}

        {/* stars */}
        {stars.map((s) => {
          const pt = projectToDome(s.azimuth, s.altitude, WIDTH, HEIGHT);
          if (!pt) return null;
          return (
            <circle
              key={s.name}
              cx={pt.x}
              cy={pt.y}
              r={starRadius(s.mag)}
              fill="#fdf6e3"
            />
          );
        })}

        {/* moon */}
        {moonPos && (
          <circle
            cx={moonPos.x}
            cy={moonPos.y}
            r={2.2}
            fill="#e9e9f2"
            opacity={0.35 + moon.illumination * 0.65}
          />
        )}
      </svg>

      {/* clickable constellation labels */}
      {CONSTELLATIONS.map((c) => {
        const anchorName = c.stars[0];
        const anchor = starByName.get(anchorName);
        if (!anchor) return null;
        const pt = projectToDome(anchor.azimuth, anchor.altitude, WIDTH, HEIGHT);
        if (!pt) return null;
        return (
          <button
            key={c.id}
            onClick={() => setActiveConstellation(c)}
            aria-label={c.name}
            style={{
              position: "absolute",
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              transform: "translate(-50%, -50%)",
              width: "10vmin",
              height: "10vmin",
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          />
        );
      })}

      {moonPos && (
        <button
          onClick={() => setShowMoonInfo(true)}
          aria-label="The Moon"
          style={{
            position: "absolute",
            left: `${moonPos.x}%`,
            top: `${moonPos.y}%`,
            transform: "translate(-50%, -50%)",
            width: "7vmin",
            height: "7vmin",
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
          title={`The Moon — ${moon.phaseName} (${Math.round(moon.illumination * 100)}% lit)`}
        />
      )}

      {activeConstellation && (
        <div
          role="dialog"
          aria-label={activeConstellation.name}
          onClick={() => setActiveConstellation(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 12, 30, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f1230",
              color: "#f0eefc",
              borderRadius: 24,
              padding: "1.5rem 1.75rem",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              border: "6px solid #6a5acd",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{activeConstellation.name}</h2>
            <p style={{ lineHeight: 1.5 }}>{activeConstellation.blurb}</p>
            <button
              onClick={() => setActiveConstellation(null)}
              style={{
                marginTop: 8,
                padding: "0.5rem 1.2rem",
                borderRadius: 999,
                border: "none",
                background: "#6a5acd",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showMoonInfo && (
        <div
          role="dialog"
          aria-label="The Moon"
          onClick={() => setShowMoonInfo(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 12, 30, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f1230",
              color: "#f0eefc",
              borderRadius: 24,
              padding: "1.5rem 1.75rem",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              border: "6px solid #6a5acd",
            }}
          >
            <h2 style={{ marginTop: 0 }}>The Moon</h2>
            <p style={{ lineHeight: 1.5 }}>
              Tonight the Moon is a <strong>{moon.phaseName}</strong>, about{" "}
              {Math.round(moon.illumination * 100)}% lit up by sunlight.
            </p>
            <p style={{ lineHeight: 1.5 }}>
              The Moon doesn't make its own light — it's really just reflecting sunlight! As
              the Moon circles Earth over about a month, we see different amounts of its
              sunlit side, which is why it seems to change shape.
            </p>
            <button
              onClick={() => setShowMoonInfo(false)}
              style={{
                marginTop: 8,
                padding: "0.5rem 1.2rem",
                borderRadius: 999,
                border: "none",
                background: "#6a5acd",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
