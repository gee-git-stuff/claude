import { useEffect, useRef } from "react";
import type { Condition } from "../types";

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  drift: number;
}

interface Flake {
  x: number;
  y: number;
  r: number;
  speed: number;
  sway: number;
  swaySpeed: number;
}

interface Puff {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

function makeDrops(count: number, w: number, h: number): Drop[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    len: 10 + Math.random() * 14,
    speed: 6 + Math.random() * 6,
    drift: 1.5,
  }));
}

function makeFlakes(count: number, w: number, h: number): Flake[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 1.5 + Math.random() * 2.5,
    speed: 0.6 + Math.random() * 1.2,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.01 + Math.random() * 0.02,
  }));
}

function makePuffs(count: number, w: number, h: number): Puff[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: h * 0.08 + Math.random() * h * 0.25,
    scale: 0.6 + Math.random() * 1.1,
    speed: 0.15 + Math.random() * 0.25,
  }));
}

interface Props {
  condition: Condition;
}

export default function WeatherOverlay({ condition }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = canvas.width = parent.clientWidth;
      height = canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const drops =
      condition === "rain" || condition === "thunderstorm"
        ? makeDrops(condition === "thunderstorm" ? 140 : 90, width, height)
        : [];
    const flakes = condition === "snow" ? makeFlakes(90, width, height) : [];
    const puffs =
      condition === "cloudy" || condition === "partly_cloudy"
        ? makePuffs(condition === "cloudy" ? 6 : 3, width, height)
        : [];

    let flashUntil = 0;
    let nextFlash = condition === "thunderstorm" ? performance.now() + 2000 + Math.random() * 3000 : Infinity;

    let raf = 0;
    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      if (condition === "fog") {
        for (let i = 0; i < 4; i++) {
          const bandY = (height / 4) * i + ((now / 60) % height);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(0, bandY % height, width, 40);
        }
      }

      for (const p of puffs) {
        p.x += p.speed;
        if (p.x > width + 80) p.x = -80;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        const s = p.scale;
        // Each ellipse gets its own beginPath/fill so canvas doesn't draw an
        // implicit connecting line between disjoint subpaths.
        for (const [ox, oy, rx, ry] of [
          [0, 0, 34 * s, 18 * s],
          [26 * s, -6 * s, 26 * s, 15 * s],
          [-26 * s, 4 * s, 22 * s, 13 * s],
        ]) {
          ctx.beginPath();
          ctx.ellipse(p.x + ox, p.y + oy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = "rgba(200,220,255,0.7)";
      ctx.lineWidth = 1.5;
      for (const d of drops) {
        d.y += d.speed;
        d.x += d.drift;
        if (d.y > height) {
          d.y = -10;
          d.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.drift * 2, d.y + d.len);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (const f of flakes) {
        f.y += f.speed;
        f.sway += f.swaySpeed;
        const drawX = f.x + Math.sin(f.sway) * 12;
        if (f.y > height) {
          f.y = -5;
          f.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(drawX, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (condition === "thunderstorm") {
        if (now > nextFlash) {
          flashUntil = now + 90;
          nextFlash = now + 2500 + Math.random() * 4000;
        }
        if (now < flashUntil) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fillRect(0, 0, width, height);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [condition]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
