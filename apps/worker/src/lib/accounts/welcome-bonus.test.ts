import { describe, expect, it } from "vitest";
import { resolveEffectiveBonus, sumConvertedSpend } from "./welcome-bonus";
import type { CardGroupSibling } from "./welcome-bonus";

function sibling(overrides: Partial<CardGroupSibling>): CardGroupSibling {
  return {
    id: "a",
    currency: "USD",
    welcome_bonus_goal_amount: null,
    welcome_bonus_goal_currency: null,
    welcome_bonus_due_date: null,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("resolveEffectiveBonus", () => {
  it("prefers the account's own goal when set", () => {
    const mine = sibling({
      id: "a",
      welcome_bonus_goal_amount: 500,
      welcome_bonus_due_date: "2026-09-01",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const sibling2 = sibling({
      id: "b",
      welcome_bonus_goal_amount: 999,
      welcome_bonus_due_date: "2026-12-01",
      updated_at: "2026-06-01T00:00:00Z",
    });
    expect(resolveEffectiveBonus("a", [mine, sibling2])).toBe(mine);
  });

  it("falls back to the most-recently-updated sibling with a goal", () => {
    const mine = sibling({ id: "a" });
    const older = sibling({
      id: "b",
      welcome_bonus_goal_amount: 500,
      welcome_bonus_due_date: "2026-09-01",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const newer = sibling({
      id: "c",
      welcome_bonus_goal_amount: 800,
      welcome_bonus_due_date: "2026-10-01",
      updated_at: "2026-06-01T00:00:00Z",
    });
    expect(resolveEffectiveBonus("a", [mine, older, newer])).toBe(newer);
  });

  it("returns null when nobody in the group has a goal", () => {
    expect(resolveEffectiveBonus("a", [sibling({ id: "a" }), sibling({ id: "b" })])).toBeNull();
  });

  it("treats a partially-set row (amount without due date) as not having a goal", () => {
    const partial = sibling({ id: "a", welcome_bonus_goal_amount: 500, welcome_bonus_due_date: null });
    expect(resolveEffectiveBonus("a", [partial])).toBeNull();
  });
});

describe("sumConvertedSpend", () => {
  it("sums same-currency amounts with no conversion", () => {
    const rows = [
      { account_id: "a", total_amount: 100 },
      { account_id: "a", total_amount: 50 },
    ];
    const byAcct = new Map([["a", "USD"]]);
    expect(sumConvertedSpend(rows, byAcct, "USD", { USD: 1 })).toBeCloseTo(150, 4);
  });

  it("converts a differing-currency line into the goal currency", () => {
    const rows = [{ account_id: "a", total_amount: 100 }];
    const byAcct = new Map([["a", "EUR"]]);
    // 1 USD = 0.9 EUR  =>  crossRate(EUR, USD) = 1/0.9
    const rates = { USD: 1, EUR: 0.9 };
    expect(sumConvertedSpend(rows, byAcct, "USD", rates)).toBeCloseTo(100 / 0.9, 4);
  });

  it("falls back to 1:1 when a rate is missing rather than dropping the amount", () => {
    const rows = [{ account_id: "a", total_amount: 100 }];
    const byAcct = new Map([["a", "ZZZ"]]);
    expect(sumConvertedSpend(rows, byAcct, "USD", { USD: 1 })).toBeCloseTo(100, 4);
  });

  it("skips rows whose account isn't in the currency map", () => {
    const rows = [{ account_id: "unknown", total_amount: 100 }];
    expect(sumConvertedSpend(rows, new Map(), "USD", { USD: 1 })).toBe(0);
  });
});
