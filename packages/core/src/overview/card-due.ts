/** Pure helpers behind the credit-card row in Overview's "Upcoming" list.
 *  Kept out of queries.ts so they can be tested without a Supabase client. */

/** Day after an ISO date, as `YYYY-MM-DD`. A statement's closing date belongs
 *  to the statement, so "settles this statement" starts the following day. */
export function dayAfter(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** What a card still owes for its current cycle, in the card's own currency.
 *
 *  With a statement: its balance less payments made since it closed, so the row
 *  counts down as you pay. Without one: `owed`, the live card balance, which the
 *  card-sync trigger already keeps net of payments.
 *
 *  Returns null when there is nothing left to pay — sub-cent remainders are
 *  rounding, not debt, and a settled card drops off the list entirely. It comes
 *  back on its own at the next import, which brings a fresh balance and due date.
 */
export function cardAmountDue(
  statementBalance: number | null,
  owed: number | null,
  paidSinceStatement: number,
): number | null {
  const due = statementBalance != null ? Number(statementBalance) - paidSinceStatement : Number(owed ?? 0);
  return due >= 0.01 ? due : null;
}
