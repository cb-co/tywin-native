import { describe, expect, it } from "vitest";
import {
  accountMovement,
  buildNetWorthSeries,
  cardOwedAt,
  historyMonths,
  loanBalanceTimeline,
  type NetWorthInput,
} from "./net-worth-history";

const tx = (over: Partial<Parameters<typeof accountMovement>[0]> = {}) => ({
  type: "expense",
  account_id: "checking",
  to_account_id: null,
  amount: 100,
  to_amount: null,
  total_amount: 100,
  occurred_at: "2026-07-15T12:00:00+00:00",
  ...over,
});

const pay = (to: string, amount: number, date: string, toAmount: number | null = null) => ({
  to_account_id: to,
  amount,
  to_amount: toAmount,
  occurred_at: `${date}T12:00:00+00:00`,
});

describe("historyMonths", () => {
  it("returns six ascending month starts ending at the given month", () => {
    expect(historyMonths("2026-07-01")).toEqual([
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
  });
  it("crosses the year boundary", () => {
    expect(historyMonths("2026-02-01")[0]).toBe("2025-09-01");
  });
});

describe("accountMovement", () => {
  it("adds income and subtracts expenses at their total (tax and fees included)", () => {
    expect(accountMovement(tx({ type: "income", amount: 500 }), "checking")).toBe(500);
    expect(accountMovement(tx({ total_amount: 120 }), "checking")).toBe(-120);
  });
  it("debits the source of a payment by its total", () => {
    const p = tx({ type: "payment", to_account_id: "card", total_amount: 105 });
    expect(accountMovement(p, "checking")).toBe(-105);
  });
  it("credits the destination in the destination's own currency", () => {
    const p = tx({ type: "payment", account_id: "checking", to_account_id: "savings", amount: 100, to_amount: 5800 });
    expect(accountMovement(p, "savings")).toBe(5800);
    // Pre-to_amount rows fall back to `amount`, as the view's coalesce does.
    expect(accountMovement({ ...p, to_amount: null }, "savings")).toBe(100);
  });
  it("ignores unrelated accounts", () => {
    expect(accountMovement(tx(), "savings")).toBe(0);
  });
});

describe("cardOwedAt", () => {
  const statements = [
    { account_id: "card", period_end: "2026-05-20", total_balance: 30000 },
    { account_id: "card", period_end: "2026-06-20", total_balance: 42000 },
  ];

  it("anchors on the newest statement closed by the date, less later payments", () => {
    const payments = [pay("card", 12000, "2026-06-25")];
    expect(cardOwedAt("card", 30000, statements, payments, "2026-06-30")).toBe(30000);
  });
  it("uses an older anchor for an earlier month", () => {
    const payments = [pay("card", 5000, "2026-05-25")];
    expect(cardOwedAt("card", 0, statements, payments, "2026-05-31")).toBe(25000);
  });
  it("excludes payments on the closing day itself — they are already in the balance", () => {
    const payments = [pay("card", 5000, "2026-05-20")];
    expect(cardOwedAt("card", 0, statements, payments, "2026-05-31")).toBe(30000);
  });
  it("excludes payments made after the date asked about", () => {
    const payments = [pay("card", 5000, "2026-06-05")];
    expect(cardOwedAt("card", 0, statements, payments, "2026-05-31")).toBe(30000);
  });
  it("credits the card's own currency leg", () => {
    const payments = [pay("card", 100, "2026-05-25", 5800)];
    expect(cardOwedAt("card", 0, statements, payments, "2026-05-31")).toBe(24200);
  });
  it("rewinds today's balance when no statement had closed yet", () => {
    const payments = [pay("card", 4000, "2026-04-10")];
    expect(cardOwedAt("card", 9000, statements, payments, "2026-03-31")).toBe(13000);
  });
  it("ignores other cards' statements and payments", () => {
    const payments = [pay("other", 5000, "2026-05-25")];
    expect(cardOwedAt("card", 0, statements, payments, "2026-05-31")).toBe(30000);
  });
});

describe("loanBalanceTimeline", () => {
  const loan = { id: "loan", currency: "USD", principal: 10000, interest_rate: 0.12, term_months: 12 };

  it("splits each payment into interest and principal", () => {
    const [first, second] = loanBalanceTimeline(loan, [
      pay("loan", 1000, "2026-03-05"),
      pay("loan", 1000, "2026-04-05"),
    ]);
    // 1% monthly: 100 interest, 900 principal -> 9100; then 91 interest.
    expect(first.balance).toBeCloseTo(9100, 2);
    expect(second.balance).toBeCloseTo(8191, 2);
    expect(first.date).toBe("2026-03-05");
  });

  it("puts the whole payment against principal at zero interest", () => {
    const free = { ...loan, interest_rate: 0 };
    const [first] = loanBalanceTimeline(free, [pay("loan", 1000, "2026-03-05")]);
    expect(first.balance).toBe(9000);
  });

  it("holds the balance rather than growing it when a payment misses the interest", () => {
    const [first] = loanBalanceTimeline(loan, [pay("loan", 50, "2026-03-05")]);
    expect(first.balance).toBe(10000);
  });

  it("clears the loan on the last scheduled installment and stays there", () => {
    const payments = Array.from({ length: 13 }, (_, i) =>
      pay("loan", 1000, `2026-${String(i + 1).padStart(2, "0")}-05`),
    );
    const timeline = loanBalanceTimeline({ ...loan, term_months: 12 }, payments);
    expect(timeline[11].balance).toBe(0);
    expect(timeline[12].balance).toBe(0);
  });

  it("never over-pays past zero on an open-ended loan", () => {
    const open = { ...loan, principal: 500, term_months: null };
    const [first] = loanBalanceTimeline(open, [pay("loan", 9999, "2026-03-05")]);
    expect(first.balance).toBe(0);
  });
});

describe("buildNetWorthSeries", () => {
  const base: NetWorthInput = {
    months: ["2026-05-01", "2026-06-01", "2026-07-01"],
    baseCurrency: "USD",
    rates: { USD: 1, DOP: 60 },
    balances: [{ account_id: "checking", currency: "USD", balance: 5000 }],
    cards: [],
    loans: [],
    statements: [],
    transactions: [],
    cardPayments: [],
    loanPayments: [],
  };

  it("rewinds the current balance by everything dated after each month end", () => {
    const points = buildNetWorthSeries({
      ...base,
      transactions: [
        tx({ type: "income", amount: 1000, occurred_at: "2026-06-10T12:00:00+00:00" }),
        tx({ total_amount: 300, occurred_at: "2026-07-10T12:00:00+00:00" }),
      ],
    });
    // Today: 5000. Before July's expense: 5300. Before June's income: 4300.
    expect(points.map((p) => p.netWorth)).toEqual([4300, 5300, 5000]);
    expect(points.map((p) => p.label)).toEqual(["May", "Jun", "Jul"]);
  });

  it("counts a transaction on the last day of the month as inside it", () => {
    const points = buildNetWorthSeries({
      ...base,
      transactions: [tx({ type: "income", amount: 1000, occurred_at: "2026-05-31T23:00:00+00:00" })],
    });
    expect(points[0].netWorth).toBe(5000);
  });

  it("converts each part from its own currency at the base rate", () => {
    const points = buildNetWorthSeries({
      ...base,
      balances: [{ account_id: "checking", currency: "DOP", balance: 60000 }],
    });
    expect(points.at(-1)!.netWorth).toBe(1000);
  });

  it("subtracts card and loan debt, each in its own currency", () => {
    const points = buildNetWorthSeries({
      ...base,
      cards: [{ account_id: "card", currency: "DOP", owed: 60000 }],
      statements: [{ account_id: "card", period_end: "2026-06-20", total_balance: 60000 }],
      loans: [{ id: "loan", currency: "USD", principal: 2000, interest_rate: 0, term_months: 10 }],
      loanPayments: [pay("loan", 500, "2026-06-05")],
    });
    // Jul: 5000 assets - 1000 card - 1500 loan.
    expect(points.at(-1)!.netWorth).toBe(2500);
    // May: the card had no statement yet, the loan no payments.
    expect(points[0].netWorth).toBe(5000 - 1000 - 2000);
  });

  it("holds flat when there is nothing to rewind", () => {
    expect(buildNetWorthSeries(base).map((p) => p.netWorth)).toEqual([5000, 5000, 5000]);
  });
});
