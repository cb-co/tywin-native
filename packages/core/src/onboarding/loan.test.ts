import { describe, expect, it } from "vitest";
import { accountInput } from "../accounts/schema";
import { estimateRemainingInstallments, loanAccountFromOnboarding } from "./loan";

const base = {
  name: "Préstamo vehículo",
  currency: "DOP",
  owedToday: "450000",
  installment: "15250.50",
  remainingInstallments: "36",
  dueDay: "15",
  annualRatePercent: "",
};

describe("loanAccountFromOnboarding", () => {
  it("describes the loan from today: owed is principal, remaining is the term", () => {
    const row = loanAccountFromOnboarding(base, "2026-09-18");
    expect(row).toMatchObject({
      type: "loan",
      name: "Préstamo vehículo",
      currency: "DOP",
      principal: 450000,
      installment_amount: 15250.5,
      term_months: 36,
      payment_due_day: 15,
      start_date: "2026-09-18",
      starting_balance: 0,
    });
    expect(row.interest_rate).toBeUndefined();
    expect(row.original_term_months).toBeUndefined();
    expect(accountInput.safeParse(row).success).toBe(true);
  });

  it("turns an annual percent into the fraction the column stores", () => {
    const row = loanAccountFromOnboarding({ ...base, annualRatePercent: "18.5" }, "2026-09-18");
    expect(row.interest_rate).toBeCloseTo(0.185);
  });

  it("leaves the due day unset when blank", () => {
    const row = loanAccountFromOnboarding({ ...base, dueDay: "" }, "2026-09-18");
    expect(row.payment_due_day).toBeUndefined();
    expect(accountInput.safeParse(row).success).toBe(true);
  });

  it("fails validation when a required figure is missing", () => {
    const row = loanAccountFromOnboarding({ ...base, installment: "" }, "2026-09-18");
    expect(accountInput.safeParse(row).success).toBe(false);
  });
});

describe("estimateRemainingInstallments", () => {
  it("solves the annuity formula for the count, rounded up", () => {
    // 450,000 at 14% with 12,500 a month: 46.96 -> 47.
    expect(estimateRemainingInstallments(450000, 12500, 14)).toBe(47);
  });

  it("round-trips a loan built from a known term", () => {
    // The installment that clears 300,000 at 12% in exactly 36 months.
    const r = 0.01;
    const installment = (300000 * r) / (1 - Math.pow(1 + r, -36));
    expect(estimateRemainingInstallments(300000, installment, 12)).toBe(36);
  });

  it("divides straight through at 0%", () => {
    expect(estimateRemainingInstallments(10000, 3000, 0)).toBe(4);
  });

  it("says never when interest eats the whole installment", () => {
    expect(estimateRemainingInstallments(100000, 1000, 12)).toBe("never");
    expect(estimateRemainingInstallments(100000, 999, 12)).toBe("never");
  });

  it("waits for all three figures", () => {
    expect(estimateRemainingInstallments(0, 1000, 12)).toBeNull();
    expect(estimateRemainingInstallments(1000, NaN, 12)).toBeNull();
    expect(estimateRemainingInstallments(1000, 100, NaN)).toBeNull();
  });
});

describe("loanAccountFromOnboarding · term from the rate", () => {
  it("uses the estimate when no count is typed", () => {
    const row = loanAccountFromOnboarding(
      { ...base, installment: "12500", remainingInstallments: "", annualRatePercent: "14" },
      "2026-09-18",
    );
    expect(row.term_months).toBe(47);
    expect(row.interest_rate).toBeCloseTo(0.14);
  });

  it("lets a typed count override the estimate", () => {
    const row = loanAccountFromOnboarding(
      { ...base, installment: "12500", remainingInstallments: "48", annualRatePercent: "14" },
      "2026-09-18",
    );
    expect(row.term_months).toBe(48);
  });

  it("leaves the term empty when the loan never pays off", () => {
    const row = loanAccountFromOnboarding(
      { ...base, installment: "1000", remainingInstallments: "", annualRatePercent: "12" },
      "2026-09-18",
    );
    expect(row.term_months).toBeUndefined();
  });
});
