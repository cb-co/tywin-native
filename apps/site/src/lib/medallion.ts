import { BIRD_BODY, BIRD_WING } from "@cigua/core/papel/bird";
import { BRAND_TILE as T } from "@cigua/core/papel/brand-tile";
import { tilePlatePath } from "./rosette-svg";

/**
 * The site's mark (nav, footer, legal pages, favicon): the seal inside an outer
 * guilloche ring, the app header's tile without the tile. Colours are passed in
 * so the page can use its tokens and the favicon literal values.
 */
export function medallionSvg({
  plate,
  disc,
  ink,
  attrs = "",
  style = "",
}: {
  /** Stroke of the guilloche ring. */
  plate: string;
  /** The seal's disc. */
  disc: string;
  /** The seal's rings and bird. */
  ink: string;
  attrs?: string;
  /** CSS inside the SVG; the ring's path carries class="plate". */
  style?: string;
}): string {
  const seal = 64 * T.seal;
  const o = 32 - seal / 2;
  return (
    `<svg viewBox="0 0 64 64" fill="none"${attrs ? ` ${attrs}` : ""}>` +
    (style ? `<style>${style}</style>` : "") +
    `<path class="plate" d="${tilePlatePath()}" stroke="${plate}" stroke-width="${T.plateLine}" stroke-linejoin="round" opacity="${T.plateOpacity}"/>` +
    `<g transform="translate(${o} ${o}) scale(${seal / 64})" stroke="${ink}">` +
    `<circle cx="32" cy="32" r="32" fill="${disc}" stroke="none"/>` +
    `<circle cx="32" cy="32" r="30.5" stroke-width="1.8"/>` +
    `<circle cx="32" cy="32" r="22" stroke-width="1.4"/>` +
    `<g transform="translate(-0.8 0.2)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${BIRD_WING}"/><path d="${BIRD_BODY}"/>` +
    `</g></g></svg>`
  );
}
