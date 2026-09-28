export function meterFill(used: number, total: number) {
  if (!Number.isFinite(total) || !(total > 0)) return { pct: 0, over: false };
  if (used === Infinity) return { pct: 100, over: true };
  const u = Number.isFinite(used) ? used : 0;
  const raw = (u / total) * 100;
  return { pct: Math.min(Math.max(raw, 0), 100), over: raw > 100 };
}
