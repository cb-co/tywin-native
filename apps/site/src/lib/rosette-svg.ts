import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";
import { BRAND_TILE } from "@cigua/core/papel/brand-tile";

/** The web canvas scaled the plate as min(w, h) / 2 / 176, so 176 is the half-width. */
export const ROSETTE_EXTENT = 176;

/* Every 12th lathe point. The full curve is ~40k points (~480 KB inline); at the
   logo's nav and footer sizes (28–36px) the plate is a texture, and the coarse
   path is indistinguishable from it. */
const STEP = 12;

/** The brand tile's plate (see @cigua/core/papel/brand-tile) in its 64 box,
 *  mapped the way the app maps it: the canvas's 176 half-width onto the plate's radius. */
export function tilePlatePath(): string {
  const scale = (32 * BRAND_TILE.plate) / ROSETTE_EXTENT;
  return ROSETTE_LAYERS.slice(0, BRAND_TILE.plateLayers)
    .map((layer) => {
      const pts = rosettePoints(layer);
      let d = "";
      for (let i = 0; i < pts.length; i += 2 * STEP) {
        d += `${i === 0 ? "M" : "L"}${(32 + pts[i] * scale).toFixed(1)} ${(32 + pts[i + 1] * scale).toFixed(1)}`;
      }
      return d + "Z";
    })
    .join("");
}
