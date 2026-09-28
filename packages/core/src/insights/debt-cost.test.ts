import { describe, expect, it } from "vitest";
import { buildDebtCost } from "./debt-cost";
import type { CostOfCarry, LoanInterest } from "./types";

const carry = (lines: CostOfCarry["lines"], totalBase = 0): CostOfCarry => ({
  baseCurrency: "DOP",
  lines,
  totalBase,
});
const loans = (over: Partial<LoanInterest> = {}): LoanInterest => ({
  year: 2026,
  baseCurrency: "DOP",
  lines: [],
  monthlyBase: 0,
  yearBase: 0,
  ...over,
});
const carryLine = (over: Partial<CostOfCarry["lines"][number]> = {}) => ({
  accountId: "c1",
  name: "Visa",
  currency: "DOP",
  periodEnd: "2026-08-31",
  apr: 60,
  avgDailyBalance: 10000,
  costOfCarry: 500,
  costOfCarryBase: 500,
  ...over,
});

describe("buildDebtCost", () => {
  it("keeps cards and loans in separate groups with their own subtotals", () => {
    const result = buildDebtCost(
      carry([carryLine()], 500),
      loans({
        lines: [
          {
            accountId: "l1",
            name: "Auto",
            currency: "DOP",
            apr: 12,
            lastPaymentDate: "2026-09-01",
            lastInterest: 900,
            yearInterest: 7000,
          },
        ],
        monthlyBase: 900,
        yearBase: 7000,
      }),
    );
    expect(result.cards).toEqual([
      { accountId: "c1", name: "Visa", currency: "DOP", apr: 60, asOf: "2026-08-31", amount: 500 },
    ]);
    expect(result.cardsMonthlyBase).toBe(500);
    expect(result.loans).toEqual([
      { accountId: "l1", name: "Auto", currency: "DOP", apr: 12, asOf: "2026-09-01", amount: 900 },
    ]);
    expect(result.loansMonthlyBase).toBe(900);
    expect(result.loansYearBase).toBe(7000);
    expect(result.year).toBe(2026);
    expect(result.baseCurrency).toBe("DOP");
  });

  it("drops cards whose latest statement reported no cost of carry", () => {
    const result = buildDebtCost(
      carry([carryLine(), carryLine({ accountId: "c2", costOfCarry: null, costOfCarryBase: null })], 500),
      loans(),
    );
    expect(result.cards.map((r) => r.accountId)).toEqual(["c1"]);
  });

  it("sorts cards by base-currency cost, largest first", () => {
    const result = buildDebtCost(
      carry([
        carryLine({ accountId: "small", costOfCarry: 10, costOfCarryBase: 600, currency: "USD" }),
        carryLine({ accountId: "big", costOfCarry: 900, costOfCarryBase: 900 }),
      ]),
      loans(),
    );
    expect(result.cards.map((r) => r.accountId)).toEqual(["big", "small"]);
    expect(result.cardsMonthlyBase).toBe(1500);
  });

  it("returns empty groups when there is nothing to report", () => {
    const result = buildDebtCost(carry([]), loans());
    expect(result.cards).toEqual([]);
    expect(result.loans).toEqual([]);
    expect(result.cardsMonthlyBase).toBe(0);
    expect(result.loansMonthlyBase).toBe(0);
  });
});
