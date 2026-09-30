import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";

/** The web canvas scaled the plate as min(w, h) / 2 / 176, so 176 is the half-width. */
export const ROSETTE_EXTENT = 176;

/* Every 12th lathe point. The full curve is ~40k points (~480 KB inline); at the
   seal's nav and footer sizes (32px) the ring is a texture, and the coarse path
   is indistinguishable from it. */
const SEAL_STEP = 12;

/** The seal's engraved ring in its 64 box, coarse enough to inline on every page. */
export function sealRingPath(size = 64): string {
  const extent = Math.max(...ROSETTE_LAYERS.map((l) => l.R - l.r + l.d));
  const scale = (size / 2 - 1) / extent;
  const c = size / 2;
  return ROSETTE_LAYERS.map((layer) => {
    const pts = rosettePoints(layer);
    let d = "";
    for (let i = 0; i < pts.length; i += 2 * SEAL_STEP) {
      d += `${i === 0 ? "M" : "L"}${(c + pts[i] * scale).toFixed(1)} ${(c + pts[i + 1] * scale).toFixed(1)}`;
    }
    return d + "Z";
  }).join("");
}
