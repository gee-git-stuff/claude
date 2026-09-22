export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Linearly interpolates between two hex colors, t in [0,1]. */
export function mix(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace("#", ""), 16);
  const b = parseInt(hexB.replace("#", ""), 16);
  const lerp = (shift: number) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * t);
  };
  return `rgb(${lerp(16)}, ${lerp(8)}, ${lerp(0)})`;
}
