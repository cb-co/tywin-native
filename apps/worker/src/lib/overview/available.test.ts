import { describe, it, expect } from "vitest";
import { computeAvailable, LIQUID_ACCOUNT_TYPES } from "./available";

const base = {
  periodEnd: "2026-09-30",
  toBase: (amount: number) => amount, // single-currency by default
  accounts: [] as Parameters<typeof computeAvailable>[0]["accounts"],
  cards: [] as Parameters<typeof computeAvailable>[0]["cards"],
  loans: [] as Parameters<typeof computeAvailable>[0]["loans"],
  subscriptions: [] as Parameters<typeof computeAvailable>[0]["subscriptions"],
  fxUnconverted: [] as string[],
};

const acct = (type: string, balance: number, committed = 0, id = type) => ({
  accountId: id,
  type,
  balance,
  committed,
  currency: "DOP",
});

describe("LIQUID_ACCOUNT_TYPES", () => {
  it("is cash-like accounts only — an investment or a car is net worth, not spendable", () => {
    expect([...LIQUID_ACCOUNT_TYPES].sort()).toEqual(["cash", "checking", "savings"]);
  });
});

describe("computeAvailable · the liquid leg", () => {
  it("sums checking, savings and cash", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 30000), acct("savings", 15000), acct("cash", 2200)],
    });
    expect(r.liquid).toBe(47200);
    expect(r.available).toBe(47200);
  });

  it("excludes investment and asset accounts", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 30000), acct("investment", 500000), acct("asset", 1200000)],
    });
    expect(r.liquid).toBe(30000);
  });

  it("is zero when there are no liquid accounts at all", () => {
    const r = computeAvailable({ ...base, accounts: [acct("investment", 500000)] });
    expect(r.liquid).toBe(0);
    expect(r.available).toBe(0);
  });

  it("shows goal commitments as their own line rather than netting them into the balance", () => {
    // computeFunding clamped this account to 8000 committed of a 30000 balance.
    // The user sees both figures, so the hero being smaller than their bank
    // app's balance has a visible reason.
    const r = computeAvailable({ ...base, accounts: [acct("checking", 30000, 8000)] });
    expect(r.liquid).toBe(30000);
    expect(r.committed).toBe(8000);
    expect(r.available).toBe(22000);
  });
});

describe("computeAvailable · the card leg", () => {
  const card = (over: Partial<Parameters<typeof computeAvailable>[0]["cards"][number]>) => ({
    accountId: "c1",
    name: "Popular",
    currency: "DOP",
    statementBalance: 40000,
    owed: 45000,
    paidSinceStatement: 0,
    minimumPayment: null,
    ...over,
  });

  it("subtracts the printed minimum and records the basis", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ minimumPayment: 6750 })],
    });
    expect(r.cardsMinimum).toBe(6750);
    expect(r.cardsFull).toBe(40000);
    expect(r.cardBasis).toEqual([{ accountId: "c1", name: "Popular", basis: "minimum" }]);
    expect(r.available).toBe(43250);
    expect(r.availableIfCardsCleared).toBe(10000);
  });

  it("subtracts the full amount due when the bank printed no minimum", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ minimumPayment: null })],
    });
    expect(r.cardsMinimum).toBe(40000);
    expect(r.cardBasis).toEqual([{ accountId: "c1", name: "Popular", basis: "full" }]);
  });

  it("clamps the minimum to what is actually still owed", () => {
    // Statement 40000, already paid 38000, printed minimum 6750. You owe 2000,
    // not 6750 — subtracting the printed figure would invent debt.
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ paidSinceStatement: 38000, minimumPayment: 6750 })],
    });
    expect(r.cardsMinimum).toBe(2000);
    expect(r.cardsFull).toBe(2000);
  });

  it("drops a settled card entirely", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ paidSinceStatement: 40000, minimumPayment: 6750 })],
    });
    expect(r.cardsMinimum).toBe(0);
    expect(r.cardBasis).toEqual([]);
    expect(r.available).toBe(50000);
  });

  it("falls back to the live balance for a card that has never been imported", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ statementBalance: null, owed: 12000, minimumPayment: null })],
    });
    expect(r.cardsMinimum).toBe(12000);
    expect(r.cardBasis).toEqual([{ accountId: "c1", name: "Popular", basis: "full" }]);
  });
});

describe("computeAvailable · the dated legs", () => {
  it("counts loans and subscriptions due on or before the period end", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      loans: [{ amount: 9500, currency: "DOP", date: "2026-09-28" }],
      subscriptions: [{ amount: 4500, currency: "DOP", date: "2026-09-30" }],
    });
    expect(r.loans).toBe(9500);
    expect(r.subscriptions).toBe(4500);
    expect(r.available).toBe(36000);
  });

  it("ignores charges falling after the period ends", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      subscriptions: [{ amount: 4500, currency: "DOP", date: "2026-10-01" }],
    });
    expect(r.subscriptions).toBe(0);
  });

  it("ignores an undated charge rather than guessing when it lands", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      subscriptions: [{ amount: 4500, currency: "DOP", date: null }],
    });
    expect(r.subscriptions).toBe(0);
  });
});

describe("computeAvailable · composition", () => {
  it("goes negative rather than clamping to zero", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 5000)],
      loans: [{ amount: 9500, currency: "DOP", date: "2026-09-28" }],
    });
    expect(r.available).toBe(-4500);
  });

  it("converts every leg through toBase", () => {
    const r = computeAvailable({
      ...base,
      toBase: (amount, currency) => (currency === "USD" ? amount * 60 : amount),
      accounts: [{ accountId: "u", type: "checking", balance: 100, committed: 0, currency: "USD" }],
      subscriptions: [{ amount: 10, currency: "USD", date: "2026-09-20" }],
    });
    expect(r.liquid).toBe(6000);
    expect(r.subscriptions).toBe(600);
    expect(r.available).toBe(5400);
  });

  it("passes fxUnconverted through so the page can warn without a second source", () => {
    const r = computeAvailable({ ...base, fxUnconverted: ["EUR"] });
    expect(r.fxUnconverted).toEqual(["EUR"]);
  });

  it("carries the period end it was given", () => {
    expect(computeAvailable(base).periodEnd).toBe("2026-09-30");
  });
});
