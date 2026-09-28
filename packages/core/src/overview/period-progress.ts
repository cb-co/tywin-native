import type { Period } from "../period/cycle";

const DAY = 86_400_000;
const days = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Where `today` sits inside a period: 1-based `day`, inclusive `total`, and
 *  `pos` in 0..1 along the timeline. Clamped, so a stale `today` never draws
 *  the marker off the edge. */
export function periodProgress(period: Period, today: string) {
  const total = days(period.start, period.end) + 1;
  const day = Math.min(Math.max(days(period.start, today) + 1, 1), total);
  return { day, total, pos: total > 1 ? (day - 1) / (total - 1) : 0 };
}
