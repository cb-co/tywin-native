/** The fields `amountDisplay` reads — a structural slice of a ledger row, so
 *  tests need not build a whole joined row. */
export type AmountTxn = {
  type: string;
  amount: number;
  total_amount: number;
  to_amount: number | null;
  currency: string;
  statement_line_id: string | null;
  to_account_id: string | null;
  to_account: { currency: string } | null;
};

export type AmountDisplay = {
  /** Always a non-negative magnitude; the sign is printed separately. */
  value: number;
  currency: string;
  sign: "+" | "−" | "";
  /** Money arriving. Only these figures go through the figure mask. */
  income: boolean;
};

/** A statement-sourced expense with a negative amount: a refund or cashback credit. */
export function isStatementCredit(txn: {
  type: string;
  statement_line_id: string | null;
  total_amount: number;
}): boolean {
  return txn.type === "expense" && !!txn.statement_line_id && Number(txn.total_amount) < 0;
}

/**
 * What a ledger row prints as its figure. A statement-sourced expense can be
 * negative (refund, rebate, reversal), which arrives as money in. A payment
 * seen from its destination account shows the destination leg, or a
 * cross-currency payment would show the wrong currency's number there.
 */
export function amountDisplay(txn: AmountTxn, viewAccountId?: string): AmountDisplay {
  if (isStatementCredit(txn)) {
    return { value: Math.abs(txn.total_amount), currency: txn.currency, sign: "+", income: true };
  }
  if (txn.type === "income") {
    return { value: Math.abs(txn.amount), currency: txn.currency, sign: "+", income: true };
  }
  if (txn.type === "expense") {
    return { value: Math.abs(txn.total_amount), currency: txn.currency, sign: "−", income: false };
  }
  const isDestinationLeg = viewAccountId != null && txn.to_account_id === viewAccountId;
  return {
    value: Math.abs(isDestinationLeg ? (txn.to_amount ?? txn.amount) : txn.total_amount),
    currency: isDestinationLeg ? (txn.to_account?.currency ?? txn.currency) : txn.currency,
    sign: "",
    income: false,
  };
}

export type TitleTxn = {
  type: string;
  description: string | null;
  category: { name: string } | null;
  account: { name: string } | null;
};

/**
 * What a ledger row's title reads, when nothing tells it what to print
 * directly: the transaction's own description first, then its category,
 * then — for income specifically, which never carries a category — the
 * localized "Income" a caller passes in, then the account it posted to, and
 * finally a generic fallback. Shared by every place a transaction gets a
 * one-line title (the editable ledger row and the read-only drilldown
 * sheet), so the two can't quietly drift on what a blank row should say.
 */
export function transactionTitle(txn: TitleTxn, incomeLabel: string, fallbackLabel: string): string {
  return (
    txn.description ||
    txn.category?.name ||
    (txn.type === "income" ? incomeLabel : txn.account?.name) ||
    fallbackLabel
  );
}

/**
 * Month → day → rows. `occurred_at` is a calendar date stored as UTC
 * midnight, so the day key is read in UTC. Relies on the ledger arriving
 * sorted by date (same-month days contiguous).
 */
export function groupLedger<T extends { occurred_at: string }>(
  rows: T[],
  monthLabel: (year: number, month: number) => string,
): { monthKey: string; label: string; days: { day: string; rows: T[] }[] }[] {
  const months = new Map<string, Map<string, T[]>>();
  for (const r of rows) {
    const day = new Date(r.occurred_at).toISOString().slice(0, 10);
    const monthKey = day.slice(0, 7);
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const days = months.get(monthKey)!;
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(r);
  }
  return [...months.entries()].map(([monthKey, days]) => {
    const [y, m] = monthKey.split("-").map(Number);
    return {
      monthKey,
      label: monthLabel(y, m),
      days: [...days.entries()].map(([day, dayRows]) => ({ day, rows: dayRows })),
    };
  });
}
