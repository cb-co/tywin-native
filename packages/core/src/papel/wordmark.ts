/**
 * The "cigua" wordmark: soft, rounded, lowercase, drawn as monoline strokes
 * with round caps (x-height 40, stroke 9). It is outlined geometry, not a
 * font, so it loads nothing and takes any ink. This is the one deliberate
 * exception to the One Face Rule: the wordmark is a drawn mark, like the Seal,
 * not typeset copy.
 */
export const WORDMARK_VIEWBOX = "0 -15 193 78";
export const WORDMARK_RATIO = 193 / 78;
export const WORDMARK_STROKE = 9;

/** One stroke of the mark. `x` shifts a letter along the baseline; `fill` marks the i's dot. */
export type WordmarkPart =
  | { kind: "path"; d: string; x: number }
  | { kind: "circle"; cx: number; cy: number; r: number; x: number; fill?: boolean };

export const WORDMARK_PARTS: WordmarkPart[] = [
  // c
  { kind: "path", d: "M30.96 9.04 A15.5 15.5 0 1 0 30.96 30.96", x: 0 },
  // i: stem, then the dot
  { kind: "path", d: "M50.5 4.5 V35.5", x: 0 },
  { kind: "circle", cx: 50.5, cy: -9, r: 5, x: 0, fill: true },
  // g: bowl, right stem, descender hook
  { kind: "circle", cx: 20, cy: 20, r: 15.5, x: 61 },
  { kind: "path", d: "M35.5 20 V45 C35.5 53 29.5 57 22 57 C17 57 13 55.5 10 52.5", x: 61 },
  // u
  { kind: "path", d: "M4.5 4.5 V20 A15.5 15.5 0 0 0 35.5 20 V4.5 M35.5 20 V32", x: 107 },
  // a
  { kind: "circle", cx: 20, cy: 20, r: 15.5, x: 153 },
  { kind: "path", d: "M35.5 4.5 V32", x: 153 },
];
