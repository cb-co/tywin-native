export type AttentionInput = {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  brand: string | null;
  last4: string | null;
  /** The newest statement's due date, or the account's own `payment_due_day`-derived date. */
  dueDate: string | null;
  overdueAmount: number | null;
  overdueInstallments: number | null;
  /** Uncategorised lines still sitting in the newest import that touched this account. */
  pendingTriageCount: number;
};

export type AttentionReason = "due-soon" | "overdue" | "untriaged";

export type AttentionItem = {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  brand: string | null;
  last4: string | null;
  reason: AttentionReason;
  dueDate: string | null;
  pendingTriageCount: number;
};

/**
 * What belongs on the Accounts page's attention ledger: whatever needs a
 * decision, ranked overdue > due soon > still-uncategorised. Every signal
 * here already exists in the data the app has (card_statements.overdue_*,
 * card_status.latest_due_date, import triage) — nothing is invented or
 * guessed, per PRODUCT.md's "refuse rather than guess" principle.
 */
export function accountsNeedingAttention(
  accounts: AttentionInput[],
  today: string,
  dueWithinDays = 7,
): AttentionItem[] {
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + dueWithinDays);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const items: AttentionItem[] = [];
  for (const a of accounts) {
    const overdue = (a.overdueAmount ?? 0) > 0 || (a.overdueInstallments ?? 0) > 0;
    const dueSoon = a.dueDate !== null && a.dueDate >= today && a.dueDate <= horizonISO;
    const untriaged = a.pendingTriageCount > 0;

    let reason: AttentionReason | null = null;
    if (overdue) reason = "overdue";
    else if (dueSoon) reason = "due-soon";
    else if (untriaged) reason = "untriaged";

    if (reason) {
      items.push({
        id: a.id,
        name: a.name,
        currency: a.currency,
        color: a.color,
        brand: a.brand,
        last4: a.last4,
        reason,
        dueDate: a.dueDate,
        pendingTriageCount: a.pendingTriageCount,
      });
    }
  }
  return items;
}
