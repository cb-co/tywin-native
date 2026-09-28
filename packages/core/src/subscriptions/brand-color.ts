import { HEX6, relativeLuminance } from "../color";

/**
 * A subscription's brand colour, when one has been resolved.
 *
 * There is deliberately NO default hex here, unlike DEFAULT_CARD_ACCENT. A card
 * face is a rectangle that has to be *some* colour, so an unresolved card needs
 * a stand-in. A subscription's mark is a small avatar sitting on a card surface,
 * and its unresolved state already has a correct answer: the theme's own accent
 * token, which follows light and dark. Inventing a fixed hex for that case would
 * mean picking one theme to look right in.
 *
 * So callers ask `hasBrandColor` and either style from the stored value or leave
 * the theme's accent alone.
 */
export function hasBrandColor(color: string | null | undefined): boolean {
  return !!color && HEX6.test(color);
}

/**
 * The luminance of #E8E8E8, the lightest colour the brand mark can survive.
 *
 * The mark is a filled disc on a card surface. A near-white fill makes it vanish
 * into that surface, so it reads as a failed render rather than as a brand — the
 * reason the model is told never to answer with one (lib/subscriptions/llm/brand).
 */
const NEAR_WHITE = relativeLuminance("#e8e8e8");

/**
 * Whether a colour can be used as a brand fill.
 *
 * Applied to colours that arrive from Simple Icons, not to the model's. The
 * model is already instructed away from near-white and its answer is the only
 * one available when the icon set has no entry, so rejecting it here would trade
 * a pale mark for no colour at all. An icon's official hex has an alternative —
 * whatever the model said — so it can afford to be judged.
 */
export function usableBrandColor(hex: string): boolean {
  return HEX6.test(hex) && relativeLuminance(hex) < NEAR_WHITE;
}
