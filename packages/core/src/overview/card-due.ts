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

/** A card's statement split into the two figures that matter before its due
 *  date. Both are in the card's own currency and both count down as you pay. */
export type CardDue = {
  /** The cutoff balance still standing: {@link cardAmountDue}. */
  balance: number;
  /** What is left of the printed minimum, clamped to `balance`; 0 once
   *  payments since the statement cover it. Null when there is no statement or
   *  the bank printed no minimum — never inferred from a percentage. */
  minimum: number | null;
};

/** The minimum is the real deadline (miss it and the bank charges a late fee
 *  and reports it); the rest of the cutoff balance only decides whether
 *  interest accrues. Null once the statement is settled, like cardAmountDue. */
export function cardDue(
  statementBalance: number | null,
  owed: number | null,
  paidSinceStatement: number,
  minimumPayment: number | null,
): CardDue | null {
  const balance = cardAmountDue(statementBalance, owed, paidSinceStatement);
  if (balance == null) return null;
  if (statementBalance == null || minimumPayment == null) return { balance, minimum: null };
  const left = Math.min(Math.max(Number(minimumPayment) - paidSinceStatement, 0), balance);
  return { balance, minimum: left >= 0.01 ? left : 0 };
}
