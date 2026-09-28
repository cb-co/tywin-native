export type Rosette = { R: number; r: number; d: number };

export const ROSETTE_LAYERS: Rosette[] = [
  { R: 144, r: 55, d: 78 },
  { R: 144, r: 55, d: 44 },
  { R: 120, r: 47, d: 96 },
];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function rosettePoints({ R, r, d }: Rosette): Float32Array {
  const turns = r / gcd(R, r);
  const steps = Math.round(turns * 260);
  const out = new Float32Array((steps + 1) * 2);
  const k = (R - r) / r;
  const span = Math.PI * 2 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * span;
    out[i * 2] = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    out[i * 2 + 1] = (R - r) * Math.sin(t) - d * Math.sin(k * t);
  }
  return out;
}

/** A static rosette as one SVG path, for places a canvas cannot go (the
 *  Seal, the app icon). Same curves as the live plate. */
export function rosettePath(size: number, layers: Rosette[] = ROSETTE_LAYERS): string {
  const extent = Math.max(...layers.map((l) => l.R - l.r + l.d));
  const scale = (size / 2 - 1) / extent;
  const c = size / 2;
  return layers
    .map((layer) => {
      const pts = rosettePoints(layer);
      let d = "";
      for (let i = 0; i < pts.length; i += 2) {
        const x = (c + pts[i] * scale).toFixed(2);
        const y = (c + pts[i + 1] * scale).toFixed(2);
        d += `${i === 0 ? "M" : "L"}${x} ${y}`;
      }
      return d + "Z";
    })
    .join("");
}
