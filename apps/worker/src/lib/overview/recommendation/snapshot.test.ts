import { describe, expect, it } from "vitest";
import { buildSnapshot, type SnapshotRows } from "./snapshot";

const NOW = new Date("2026-08-11T12:00:00Z");

/* Deliberately loaded with everything that must NOT survive: a person's name,
   their bank's name, what they called their savings goal, the name of a service
   they subscribe to, and the UUIDs the upcoming rail keys on. */
const rows: SnapshotRows = {
  now: NOW,
  overview: {
    hasAccounts: true,
    importPrompt: "none",
    fxUnconverted: [],
    period: { start: "2026-08-01", end: "2026-08-31" },
    available: {
      periodEnd: "2026-08-31",
      liquid: 0,
      committed: 0,
      cardsMinimum: 0,
      cardsFull: 0,
      loans: 0,
      subscriptions: 0,
      available: 0,
      availableIfCardsCleared: 0,
      cardBasis: [],
      fxUnconverted: [],
    },
    baseCurrency: "USD",
    displayName: "Carlos Mendoza",
    netWorth: 12480.22,
    monthIncome: 4200.5,
    monthExpense: 2810.75,
    totalBudget: 3000,
    totalUsed: 2400,
    monthlyRecurringExpenses: 64.99,
    monthlyRecurringCardPayments: 200.4,
    monthlyRecurringIncome: 3000.5,
    upcoming: [
      {
        key: "card-6f1c2b7e-1111-4aaa-bbbb-000000000001",
        date: "2026-08-17T00:00:00.000Z",
        title: "BAC Credomatic Visa payment",
        subtitle: "Credit card · USD",
        amount: 340,
        currency: "USD",
      },
      {
        key: "sub-9d3e4f5a-2222-4ccc-dddd-000000000002",
        date: "2026-08-22T00:00:00.000Z",
        title: "Netflix",
        subtitle: "Subscription · USD",
        amount: 15.99,
        currency: "USD",
      },
    ],
  },
  budgets: [
    {
      category_id: "c1",
      name: "Dining",
      emoji: "🍽️",
      color: "#F79009",
      budget_group_id: null,
      budget: 400,
      budget_monthly: 400,
      used: 320,
      remaining: 80,
      status: "approaching",
    },
    {
      category_id: "c2",
      name: "Transport",
      emoji: "🚗",
      color: "#12B76A",
      budget_group_id: null,
      budget: 200,
      budget_monthly: 200,
      used: 60,
      remaining: 140,
      status: "within",
    },
    // Zero-budget categories are noise in a prompt: nothing can be "80% through"
    // a limit that was never set.
    {
      category_id: "c3",
      name: "Gifts",
      emoji: "🎁",
      color: null,
      budget_group_id: null,
      budget: 0,
      budget_monthly: 0,
      used: 0,
      remaining: 0,
      status: "within",
    },
  ],
  goals: [
    {
      id: "g1",
      name: "Trip to Japan",
      emoji: "🗾",
      color: null,
      target_amount: 5000,
      target_date: "2026-12-01",
      saved: 3100,
      backed: 3100,
      shortfall: 0,
      pace: { kind: "no-pace" },
    },
  ],
  accounts: [
    { id: "a1", name: "BAC Credomatic Visa", type: "credit_card", currency: "USD", balance: -1200 },
    { id: "a2", name: "Banco Popular Ahorros", type: "savings", currency: "USD", balance: 4000 },
  ],
  loans: [{ currency: "USD", outstanding: 8200, installment: 310 }],
  calendar: {
    thisMonth: { income: 4200.5, expense: 2810.75 },
    lastMonthSamePoint: { income: 4000, expense: 2300.4 },
    lastMonth: { income: 4100, expense: 6900.2 },
  },
  lastMonthUsedByCategory: new Map([
    ["c1", 210.6],
    ["c2", 90],
  ]),
};

describe("buildSnapshot shape", () => {
  it("carries the core figures and the calendar position", () => {
    expect(buildSnapshot(rows)).toMatchObject({
      asOf: "2026-08-11",
      dayOfMonth: 11,
      daysLeftInMonth: 20,
      baseCurrency: "USD",
      netWorth: 12480,
      monthIncome: 4201,
      monthExpense: 2811,
      monthlyRecurringExpenses: 65,
      monthlyRecurringCardPayments: 200,
      monthlyRecurringIncome: 3001,
    });
  });

  it("keeps category names, which is what makes the advice specific", () => {
    expect(buildSnapshot(rows).budgets).toEqual([
      { category: "Dining", budget: 400, used: 320 },
      { category: "Transport", budget: 200, used: 60 },
    ]);
  });

  it("reduces upcoming items to a kind and a countdown", () => {
    expect(buildSnapshot(rows).upcoming).toEqual([
      { kind: "card_payment", amount: 340, currency: "USD", dueInDays: 6 },
      { kind: "recurring", amount: 16, currency: "USD", dueInDays: 11 },
    ]);
  });

  it("reduces goals to their numbers", () => {
    expect(buildSnapshot(rows).goals).toEqual([
      { target: 5000, saved: 3100, targetDate: "2026-12-01" },
    ]);
  });

  it("reduces accounts to type, currency and balance", () => {
    expect(buildSnapshot(rows).accounts).toEqual([
      { type: "credit_card", currency: "USD", balance: -1200 },
      { type: "savings", currency: "USD", balance: 4000 },
    ]);
  });

  // An overdue item reads as "due today" rather than as a negative number the
  // model has to work out the sign of.
  it("floors an overdue countdown at zero", () => {
    const overdue = buildSnapshot({
      ...rows,
      overview: {
        ...rows.overview,
        upcoming: [
          {
            key: "loan-1111",
            date: "2026-08-01T00:00:00.000Z",
            title: "Loan installment",
            subtitle: "Loan · USD",
            amount: 310,
            currency: "USD",
          },
        ],
      },
    });
    expect(overdue.upcoming).toEqual([
      { kind: "loan_installment", amount: 310, currency: "USD", dueInDays: 0 },
    ]);
  });
});

describe("buildSnapshot trend", () => {
  it("compares this month so far with the same point last month", () => {
    const { trend } = buildSnapshot(rows);
    expect(trend.monthToDate).toEqual({ income: 4201, expense: 2811 });
    expect(trend.lastMonthSamePoint).toEqual({ income: 4000, expense: 2300 });
    expect(trend.lastMonthExpense).toBe(6900);
  });

  // 2810.75 spent over 11 of 31 days. The model is told to use only the numbers it
  // is given, so the extrapolation has to be done here rather than by it.
  it("projects month-end expense from the daily pace", () => {
    expect(buildSnapshot(rows).trend.projectedMonthExpense).toBe(7921);
  });

  it("reports the savings rate as a whole percentage of income", () => {
    expect(buildSnapshot(rows).trend.savingsRatePct).toBe(33);
  });

  it("has no savings rate before any income lands", () => {
    const s = buildSnapshot({
      ...rows,
      calendar: { ...rows.calendar, thisMonth: { income: 0, expense: 120 } },
    });
    expect(s.trend.savingsRatePct).toBeNull();
  });

  it("goes negative when spending outruns income", () => {
    const s = buildSnapshot({
      ...rows,
      calendar: { ...rows.calendar, thisMonth: { income: 1000, expense: 1500 } },
    });
    expect(s.trend.savingsRatePct).toBe(-50);
  });
});

describe("buildSnapshot topCategories", () => {
  it("ranks by spend, unbudgeted categories included, with last month's figure", () => {
    const s = buildSnapshot({
      ...rows,
      budgets: [
        ...rows.budgets.slice(0, 2),
        { ...rows.budgets[2], used: 500 }, // Gifts: no budget, biggest spend
      ],
      lastMonthUsedByCategory: new Map([["c1", 210.6]]),
    });
    expect(s.topCategories).toEqual([
      { category: "Gifts", used: 500, lastMonthUsed: 0 },
      { category: "Dining", used: 320, lastMonthUsed: 211 },
      { category: "Transport", used: 60, lastMonthUsed: 0 },
    ]);
  });

  it("skips categories with no spend and caps the list at five", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...rows.budgets[0],
      category_id: `x${i}`,
      name: `Cat${i}`,
      used: i === 0 ? 0 : 100 + i,
    }));
    const s = buildSnapshot({ ...rows, budgets: many });
    expect(s.topCategories).toHaveLength(5);
    expect(s.topCategories.map((c) => c.category)).not.toContain("Cat0");
    expect(s.topCategories[0].category).toBe("Cat7");
  });
});

/**
 * The test that earns this module its existence. It asserts against the
 * SERIALISED snapshot, because what matters is what crosses the wire, not what
 * the type says. A column added to `getOverview()` later that quietly carries a
 * name into the prompt fails here.
 */
describe("buildSnapshot redaction", () => {
  const json = JSON.stringify(buildSnapshot(rows));

  it.each([
    ["the person's name", "Carlos"],
    ["the bank's name", "BAC Credomatic"],
    ["a second bank's name", "Banco Popular"],
    ["the subscription's name", "Netflix"],
    ["the goal's name", "Japan"],
    // Not the bare word "payment": `card_payment` is the deliberate kind label.
    // These are the parts of the rail's translated prose that must not survive.
    ["the card's network", "Visa"],
    ["the upcoming item's subtitle", "Credit card"],
    ["an account UUID", "6f1c2b7e"],
    ["a subscription UUID", "9d3e4f5a"],
  ])("drops %s", (_label, secret) => {
    expect(json).not.toContain(secret);
  });
});
