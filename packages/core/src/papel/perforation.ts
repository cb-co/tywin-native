/**
 * Cuotas as cells. Up to `max` installments draw one cell each; a longer term
 * is scaled down so the strip always spans the whole loan and the punched
 * share matches the paid share (a 48-month loan 10 paid shows ~5 of 24, not a
 * strip that looks 40% done because the cap clipped it). `hidden` stays for
 * callers that render an overflow count; it is always 0 now.
 */
export function perforationCells(total: number, paid: number, max = 24) {
  if (!Number.isFinite(total) || total <= 0) return { cells: [], hidden: 0 };
  const n = Math.floor(total);
  const p = Math.min(Math.max(Math.floor(paid) || 0, 0), n);
  const drawn = Math.min(n, max);
  // Any progress shows at least one cell; only a finished loan fills the strip.
  const punched = drawn === n ? p : p >= n ? drawn : Math.min(drawn - 1, Math.max(p > 0 ? 1 : 0, Math.round((p / n) * drawn)));
  return {
    cells: Array.from({ length: drawn }, (_, index) => ({ index, paid: index < punched })),
    hidden: 0,
  };
}
