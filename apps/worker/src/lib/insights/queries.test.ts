import { describe, expect, it } from "vitest";
import { buildLoanInterest } from "./queries";

describe("buildLoanInterest", () => {
  const loan = (over: Record<string, unknown> = {}) => ({
    id: "loan",
    name: "Car loan",
    currency: "USD",
    principal: 10000,
    interest_rate: 0.12,
    term_months: 12,
    ...over,
  });
  const pay = (to: string, amount: number, date: string, toAmount: number | null = null) => ({
    to_account_id: to,
    amount,
    to_amount: toAmount,
    occurred_at: `${date}T12:00:00+00:00`,
  });
  const build = (over: Partial<Parameters<typeof buildLoanInterest>[0]> = {}) =>
    buildLoanInterest({
      year: 2026,
      baseCurrency: "USD",
      rates: {},
      loans: [loan()],
      payments: [],
      ...over,
    });

  it("reports the interest component of each loan's most recent payment", () => {
    // 1% monthly on 10000 is 100; the second payment is charged on 9100.
    const result = build({
      payments: [pay("loan", 1000, "2026-03-05"), pay("loan", 1000, "2026-04-05")],
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].lastInterest).toBe(91);
    expect(result.lines[0].lastPaymentDate).toBe("2026-04-05");
  });

  it("states the annual rate as a percentage", () => {
    const result = build({ payments: [pay("loan", 1000, "2026-03-05")] });
    expect(result.lines[0].apr).toBe(12);
  });

  it("counts only this year's interest but amortizes from the first payment ever", () => {
    // Splitting only the 2026 payment would charge it 100 (1% of the full
    // principal) instead of 91 — the 2025 payment has to run first even though
    // its own interest is not counted.
    const result = build({
      payments: [pay("loan", 1000, "2025-12-05"), pay("loan", 1000, "2026-01-05")],
    });
    expect(result.lines[0].yearInterest).toBe(91);
    expect(result.yearBase).toBe(91);
  });

  it("omits a loan with no payments logged against it", () => {
    expect(build({ payments: [] }).lines).toEqual([]);
  });

  it("omits a loan that has been paid off", () => {
    const result = build({
      loans: [loan({ principal: 500, term_months: null })],
      payments: [pay("loan", 9999, "2026-03-05")],
    });
    expect(result.lines).toEqual([]);
  });

  it("keeps each row in the loan's own currency and totals in base", () => {
    const result = build({
      baseCurrency: "USD",
      rates: { DOP: 60 },
      loans: [loan({ currency: "DOP", principal: 60000 })],
      payments: [pay("loan", 6000, "2026-03-05")],
    });
    // 1% of 60000 is 600 pesos, which is 10 dollars at 60 to the dollar.
    expect(result.lines[0].lastInterest).toBe(600);
    expect(result.lines[0].currency).toBe("DOP");
    expect(result.monthlyBase).toBe(10);
  });

  it("orders the loans by what they currently cost", () => {
    const result = build({
      loans: [loan({ id: "small", principal: 1000 }), loan({ id: "big", principal: 50000 })],
      payments: [pay("small", 200, "2026-03-05"), pay("big", 2000, "2026-03-05")],
    });
    expect(result.lines.map((l) => l.accountId)).toEqual(["big", "small"]);
  });

  it("sums the monthly run-rate across loans", () => {
    const result = build({
      loans: [loan({ id: "a" }), loan({ id: "b", principal: 20000 })],
      payments: [pay("a", 1000, "2026-03-05"), pay("b", 1000, "2026-03-05")],
    });
    expect(result.monthlyBase).toBe(300); // 100 + 200
  });

  it("ignores payments made into a different loan", () => {
    const result = build({ payments: [pay("other", 1000, "2026-03-05")] });
    expect(result.lines).toEqual([]);
  });
});
