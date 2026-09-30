import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";

/** The web canvas scaled the plate as min(w, h) / 2 / 176, so 176 is the half-width. */
export const ROSETTE_EXTENT = 176;

/** Each lathe layer as its own path, so layers keep their own opacity and cut speed. */
export function rosetteLayerPaths(): string[] {
  return ROSETTE_LAYERS.map((layer) => {
    const pts = rosettePoints(layer);
    let d = "";
    for (let i = 0; i < pts.length; i += 2) {
      d += `${i === 0 ? "M" : "L"}${pts[i].toFixed(1)} ${pts[i + 1].toFixed(1)}`;
    }
    return d;
  });
}
