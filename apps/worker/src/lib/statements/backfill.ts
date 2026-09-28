export type CardBackfill = {
  statement_closing_day?: number;
  payment_due_day?: number;
  credit_limit?: number;
};

type BackfillAccount = {
  statement_closing_day: number | null;
  payment_due_day: number | null;
  credit_limit: number | null;
};

type BackfillSection = {
  periodEnd: string;
  dueDate: string | null;
  creditLimitCents: number | null;
};

/** Sliced, not parsed: `new Date("2026-08-01")` is 31 July at any negative UTC
 *  offset, which is every timezone this product ships to. */
function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/**
 * What a statement section can teach an account about itself.
 *
 * Fills nulls only. A limit the user typed outranks the statement's, because on a
 * multi-line card the printed figure is the limit of one line rather than the card,
 * and a user who corrected it once should not have to correct it every month.
 */
export function cardBackfillFromSection(
  account: BackfillAccount,
  section: BackfillSection,
): CardBackfill {
  const patch: CardBackfill = {};
  if (account.statement_closing_day === null)
    patch.statement_closing_day = dayOfMonth(section.periodEnd);
  if (account.payment_due_day === null && section.dueDate)
    patch.payment_due_day = dayOfMonth(section.dueDate);
  if (account.credit_limit === null && section.creditLimitCents !== null)
    patch.credit_limit = section.creditLimitCents / 100;
  return patch;
}
