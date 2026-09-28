/**
 * Cashback earned in a calendar year, summed from statements.
 *
 * The sum is over STATEMENTS, not over transactions, and that is the whole
 * idempotency story. `card_statements` is unique on (account_id, period_end)
 * and the import RPC replaces the row for a closing date it already has, so
 * re-uploading the same PDF overwrites one row rather than adding one — the
 * total cannot double-count, and no running accumulator exists to drift out of
 * step with the statements behind it. Each new statement simply sums on.
 *
 * A statement belongs to the year of its CLOSING date (period_end), the same
 * date the balance anchor is keyed by. A period straddling New Year is counted
 * once, in the year it closed, rather than split across two.
 *
 * `cashback_total` is null on every statement imported before the field
 * existed, and on any statement whose source reported no cashback; null
 * contributes nothing. That is deliberately not the same as a reported 0.00,
 * which also contributes nothing but proves the statement was read.
 *
 * UNDEFINED is a third case and the reason these functions test for a number
 * rather than for null. `select("*")` against a database where the migration
 * has not been applied yet returns rows with no such key at all — the code can
 * ship ahead of the migration — and a `!== null` test would wave that through
 * and render a confident "0.00 earned" built on a column that doesn't exist.
 * Only an actual number counts as reported.
 *
 * A statement's own cashback lines (lib/statements/credit-kind.ts) win over its
 * printed figure; the two describe the same money, so they are never added.
 */
export interface CashbackStatement {
  id: string;
  period_end: string;
  cashback_total: number | null | undefined;
}

/** Σ cashback line amounts per statement id, as positive magnitudes. */
export type LineCashback = ReadonlyMap<string, number>;

function statementCashback(s: CashbackStatement, fromLines: LineCashback): number | null {
  const lines = fromLines.get(s.id) ?? 0;
  if (lines > 0) return lines;
  return typeof s.cashback_total === "number" ? s.cashback_total : null;
}

export function yearCashback(
  statements: CashbackStatement[],
  year: number,
  fromLines: LineCashback,
): number {
  const prefix = `${year}-`;
  return statements.reduce(
    (sum, s) => (s.period_end.startsWith(prefix) ? sum + (statementCashback(s, fromLines) ?? 0) : sum),
    0,
  );
}

/** True when at least one statement in the year actually reported a figure.
 *  Distinguishes "no cashback earned" from "nothing imported that knows about
 *  cashback" — the surfaces stay silent for the latter rather than claiming a
 *  confident zero. */
export function hasReportedCashback(
  statements: CashbackStatement[],
  year: number,
  fromLines: LineCashback,
): boolean {
  const prefix = `${year}-`;
  return statements.some(
    (s) => s.period_end.startsWith(prefix) && statementCashback(s, fromLines) !== null,
  );
}
