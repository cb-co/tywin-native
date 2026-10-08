import { cardDue } from "@cigua/core/overview/card-due";
import { addDays } from "@cigua/core/period/cycle";

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
  /** The newest statement's balance and printed minimum. Null with no statement. */
  statementBalance: number | null;
  minimumPayment: number | null;
  /** Payments into the card since that statement closed, in its currency. */
  paidSinceStatement: number;
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
  /** For overdue and due-soon: what is left to pay to stay current — the
   *  minimum when the bank printed one, the cutoff balance when it did not.
   *  Null for an untriaged-only row, or a statement with no balance read. */
  amountDue: number | null;
  /** The cutoff balance still standing, shown beside the minimum. Null when
   *  `amountDue` already is it. */
  statementLeft: number | null;
};

/** How long after a missed due date the card keeps flagging it on our own
 *  evidence. Past this the newest statement is stale; the next one, with the
 *  bank's own overdue figures, takes over. */
const MISSED_GRACE_DAYS = 30;

/**
 * What belongs on the Accounts page's attention ledger: whatever needs a
 * decision, ranked overdue > due soon > still-uncategorised. Every signal
 * here already exists in the data the app has (card_statements.overdue_*,
 * card_status.latest_due_date, payments logged since the statement closed,
 * import triage) — nothing is invented or guessed, per PRODUCT.md's "refuse
 * rather than guess" principle.
 *
 * Payments since the statement are what keep this honest. The alert is the
 * minimum — miss it and the bank charges a late fee and reports it — so once
 * logged payments cover the minimum the card stops asking for attention; the
 * rest of the cutoff balance stays on Overview's Upcoming list. The bank's own
 * overdue figure clears the same way, once payments cover it.
 */
export function accountsNeedingAttention(
  accounts: AttentionInput[],
  today: string,
  dueWithinDays = 7,
): AttentionItem[] {
  const horizonISO = addDays(today, dueWithinDays);
  const graceISO = addDays(today, -MISSED_GRACE_DAYS);

  const items: AttentionItem[] = [];
  for (const a of accounts) {
    const due =
      a.statementBalance != null
        ? cardDue(a.statementBalance, null, a.paidSinceStatement, a.minimumPayment)
        : null;
    // What keeps the card current, still unpaid. A statement whose balance
    // was never read cannot be checked against payments, so it keeps asking.
    const toPay = a.statementBalance == null ? null : due ? (due.minimum ?? due.balance) : 0;
    const unpaid = toPay == null || toPay >= 0.01;

    const bankOverdue =
      ((a.overdueAmount ?? 0) > 0 && a.paidSinceStatement < Number(a.overdueAmount)) ||
      ((a.overdueInstallments ?? 0) > 0 && unpaid);
    const missed = a.dueDate !== null && a.dueDate < today && a.dueDate >= graceISO && unpaid;
    const overdue = bankOverdue || missed;
    const dueSoon = a.dueDate !== null && a.dueDate >= today && a.dueDate <= horizonISO && unpaid;
    const untriaged = a.pendingTriageCount > 0;

    let reason: AttentionReason | null = null;
    if (overdue) reason = "overdue";
    else if (dueSoon) reason = "due-soon";
    else if (untriaged) reason = "untriaged";

    if (reason) {
      const owes = reason !== "untriaged" && toPay != null && toPay >= 0.01;
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
        amountDue: owes ? toPay : null,
        statementLeft: owes && due && due.minimum != null && due.balance > toPay! ? due.balance : null,
      });
    }
  }
  return items;
}
