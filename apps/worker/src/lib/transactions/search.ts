/** Turning the ledger's one search box into PostgREST filter terms.
 *
 *  Kept apart from queries.ts so the parsing rules — which decide what a user
 *  gets back — can be tested without a Supabase client. */

/**
 * Quote a value going into a PostgREST `or=` list.
 *
 * That list is split on commas and reads parentheses as grouping, so a
 * description containing either would silently become extra filter terms.
 * Double quotes protect both; inner quotes and backslashes escape.
 */
export function orValue(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * The amount a search query is looking for, or null if it isn't looking for one.
 *
 * Only a query that is *entirely* numeric counts. "1,500.50" is someone
 * hunting for a figure, but the 50 in "café 50" is not — widening the search by
 * it would pull in every RD$50 row in the ledger and bury what they asked for.
 */
export function searchAmount(query: string): number | null {
  const q = query.trim();
  if (!q || !/^[\d.,\s$]*\d[\d.,\s$]*$/.test(q)) return null;
  // Thousands separators and currency marks are noise; the decimal point is
  // whatever the last separator is, which for both es-DO and en-US is ".".
  const n = Number(q.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * The `or=` terms for a search box query.
 *
 * Description carries the merchant — there is no separate column for it — and
 * notes is where someone writes what a cryptic statement line actually was.
 * A numeric query also matches the figures: `amount` and `total_amount`,
 * because the charge a user remembers is the one that hit the account, tax and
 * fee included.
 */
export function searchTerms(query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  const like = orValue(`%${q}%`);
  const terms = [`description.ilike.${like}`, `notes.ilike.${like}`];
  const amount = searchAmount(q);
  if (amount !== null) terms.push(`amount.eq.${amount}`, `total_amount.eq.${amount}`);
  return terms;
}
