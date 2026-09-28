import { contrastRatio, fromOklch, relativeLuminance, toOklch } from "../color";

/** The surface each theme's stamps are measured against: the one of that
 *  theme's two papers that gives user ink the LEAST contrast. */
export const STAMP_SURFACE = { light: "#eeebf5", dark: "#1d1829" } as const;

/**
 * The ink a user colour prints in on a given paper. The hue and chroma are
 * the user's; only lightness walks toward contrast until the glyph clears
 * 3:1. A colour that already clears it is returned exactly as stored.
 */
export function stampInk(hex: string, surface: string): string {
  if (contrastRatio(hex, surface) >= 3) return hex;
  const towardDark = relativeLuminance(surface) > 0.18;
  const base = toOklch(hex);
  for (let step = 1; step <= 50; step++) {
    const l = Math.min(1, Math.max(0, base.l + (towardDark ? -0.02 : 0.02) * step));
    const out = fromOklch({ ...base, l });
    if (contrastRatio(out, surface) >= 3) return out;
  }
  return towardDark ? "#000000" : "#ffffff";
}
