/**
 * Net worth in base currency: every account balance, minus what every
 * credit card owes, minus every loan's outstanding balance. Extracted from
 * lib/overview/queries.ts so the Overview hero and the Accounts page can
 * never disagree about what net worth means.
 */
export function netWorthTotal(
  balances: { balance: number | string | null; currency: string | null }[],
  cards: { owed: number | string | null; currency: string | null }[],
  loans: { outstanding_balance: number | string | null; currency: string | null }[],
  baseCurrency: string,
  toBase: (amount: number, currency: string) => number,
): number {
  return (
    balances.reduce((s, b) => s + toBase(Number(b.balance), b.currency ?? baseCurrency), 0) -
    cards.reduce((s, c) => s + toBase(Number(c.owed ?? 0), c.currency ?? baseCurrency), 0) -
    loans.reduce(
      (s, l) => s + toBase(Number(l.outstanding_balance ?? 0), l.currency ?? baseCurrency),
      0,
    )
  );
}
