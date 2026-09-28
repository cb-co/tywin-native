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

  it("a past due date with no overdue figures does not flag due-soon (already reflected as overdue by the bank, not this account's job to guess)", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-09-10" }], "2026-09-19", 7)).toEqual([]);
  });
});
