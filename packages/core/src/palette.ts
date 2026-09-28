/**
 * Identity colours for categories, accounts and goals. Stored as literal hex on
 * the row — not `var(--chart-n)` — because the value has to survive a theme
 * switch.
 *
 * These serve two jobs, and every value is validated for both (see
 * lib/palette.test.ts, which fails the build if a future edit breaks it):
 *
 *   1. Tile FILL behind a white glyph  -> >= 3:1 against #ffffff
 *   2. Chip FOREGROUND on either card  -> >= 3:1 against #ffffff and #16161f
 *
 * The tightest are amber and olive at 3.05:1 against white. 3:1 covers glyphs,
 * icons and large text; it does not cover small body text on a filled tile.
 *
 * These are hue-matched to the sixteen they replaced, so an existing category
 * keeps its identity and only gains saturation. The matching database rewrite
 * is supabase/migrations/20260804120000_brighten_palette.sql. Until the user
 * pushes it, rows still hold the old values — every consumer must therefore
 * treat a stored colour as an arbitrary hex, never as an index into this array.
 */
export const SWATCHES = [
  "#4361F0", "#CE830A", "#00A08A", "#E85B3F", "#9B4FBC", "#899C39", "#1A96CE", "#DB4A76",
  "#CE7A38", "#98912B", "#4AA331", "#309E54", "#8471E8", "#C752B0", "#E0666C", "#8A8698",
];

