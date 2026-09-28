import { describe, expect, it } from "vitest";
import { isInsightsSpend } from "./spend-rule";

describe("isInsightsSpend", () => {
  it("counts an expense regardless of destination", () => {
    expect(isInsightsSpend({ type: "expense", toAccountType: null })).toBe(true);
  });

  it("counts a payment that retires a loan", () => {
    expect(isInsightsSpend({ type: "payment", toAccountType: "loan" })).toBe(true);
  });

  it("excludes a payment to a non-loan account (e.g. a card settlement or a transfer)", () => {
    expect(isInsightsSpend({ type: "payment", toAccountType: "credit_card" })).toBe(false);
    expect(isInsightsSpend({ type: "payment", toAccountType: "savings" })).toBe(false);
    expect(isInsightsSpend({ type: "payment", toAccountType: null })).toBe(false);
  });

  it("excludes income", () => {
    expect(isInsightsSpend({ type: "income", toAccountType: null })).toBe(false);
  });
});
