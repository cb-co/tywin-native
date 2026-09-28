/** Eight hatch grammars, one per `--chart-N` slot. Angle in degrees, gap in
 *  px between rules. The rule is drawn vertical, then rotated: angle 90 =
 *  horizontal, 0 = vertical. Distinct on angle or density so two series never differ
 *  by colour alone. */
export const HATCHES = [
  { angle: 90, gap: 5 }, // 1 horizontal
  { angle: 45, gap: 5 }, // 2 rising
  { angle: 0, gap: 5 }, // 3 vertical
  { angle: 45, gap: 3 }, // 4 fine rising (cross-hatch is drawn on top in PlateDefs)
  { angle: 135, gap: 5 }, // 5 falling
  { angle: 90, gap: 3 }, // 6 fine horizontal
  { angle: 0, gap: 3 }, // 7 fine vertical
  { angle: 135, gap: 3 }, // 8 fine falling
] as const;

export function hatchFor(index: number) {
  const i = ((Math.floor(index) % 8) + 8) % 8;
  return { slot: i + 1, ...HATCHES[i] };
}
