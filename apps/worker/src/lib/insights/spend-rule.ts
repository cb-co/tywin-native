/**
 * Mirrors `spend_distribution`'s SQL inclusion rule
 * (20260822143000_accrual_spend_insights.sql): an expense counts the moment
 * it happens, from whatever account; a payment counts only when it retires a
 * loan. A card payment is excluded because the charges behind it are already
 * counted directly as expenses — counting both would double-count. A
 * transfer between two of the user's own accounts is not spending at all.
 */
export function isInsightsSpend(txn: { type: string; toAccountType: string | null }): boolean {
  return txn.type === "expense" || (txn.type === "payment" && txn.toAccountType === "loan");
}
