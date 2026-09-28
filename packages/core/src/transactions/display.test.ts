import { describe, it, expect } from "vitest";
import { amountDisplay, groupLedger, transactionTitle, type AmountTxn, type TitleTxn } from "./display";

const base: AmountTxn = {
  type: "expense",
  amount: 100,
  total_amount: 118,
  to_amount: null,
  currency: "DOP",
  statement_line_id: null,
  to_account_id: null,
  to_account: null,
};
const t = (over: Partial<AmountTxn>): AmountTxn => ({ ...base, ...over });

describe("amountDisplay", () => {
  it("prints an expense as a minus over the full cost", () => {
    expect(amountDisplay(t({}))).toEqual({ value: 118, currency: "DOP", sign: "−", income: false });
  });

  it("prints income as a plus, on the amount (not total)", () => {
    expect(amountDisplay(t({ type: "income" }))).toEqual({ value: 100, currency: "DOP", sign: "+", income: true });
  });

  it("prints a negative statement expense (refund) as a plus", () => {
    const r = amountDisplay(t({ statement_line_id: "l1", total_amount: -40 }));
    expect(r).toEqual({ value: 40, currency: "DOP", sign: "+", income: true });
  });

  it("prints a payment without a sign", () => {
    const r = amountDisplay(t({ type: "payment", total_amount: 300 }));
    expect(r).toEqual({ value: 300, currency: "DOP", sign: "", income: false });
  });

  it("switches a payment to its destination leg on the receiving account's page", () => {
    const r = amountDisplay(
      t({ type: "payment", to_amount: 5, to_account_id: "dst", to_account: { currency: "USD" } }),
      "dst",
    );
    expect(r).toEqual({ value: 5, currency: "USD", sign: "", income: false });
  });

  it("keeps the source leg on the source account's page", () => {
    const r = amountDisplay(
      t({ type: "payment", total_amount: 300, to_amount: 5, to_account_id: "dst", to_account: { currency: "USD" } }),
      "src",
    );
    expect(r.value).toBe(300);
    expect(r.currency).toBe("DOP");
  });
});

describe("transactionTitle", () => {
  const base: TitleTxn = { type: "expense", description: null, category: null, account: null };
  const t = (over: Partial<TitleTxn>): TitleTxn => ({ ...base, ...over });

  it("prefers the transaction's own description", () => {
    const title = transactionTitle(
      t({ description: "Coffee", category: { name: "Dining" } }),
      "Income",
      "Transaction",
    );
    expect(title).toBe("Coffee");
  });

  it("falls back to the category name when there is no description", () => {
    const title = transactionTitle(t({ category: { name: "Dining" } }), "Income", "Transaction");
    expect(title).toBe("Dining");
  });

  it("falls back to the income label for an uncategorized income row", () => {
    const title = transactionTitle(t({ type: "income" }), "Income", "Transaction");
    expect(title).toBe("Income");
  });

  it("falls back to the account name for a non-income row with no category", () => {
    const title = transactionTitle(t({ account: { name: "Checking" } }), "Income", "Transaction");
    expect(title).toBe("Checking");
  });

  it("falls back to the generic label when nothing else is available", () => {
    expect(transactionTitle(t({}), "Income", "Transaction")).toBe("Transaction");
  });
});

describe("groupLedger", () => {
  const rows = [
    { id: "a", occurred_at: "2026-09-04T00:00:00.000Z" },
    { id: "b", occurred_at: "2026-09-04T00:00:00.000Z" },
    { id: "c", occurred_at: "2026-09-02T00:00:00.000Z" },
    { id: "d", occurred_at: "2026-08-30T00:00:00.000Z" },
  ];
  const label = (y: number, m: number) => `${y}-${m}`;

  it("groups by month, then by day, preserving order", () => {
    const g = groupLedger(rows, label);
    expect(g.map((m) => m.monthKey)).toEqual(["2026-09", "2026-08"]);
    expect(g[0].label).toBe("2026-9");
    expect(g[0].days.map((d) => d.day)).toEqual(["2026-09-04", "2026-09-02"]);
    expect(g[0].days[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(g[1].days[0].day).toBe("2026-08-30");
  });

  it("returns nothing for no rows", () => {
    expect(groupLedger([], label)).toEqual([]);
  });
});
