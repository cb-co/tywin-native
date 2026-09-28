import { describe, expect, it } from "vitest";
import {
  defaultAccount,
  feeParts,
  orderCategories,
  rankCategoryIds,
  recentSourceAccountId,
  resolveFeeDefaults,
  type RecentRow,
} from "./defaults";
import type { QuickAddAccount, QuickAddCategory } from "./types";

function row(over: Partial<RecentRow> = {}): RecentRow {
  return { account_id: "a-checking", category_id: null, type: "expense", ...over };
}

function account(over: Partial<QuickAddAccount> = {}): QuickAddAccount {
  return {
    id: "a-checking",
    name: "Popular",
    currency: "DOP",
    type: "checking",
    network_fee_optional: true,
    bank_id: "bank-popular",
    transfer_tax_rate: 0,
    network_fee_amount: 0,
    ...over,
  };
}

function category(id: string): QuickAddCategory {
  return { id, name: id, emoji: null, color: null, budget_group_id: null };
}

describe("rankCategoryIds", () => {
  it("orders by how often a category appears", () => {
    const recent = [
      row({ category_id: "food" }),
      row({ category_id: "transport" }),
      row({ category_id: "food" }),
    ];
    expect(rankCategoryIds(recent)).toEqual(["food", "transport"]);
  });

  it("counts expenses only — income has no category and payments default to none", () => {
    const recent = [
      row({ category_id: "transport" }),
      row({ category_id: "food", type: "payment" }),
      row({ category_id: "food", type: "payment" }),
    ];
    expect(rankCategoryIds(recent)).toEqual(["transport"]);
  });

  it("ignores uncategorised rows rather than ranking a null", () => {
    expect(rankCategoryIds([row(), row({ category_id: "food" })])).toEqual(["food"]);
  });

  it("returns nothing for an empty history", () => {
    expect(rankCategoryIds([])).toEqual([]);
  });
});

describe("recentSourceAccountId", () => {
  it("takes the source account of the most recent row", () => {
    // The query hands rows back newest-first; this trusts that order rather
    // than re-sorting, so it must not scan for anything but the first hit.
    const recent = [row({ account_id: "a-visa" }), row({ account_id: "a-checking" })];
    expect(recentSourceAccountId(recent)).toBe("a-visa");
  });

  it("skips rows with no source account", () => {
    expect(recentSourceAccountId([row({ account_id: null }), row({ account_id: "a-cash" })])).toBe(
      "a-cash",
    );
  });

  it("returns null for an empty history", () => {
    expect(recentSourceAccountId([])).toBe(null);
  });
});

describe("defaultAccount", () => {
  const accounts = [
    account({ id: "a-visa", type: "credit_card" }),
    account({ id: "a-checking", type: "checking" }),
    account({ id: "a-savings", type: "savings" }),
  ];

  it("prefers an explicitly requested account", () => {
    // The account detail page opens the form scoped to one account.
    expect(defaultAccount(accounts, { preferredId: "a-savings", recentAccountId: "a-visa" })?.id)
      .toBe("a-savings");
  });

  it("falls back to the most recently used account", () => {
    expect(defaultAccount(accounts, { recentAccountId: "a-visa" })?.id).toBe("a-visa");
  });

  it("ignores a remembered account that no longer exists", () => {
    // Archived or deleted since the row was written: the list excludes it.
    expect(defaultAccount(accounts, { recentAccountId: "a-gone" })?.id).toBe("a-checking");
  });

  it("falls back to the first bank account, never to whatever came first", () => {
    // A card or loan is a bad default source for a new expense.
    expect(defaultAccount(accounts, {})?.id).toBe("a-checking");
  });

  it("falls back to the first account when none is a bank account", () => {
    const cards = [account({ id: "a-visa", type: "credit_card" })];
    expect(defaultAccount(cards, {})?.id).toBe("a-visa");
  });

  it("returns undefined when there are no accounts at all", () => {
    expect(defaultAccount([], {})).toBeUndefined();
  });
});

describe("orderCategories", () => {
  const categories = [category("food"), category("transport"), category("home")];

  it("puts ranked categories first, in rank order", () => {
    expect(orderCategories(categories, ["home", "transport"]).map((c) => c.id)).toEqual([
      "home",
      "transport",
      "food",
    ]);
  });

  it("keeps unranked categories in their existing sort_order", () => {
    expect(orderCategories(categories, []).map((c) => c.id)).toEqual([
      "food",
      "transport",
      "home",
    ]);
  });

  it("drops ranked ids that no longer match a category", () => {
    expect(orderCategories(categories, ["deleted", "home"]).map((c) => c.id)).toEqual([
      "home",
      "food",
      "transport",
    ]);
  });
});

const bank = { type: "checking" };
const savings = { type: "savings" };
const cash = { type: "cash" };
const card = { type: "credit_card" };
const loan = { type: "loan" };

describe("resolveFeeDefaults", () => {
  // The transfer tax is an "impuesto por débito a cuenta" — it follows the
  // bank debit, so what the money came OUT of decides it.
  it("taxes an expense paid from a bank account", () => {
    expect(resolveFeeDefaults({ type: "expense", src: bank })).toEqual({
      include_tax: true,
      include_commission: false,
    });
  });

  it("does not tax an expense paid in cash or on a card — no account was debited", () => {
    expect(resolveFeeDefaults({ type: "expense", src: cash }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "expense", src: card }).include_tax).toBe(false);
  });

  it("taxes a payment into a card or a loan", () => {
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: card }).include_tax).toBe(true);
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: loan }).include_tax).toBe(true);
  });

  it("does not tax money moved between the user's own accounts", () => {
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: cash }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: bank }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: savings }).include_tax).toBe(false);
  });

  it("does not tax a payment that did not come from a bank account", () => {
    expect(resolveFeeDefaults({ type: "payment", src: cash, dst: card }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "payment", src: card, dst: loan }).include_tax).toBe(false);
  });

  it("never taxes income", () => {
    expect(resolveFeeDefaults({ type: "income", src: bank }).include_tax).toBe(false);
  });

  it("holds off until a destination is chosen", () => {
    // Showing a tax line for a payment with no destination would announce a
    // charge the user has not yet described.
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: null }).include_tax).toBe(false);
  });

  it("never turns the network fee on by default", () => {
    // A flat per-transfer commission is charged by some transfers and not
    // others; it is added deliberately, not assumed.
    for (const args of [
      { type: "expense", src: bank },
      { type: "payment", src: bank, dst: card },
      { type: "payment", src: bank, dst: loan },
    ] as const) {
      expect(resolveFeeDefaults(args).include_commission).toBe(false);
    }
  });

  it("handles a missing source without throwing", () => {
    expect(resolveFeeDefaults({ type: "expense", src: null })).toEqual({
      include_tax: false,
      include_commission: false,
    });
  });
});

describe("feeParts", () => {
  const src = { bank_id: "bank-popular", transfer_tax_rate: 0.002, network_fee_amount: 25 };

  it("previews the tax as a share of the amount", () => {
    expect(feeParts({ amount: 250, src, include_tax: true, include_commission: false })).toEqual({
      tax: 0.5,
      fee: 0,
    });
  });

  it("previews nothing when the flag is off", () => {
    expect(feeParts({ amount: 250, src, include_tax: false, include_commission: false })).toEqual({
      tax: 0,
      fee: 0,
    });
  });

  it("rounds the tax to the 4dp the column stores", () => {
    expect(feeParts({ amount: 333.33, src, include_tax: true, include_commission: false }).tax)
      .toBe(0.6667);
  });

  it("previews the network fee as a flat amount, not a rate", () => {
    expect(
      feeParts({
        amount: 1000,
        src,
        dst: { bank_id: "bank-bhd" },
        include_tax: false,
        include_commission: true,
      }).fee,
    ).toBe(25);
  });

  it("waives the fee within the same bank", () => {
    expect(
      feeParts({
        amount: 1000,
        src,
        dst: { bank_id: "bank-popular" },
        include_tax: false,
        include_commission: true,
      }).fee,
    ).toBe(0);
  });

  it("does not treat two unknown banks as the same bank", () => {
    // Two nulls are not a match — that would waive a fee that was charged.
    expect(
      feeParts({
        amount: 1000,
        src: { ...src, bank_id: null },
        dst: { bank_id: null },
        include_tax: false,
        include_commission: true,
      }).fee,
    ).toBe(25);
  });

  it("treats a missing source as costing nothing", () => {
    expect(feeParts({ amount: 250, src: null, include_tax: true, include_commission: true }))
      .toEqual({ tax: 0, fee: 0 });
  });
});
