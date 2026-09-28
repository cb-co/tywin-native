/**
 * Currency conversion for point-in-time balances (net worth, upcoming
 * subscription totals) into the user's base currency. Transactions are deliberately
 * excluded from this — they lock in the rate at the time they occurred
 * (see `transactions.exchange_rate` / `base_amount`) and must not be re-converted here.
 *
 * `rates` always maps a quote currency to units of it per 1 unit of `base`. The API
 * fetches and caches the table (apps/worker/src/lib/fx.ts); everything here is the
 * arithmetic both sides share.
 */

/**
 * Convert `amount` from `currency` into `base` using `rates` (as returned by
 * getExchangeRates(base)). Falls back to 1:1 if a rate is missing (e.g. the FX
 * request failed) rather than dropping the amount from the total.
 */
export function convertToBase(
  amount: number,
  currency: string,
  base: string,
  rates: Record<string, number>,
): number {
  if (currency === base) return amount;
  const rate = rates[currency];
  return rate ? amount / rate : amount;
}

/**
 * Base-currency units per 1 unit of `currency` — the direction the DB stores
 * `transactions.exchange_rate` / `card_statements.exchange_rate` in.
 *
 * Falls back to 1 when the rate is missing (failed FX request), matching
 * convertToBase: a total that's off is better than a row that won't save.
 */
export function baseRate(currency: string, base: string, rates: Record<string, number>): number {
  if (currency === base) return 1;
  const rate = rates[currency];
  return rate ? 1 / rate : 1;
}

/**
 * Units of `to` per 1 unit of `from`, derived from two base-relative rates.
 * Null when either leg is unknown — callers show a market-rate hint, and a
 * wrong hint is worse than none.
 */
export function crossRate(
  from: string,
  to: string,
  rates: Record<string, number>,
): number | null {
  if (from === to) return 1;
  const f = rates[from];
  const t = rates[to];
  if (!f || !t) return null;
  return t / f;
}

/**
 * The subset of `currencies` that got converted at 1:1 because `rates` has no
 * entry for them — i.e. every currency whose presence makes a base-currency
 * total silently wrong.
 *
 * `convertToBase` degrades quietly on purpose: a total that is off beats a
 * total that drops a holding. But quiet is only acceptable if the screen says
 * so, and the screen can only say so if it knows which currencies were faked.
 * The base currency is never in the result — it needs no rate.
 */
export function unconvertedCurrencies(
  currencies: Iterable<string | null | undefined>,
  base: string,
  rates: Record<string, number>,
): string[] {
  const missing = new Set<string>();
  for (const currency of currencies) {
    if (!currency || currency === base) continue;
    if (!rates[currency]) missing.add(currency);
  }
  return [...missing].sort();
}
