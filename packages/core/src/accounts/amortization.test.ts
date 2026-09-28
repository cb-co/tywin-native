import { test, expect, describe, it } from "vitest";
import { buildSchedule, splitPayments } from "./amortization";

test("zero-interest loan divides evenly and ends at zero", () => {
  const s = buildSchedule({ principal: 1200, annualRate: 0, termMonths: 12 });
  expect(s).toHaveLength(12);
  expect(s[0].payment).toBeCloseTo(100, 2);
  expect(s[0].interest).toBe(0);
  expect(s.at(-1)!.balance).toBeCloseTo(0, 2);
});

test("interest-bearing loan amortizes to zero with correct first interest", () => {
  const s = buildSchedule({ principal: 10000, annualRate: 0.12, termMonths: 24 });
  expect(s).toHaveLength(24);
  expect(s[0].interest).toBeCloseTo(100, 2); // 10000 * (0.12/12)
  expect(s.at(-1)!.balance).toBeCloseTo(0, 1);
});

test("explicit installment is honored and can finish early", () => {
  const s = buildSchedule({
    principal: 1000,
    annualRate: 0,
    termMonths: 12,
    installment: 300,
  });
  // 1000 / 300 -> pays off in 4 months (300,300,300,100)
  expect(s).toHaveLength(4);
  expect(s.at(-1)!.payment).toBeCloseTo(100, 2);
  expect(s.at(-1)!.balance).toBeCloseTo(0, 2);
});

test("invalid inputs yield an empty schedule", () => {
  expect(buildSchedule({ principal: 0, annualRate: 0.1, termMonths: 12 })).toEqual([]);
  expect(buildSchedule({ principal: 1000, annualRate: 0.1, termMonths: 0 })).toEqual([]);
});

describe("splitPayments", () => {
  const loan = { principal: 10000, annualRate: 0.12, termMonths: 12 };

  it("charges interest on the balance standing before each payment", () => {
    const [first, second] = splitPayments({
      ...loan,
      payments: [
        { amount: 1000, date: "2026-03-05" },
        { amount: 1000, date: "2026-04-05" },
      ],
    });
    // 1% monthly: 100 interest, 900 principal -> 9100; then 1% of 9100.
    expect(first).toEqual({ date: "2026-03-05", interest: 100, principal: 900, balance: 9100 });
    expect(second.interest).toBe(91);
  });

  it("puts the whole payment against principal at zero interest", () => {
    const [first] = splitPayments({
      ...loan,
      annualRate: 0,
      payments: [{ amount: 1000, date: "2026-03-05" }],
    });
    expect(first.interest).toBe(0);
    expect(first.principal).toBe(1000);
  });

  it("never reports more interest than the payment itself", () => {
    // 100 of interest accrued but only 50 paid: the payment was all interest
    // and none of it reached principal, so the balance holds rather than
    // growing — the loan_status CTE does not capitalize a shortfall.
    const [first] = splitPayments({ ...loan, payments: [{ amount: 50, date: "2026-03-05" }] });
    expect(first.interest).toBe(50);
    expect(first.principal).toBe(0);
    expect(first.balance).toBe(10000);
  });

  it("charges no interest once the balance is cleared", () => {
    const [first, second] = splitPayments({
      ...loan,
      principal: 500,
      termMonths: null,
      payments: [
        { amount: 9999, date: "2026-03-05" },
        { amount: 1000, date: "2026-04-05" },
      ],
    });
    expect(first.balance).toBe(0);
    expect(second.interest).toBe(0);
    expect(second.principal).toBe(0);
  });

  it("stops charging interest past the final scheduled installment", () => {
    const payments = Array.from({ length: 13 }, (_, i) => ({
      amount: 1000,
      date: `2026-${String(i + 1).padStart(2, "0")}-05`,
    }));
    const split = splitPayments({ ...loan, termMonths: 12, payments });
    expect(split[11].balance).toBe(0);
    expect(split[12].interest).toBe(0);
  });

  it("returns nothing for a loan with no payments", () => {
    expect(splitPayments({ ...loan, payments: [] })).toEqual([]);
  });
});
