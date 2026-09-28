import { HEX6 } from "../color";

/**
 * The fallback card accent: a deep, unsaturated finance blue.
 *
 * This is what a card face uses when no accent has been resolved for it — a
 * brand-new card whose inference has not run yet, one whose name the model
 * could not place, or one created before card art existed at all. It has to
 * look deliberate rather than like a missing value, because for some cards it
 * is the permanent answer.
 *
 * Deliberately NOT the brand violet. The violet is the app's own colour; a card
 * is the issuer's object, and defaulting it to the product's brand made every
 * unresolved card look like Cigua merchandise.
 */
export const DEFAULT_CARD_ACCENT = "#1B4B8F";

/* Re-exported from the colour module, which is where it moved once
   subscriptions needed the same guard. Kept exported here so the card-art
   callers can go on importing their validator from the module that owns their
   colour. */
export { HEX6 };

/** True when a stored accent is present and usable as-is. */
export function hasCardAccent(color: string | null | undefined): boolean {
  return !!color && HEX6.test(color);
}
