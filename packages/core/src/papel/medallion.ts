import { BIRD_BODY, BIRD_WING } from "./bird";
import { ROSETTE_LAYERS, rosettePoints } from "./rosette";

/**
 * The Cigua mark: the seal inside an outer guilloche ring. One drawing for the
 * app header, the site's logo and favicon, the app icon and the logo files in
 * design/logo. Shares of a 64 box.
 */
export const MEDALLION = {
  /** Ring diameter. */
  plate: 0.94,
  /** Seal diameter. Large enough for the bird to read at 32px. */
  seal: 0.6,
  /** Only the plate's outer layer (ROSETTE_LAYERS[0]): all three merge into a
   *  flat band at chrome size, one still reads as engraved line work. */
  plateLayers: 1,
  plateOpacity: 0.55,
} as const;

/** Chrome: 16–48px (header, nav, favicon). Print: icons and logo files. */
export type MedallionSize = "chrome" | "print";

/** Ring line width in the 64 box: about a third of a pixel at 32px, and a
 *  hairline that stays visible at 1024px. */
const LINE: Record<MedallionSize, number> = { chrome: 0.7, print: 0.16 };

/** Every Nth lathe point. At chrome size the ring is a texture and a coarse
 *  path is indistinguishable from it (and small enough to inline on every
 *  page); at print size every point is kept so the curves stay smooth. */
const STEP: Record<MedallionSize, number> = { chrome: 12, print: 1 };

/** The bird's line in the seal's own 64 box. Print halves the chrome weight,
 *  which only needs to be that heavy to survive 16–32px. */
const BIRD_LINE: Record<MedallionSize, number> = { chrome: 2.3, print: 1.15 };

/** The live plate maps its 176 half-width onto the box, so the ring does too. */
const EXTENT = 176;

export function medallionPlatePath(size: MedallionSize): string {
  const scale = (32 * MEDALLION.plate) / EXTENT;
  const digits = size === "print" ? 2 : 1;
  return ROSETTE_LAYERS.slice(0, MEDALLION.plateLayers)
    .map((layer) => {
      const pts = rosettePoints(layer);
      let d = "";
      for (let i = 0; i < pts.length; i += 2 * STEP[size]) {
        d += `${i === 0 ? "M" : "L"}${(32 + pts[i] * scale).toFixed(digits)} ${(32 + pts[i + 1] * scale).toFixed(digits)}`;
      }
      return d + "Z";
    })
    .join("");
}

/** The mark as one SVG string. Colours are passed in, so a page can use its
 *  tokens and a file its literal values. */
export function medallionSvg({
  plate,
  disc,
  ink,
  size = "chrome",
  attrs = "",
  style = "",
}: {
  /** Stroke of the guilloche ring. */
  plate: string;
  /** The seal's disc. */
  disc: string;
  /** The seal's rings and bird. */
  ink: string;
  size?: MedallionSize;
  /** Extra attributes on the root <svg> (xmlns, width, x/y when nested). */
  attrs?: string;
  /** CSS inside the SVG; the ring's path carries class="plate". */
  style?: string;
}): string {
  const seal = 64 * MEDALLION.seal;
  const o = 32 - seal / 2;
  return (
    `<svg viewBox="0 0 64 64" fill="none"${attrs ? ` ${attrs}` : ""}>` +
    (style ? `<style>${style}</style>` : "") +
    `<path class="plate" d="${medallionPlatePath(size)}" stroke="${plate}" stroke-width="${LINE[size]}" stroke-linejoin="round" opacity="${MEDALLION.plateOpacity}"/>` +
    `<g transform="translate(${o} ${o}) scale(${seal / 64})" stroke="${ink}">` +
    // The outer ring's edge is the disc's edge, so the plate runs straight
    // into it; the disc stops under the ring to leave no antialiased fringe.
    `<circle cx="32" cy="32" r="31.1" fill="${disc}" stroke="none"/>` +
    `<circle cx="32" cy="32" r="31.1" stroke-width="1.8"/>` +
    `<circle cx="32" cy="32" r="22" stroke-width="1.4"/>` +
    `<g transform="translate(-0.8 0.2)" stroke-width="${BIRD_LINE[size]}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${BIRD_WING}"/><path d="${BIRD_BODY}"/>` +
    `</g></g></svg>`
  );
}
