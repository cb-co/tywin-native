import { describe, it, expect } from "vitest";
import { netWorthTotal } from "./net-worth";

const identity = (amount: number, _currency: string) => amount;

describe("netWorthTotal", () => {
  it("sums balances minus card owed minus loan outstanding", () => {
    const total = netWorthTotal(
      [{ balance: 1000, currency: "DOP" }, { balance: 500, currency: "USD" }],
      [{ owed: 200, currency: "DOP" }],
      [{ outstanding_balance: 300, currency: "DOP" }],
      "DOP",
      identity,
    );
    expect(total).toBe(1000 + 500 - 200 - 300);
  });

  it("converts every row through the supplied toBase before summing", () => {
    const toBase = (amount: number, currency: string) => (currency === "USD" ? amount * 60 : amount);
    const total = netWorthTotal(
      [{ balance: 100, currency: "USD" }],
      [],
      [],
      "DOP",
      toBase,
    );
    expect(total).toBe(6000);
  });

  it("falls back to baseCurrency when a row's currency is null", () => {
    const toBase = (amount: number, currency: string) => (currency === "DOP" ? amount : NaN);
    const total = netWorthTotal(
      [{ balance: 50, currency: null }],
      [{ owed: null, currency: null }],
      [{ outstanding_balance: null, currency: null }],
      "DOP",
      toBase,
    );
    expect(total).toBe(50);
  });

  it("returns 0 for three empty lists", () => {
    expect(netWorthTotal([], [], [], "DOP", identity)).toBe(0);
  });
});
