import { describe, it, expect } from "vitest";
import { accountsNeedingAttention, type AttentionInput } from "./attention";

const base: AttentionInput = {
  id: "a1",
  name: "BHD Visa Platinum",
  currency: "DOP",
  color: null,
  brand: null,
  last4: "4417",
  dueDate: null,
  overdueAmount: null,
  overdueInstallments: null,
  statementBalance: 40000,
  minimumPayment: 2000,
  paidSinceStatement: 0,
  pendingTriageCount: 0,
};

describe("accountsNeedingAttention", () => {
  it("flags a due date within the window as due-soon", () => {
    const [item] = accountsNeedingAttention([{ ...base, dueDate: "2026-09-24" }], "2026-09-19", 7);
    expect(item.reason).toBe("due-soon");
  });

  it("does not flag a due date past the window", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-10-19" }], "2026-09-19", 7)).toEqual([]);
  });

  it("overdue outranks due-soon when both are true", () => {
    const [item] = accountsNeedingAttention(
      [{ ...base, dueDate: "2026-09-20", overdueAmount: 500 }],
      "2026-09-19",
      7,
    );
    expect(item.reason).toBe("overdue");
  });

  it("flags overdue installments even with no overdue amount", () => {
    const [item] = accountsNeedingAttention([{ ...base, overdueInstallments: 1 }], "2026-09-19");
    expect(item.reason).toBe("overdue");
  });

  it("flags pending triage when nothing else applies", () => {
    const [item] = accountsNeedingAttention([{ ...base, pendingTriageCount: 3 }], "2026-09-19");
    expect(item.reason).toBe("untriaged");
    expect(item.pendingTriageCount).toBe(3);
  });

  it("returns nothing for an account with no signal", () => {
    expect(accountsNeedingAttention([base], "2026-09-19")).toEqual([]);
  });

  it("leads a due-soon card with the minimum left, beside the cutoff balance", () => {
    const [item] = accountsNeedingAttention([{ ...base, dueDate: "2026-09-24", paidSinceStatement: 500 }], "2026-09-19");
    expect(item).toMatchObject({ reason: "due-soon", amountDue: 1500, statementLeft: 39500 });
  });

  it("stops flagging a due-soon card once payments cover the minimum", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-09-24", paidSinceStatement: 2000 }], "2026-09-19")).toEqual([]);
  });

  it("stops flagging a card paid in full", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-09-24", paidSinceStatement: 40000 }], "2026-09-19")).toEqual([]);
  });

  it("asks for the whole cutoff balance when the bank printed no minimum", () => {
    const [item] = accountsNeedingAttention(
      [{ ...base, dueDate: "2026-09-24", minimumPayment: null, paidSinceStatement: 10000 }],
      "2026-09-19",
    );
    expect(item).toMatchObject({ reason: "due-soon", amountDue: 30000, statementLeft: null });
  });

  it("clears the bank's overdue flag once payments since the statement cover it", () => {
    expect(
      accountsNeedingAttention([{ ...base, overdueAmount: 500, paidSinceStatement: 2000 }], "2026-09-19"),
    ).toEqual([]);
    const [item] = accountsNeedingAttention([{ ...base, overdueAmount: 500, paidSinceStatement: 100 }], "2026-09-19");
    expect(item.reason).toBe("overdue");
  });

  it("flags a due date that passed with the minimum still unpaid as overdue", () => {
    const [item] = accountsNeedingAttention([{ ...base, dueDate: "2026-09-10" }], "2026-09-19", 7);
    expect(item).toMatchObject({ reason: "overdue", amountDue: 2000 });
  });

  it("does not flag a past due date once the minimum was paid", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-09-10", paidSinceStatement: 2000 }], "2026-09-19")).toEqual([]);
  });

  it("lets a long-past due date go: the next statement speaks for the card", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-08-01" }], "2026-09-19")).toEqual([]);
  });

  it("keeps flagging a statement whose balance was never read, without a figure", () => {
    const [item] = accountsNeedingAttention([{ ...base, dueDate: "2026-09-24", statementBalance: null }], "2026-09-19");
    expect(item).toMatchObject({ reason: "due-soon", amountDue: null, statementLeft: null });
  });

  it("shows no figure on an untriaged-only row", () => {
    const [item] = accountsNeedingAttention([{ ...base, pendingTriageCount: 2, paidSinceStatement: 40000 }], "2026-09-19");
    expect(item).toMatchObject({ reason: "untriaged", amountDue: null });
  });
});
