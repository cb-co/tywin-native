/**
 * What recurs each month, as base-currency figures.
 *
 * Two totals rather than one, because "recurring" is two questions with
 * different answers: what leaves every month (expenses and the payments that
 * settle cards and loans) and what arrives (paychecks). Netting them into a
 * single number answers neither — a person looking at it cannot tell a raise
 * from a cancelled subscription.
 *
 * Every amount is CONVERTED BEFORE IT IS SUMMED. This used to be a raw
 * reduce over `amount`, so a DOP 1,500 gym membership and a USD 15.99
 * subscription totalled "US$1,515.99 a month" — three currencies' digits added
 * as if they were one. Conversion falls back to 1:1 on a missing rate (see
 * lib/fx), which keeps the row in the total rather than dropping it; callers
 * that care surface `unconvertedCurrencies` alongside the figure.
 */

import { convertToBase } from "../fx";
import { monthlyEquivalent, type BillingCycle } from "./cycle";

/** The subset of a subscription row a total actually reads. */
export type TotalsRow = {
  amount: number;
  currency: string;
  billing_cycle: string;
  kind: string;
  is_active: boolean;
};

export type RecurringTotals = {
  /** Expenses and payments — what recurs out. */
  outgoing: number;
  /** Income templates — what recurs in. */
  income: number;
};

/**
 * Paused templates count toward neither total. They stay visible in the list,
 * dimmed, because a paused subscription is still a thing you own — but it is
 * not money moving, and a total that counted it would overstate every month.
 */
export function recurringTotals(
  rows: readonly TotalsRow[],
  baseCurrency: string,
  rates: Record<string, number>,
): RecurringTotals {
  const totals: RecurringTotals = { outgoing: 0, income: 0 };

  for (const row of rows) {
    if (!row.is_active) continue;
    const monthly = convertToBase(
      monthlyEquivalent(row.amount, row.billing_cycle as BillingCycle),
      row.currency,
      baseCurrency,
      rates,
    );
    if (row.kind === "income") totals.income += monthly;
    else totals.outgoing += monthly;
  }

  return totals;
}
