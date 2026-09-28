/**
 * A goal's progress as cells. `pct` is the share of the target that is saved
 * (0-100) and `backedShare` the share of that saving actually backed by
 * money (0-1); the rest is borrowed back. Solid cells come first, then
 * borrowed, then empty, so a goal spent into reads as hollowed out rather
 * than merely smaller. Any progress shows at least one cell and only a
 * complete goal fills the strip; a borrowed share, however small, keeps one
 * visible cell.
 */
export type GoalCell = "solid" | "borrowed" | "empty";

export function goalStripCells(pct: number, backedShare: number, n = 20): GoalCell[] {
  const p = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  const share = Number.isFinite(backedShare) ? Math.min(Math.max(backedShare, 0), 1) : 1;
  const filled = p >= 100 ? n : p <= 0 ? 0 : Math.min(n - 1, Math.max(1, Math.round((p / 100) * n)));
  const borrowed = filled === 0 || share >= 1 ? 0 : Math.min(filled, Math.max(1, Math.round(filled * (1 - share))));
  return Array.from({ length: n }, (_, i): GoalCell => (i < filled - borrowed ? "solid" : i < filled ? "borrowed" : "empty"));
}
