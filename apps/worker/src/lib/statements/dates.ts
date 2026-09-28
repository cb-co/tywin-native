export function ddmmyyyyToIso(s: string): string {
  const m = s.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!m) throw new Error(`unparseable date: "${s}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function monthBeforePlusDay(cutoffIso: string): string {
  const year = Number(cutoffIso.slice(0, 4));
  const month = Number(cutoffIso.slice(5, 7)); // 1-based
  const day = Number(cutoffIso.slice(8, 10));
  // Day count of the PREVIOUS month; a cutoff day beyond it clamps to its last day.
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month - 2, Math.min(day, prevMonthDays)));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
