import { describe, expect, test } from "vitest";
import { recurringTotals, type TotalsRow } from "./totals";

/** 60 pesos to the dollar, which is close enough to real to read clearly. */
const RATES = { USD: 1, DOP: 60 };

const row = (over: Partial<TotalsRow> = {}): TotalsRow => ({
  amount: 10,
  currency: "USD",
  billing_cycle: "monthly",
  kind: "expense",
  is_active: true,
  ...over,
});

describe("recurringTotals", () => {
  test("converts each amount before summing it", () => {
    const totals = recurringTotals(
      [
        row({ amount: 1500, currency: "DOP" }), // gym, US$25
        row({ amount: 15.99, currency: "USD" }),
      ],
      "USD",
      RATES,
    );
    // Not 1515.99 — the two currencies' digits are no longer added as one.
    expect(totals.outgoing).toBeCloseTo(40.99);
  });

  test("income lands in its own total and never in outgoing", () => {
    const totals = recurringTotals(
      [row({ amount: 2000, kind: "income" }), row({ amount: 15 })],
      "USD",
      RATES,
    );
    expect(totals.income).toBeCloseTo(2000);
    expect(totals.outgoing).toBeCloseTo(15);
  });

  test("a recurring payment counts as outgoing, like an expense", () => {
    // The car loan: a payment template settling a loan every month.
    const totals = recurringTotals([row({ amount: 18000, currency: "DOP", kind: "payment" })], "USD", RATES);
    expect(totals.outgoing).toBeCloseTo(300);
    expect(totals.income).toBe(0);
  });

  test("paused templates count toward neither total", () => {
    const totals = recurringTotals(
      [
        row({ amount: 50, is_active: false }),
        row({ amount: 3000, kind: "income", is_active: false }),
      ],
      "USD",
      RATES,
    );
    expect(totals).toEqual({ outgoing: 0, income: 0 });
  });

  test("normalizes every cycle to a monthly figure", () => {
    const totals = recurringTotals(
      [
        row({ amount: 120, billing_cycle: "yearly" }), // 10
        row({ amount: 12, billing_cycle: "weekly" }), // 52
        row({ amount: 1000, billing_cycle: "semimonthly", kind: "income" }), // 2000
      ],
      "USD",
      RATES,
    );
    expect(totals.outgoing).toBeCloseTo(62);
    expect(totals.income).toBeCloseTo(2000);
  });

  test("keeps a row whose currency has no rate, at 1:1", () => {
    // Degrading quietly beats dropping the row; the screen flags it separately.
    const totals = recurringTotals([row({ amount: 40, currency: "EUR" })], "USD", RATES);
    expect(totals.outgoing).toBeCloseTo(40);
  });

  test("an empty list is two zeroes, not NaN", () => {
    expect(recurringTotals([], "USD", RATES)).toEqual({ outgoing: 0, income: 0 });
  });
});
