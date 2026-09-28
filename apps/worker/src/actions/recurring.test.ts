import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("#/i18n", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { createClient } from "#/lib/supabase/server";
import { addCharge, createSubscription, updateSubscription } from "./recurring";

const VALID = {
  name: "Netflix",
  amount: 15.99,
  currency: "USD",
  billing_cycle: "monthly" as const,
  is_active: true,
};

/** Income has to name the account it lands in — see lib/subscriptions/schema. */
const VALID_INCOME = {
  ...VALID,
  kind: "income" as const,
  account_id: "44444444-4444-4444-8444-444444444444",
};

type Row = { name?: string };

/**
 * A Supabase stub narrow enough to answer two questions: what the read on
 * `subscriptions` returned, and what payload the write received.
 */
function stub(
  read: { data?: Row | null; error?: unknown } = { data: null },
  opts: { count?: number } = {},
) {
  const writes: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => read);
  chain.single = vi.fn(async () => ({ data: { id: "sub-1" }, error: null }));
  chain.insert = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  chain.update = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  // Serves two different awaits: a plain `.update(...).eq(...)` (only reads
  // `.error`) and the pay-cycle sync's `.select("id", {count}).eq().eq()`
  // (only reads `.count`) — each ignores the field it doesn't care about.
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ error: null, count: opts.count ?? null });

  (createClient as unknown as Mock).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn(() => chain),
  });
  return writes;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/** Emoji and colour are the person's choice, stored as given, like a category's. */
describe("saving a subscription stores its emoji and colour", () => {
  it("writes both on create", async () => {
    const writes = stub();

    await createSubscription({ ...VALID, emoji: "🎬", color: "#E85B3F" });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ name: "Netflix", emoji: "🎬", color: "#E85B3F" });
  });

  it("writes both on update", async () => {
    const writes = stub();

    await updateSubscription("sub-1", { ...VALID, name: "Spotify", emoji: "🎧", color: "#4AA331" });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ name: "Spotify", emoji: "🎧", color: "#4AA331" });
  });

  it("stores blanks as null", async () => {
    const writes = stub();

    await createSubscription({ ...VALID, emoji: "", color: "" });

    expect(writes[0]).toMatchObject({ emoji: null, color: null });
  });

  it("rejects an emoji field that is not an emoji's length", async () => {
    const writes = stub();

    const result = await createSubscription({ ...VALID, emoji: "not an emoji" });

    expect(result.error).toBeTruthy();
    expect(writes).toHaveLength(0);
  });
});

/**
 * Recording turns the template into a transaction. A stub that answers per
 * table: the template read, the profile read, and the transaction insert.
 */
function recordStub(template: Record<string, unknown> | null, baseCurrency = "DOP") {
  const inserts: Record<string, unknown>[] = [];
  const reads: Record<string, unknown> = {
    subscriptions: { data: template, error: null },
    profiles: { data: { base_currency: baseCurrency }, error: null },
  };
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => reads[table]);
    chain.insert = vi.fn(async (row: Record<string, unknown>) => {
      inserts.push(row);
      return { error: null };
    });
    return chain;
  });
  (createClient as unknown as Mock).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from,
  });
  return inserts;
}

const template = (over: Record<string, unknown> = {}) => ({
  id: "sub-1",
  kind: "expense",
  name: "Gym",
  amount: 1500,
  currency: "DOP",
  account_id: "acct-1",
  to_account_id: null,
  category_id: "cat-1",
  include_tax: true,
  include_commission: true,
  account: { currency: "DOP", type: "checking" },
  to_account: null,
  ...over,
});

describe("addCharge records the template", () => {
  it("writes an expense from a bank with the template's fees", async () => {
    const inserts = recordStub(template());

    expect(await addCharge("sub-1")).toEqual({ id: "sub-1" });
    expect(inserts[0]).toMatchObject({
      type: "expense",
      account_id: "acct-1",
      to_account_id: null,
      category_id: "cat-1",
      amount: 1500,
      currency: "DOP",
      include_tax: true,
      include_commission: true,
      exclude_from_budget: false,
      subscription_id: "sub-1",
      description: "Gym",
    });
  });

  it("keeps a card charge fee-free and off the budget, as before", async () => {
    const inserts = recordStub(template({ account: { currency: "DOP", type: "credit_card" } }));

    await addCharge("sub-1");

    expect(inserts[0]).toMatchObject({
      include_tax: false,
      include_commission: false,
      exclude_from_budget: true,
    });
  });

  it("carries a payment's category through to the recorded transaction", async () => {
    const inserts = recordStub(
      template({
        kind: "payment",
        name: "Savings transfer",
        to_account_id: "acct-2",
        to_account: { currency: "DOP" },
        account: { currency: "DOP", type: "savings" },
        include_commission: false,
      }),
    );

    expect(await addCharge("sub-1")).toEqual({ id: "sub-1" });
    expect(inserts[0]).toMatchObject({
      type: "payment",
      account_id: "acct-1",
      to_account_id: "acct-2",
      category_id: "cat-1",
      to_amount: null,
      include_tax: true,
      include_commission: false,
      exclude_from_budget: false,
    });
  });

  it("refuses a payment whose destination is gone", async () => {
    const inserts = recordStub(template({ kind: "payment", to_account_id: null, to_account: null }));

    expect(await addCharge("sub-1")).toEqual({ error: "needsToAccount" });
    expect(inserts).toHaveLength(0);
  });

  // 1:1 across currencies is never a safe assumption — the same rule quick-add follows.
  it("asks for the destination leg across currencies, then writes it", async () => {
    const payment = template({
      kind: "payment",
      to_account_id: "acct-2",
      to_account: { currency: "USD" },
    });

    recordStub(payment);
    expect(await addCharge("sub-1")).toEqual({ error: "needsToAmount" });

    const inserts = recordStub(payment);
    await addCharge("sub-1", { toAmount: 25 });
    expect(inserts[0]).toMatchObject({ amount: 1500, to_amount: 25, currency: "DOP" });
  });

  it("writes an income transaction to its destination account, fee-free", async () => {
    const inserts = recordStub(template({ kind: "income", name: "Paycheck", category_id: null }));

    expect(await addCharge("sub-1")).toEqual({ id: "sub-1" });
    expect(inserts[0]).toMatchObject({
      type: "income",
      account_id: "acct-1",
      to_account_id: null,
      category_id: null,
      amount: 1500,
      currency: "DOP",
      include_tax: false,
      include_commission: false,
      exclude_from_budget: false,
      subscription_id: "sub-1",
      description: "Paycheck",
    });
  });
});

describe("saving a template keeps one schedule and one shape", () => {
  it("stores a biweekly start date and drops any day number", async () => {
    const writes = stub();

    await createSubscription({ ...VALID, billing_cycle: "biweekly", anchor_day: 5, anchor_date: "2026-09-04" });

    expect(writes[0]).toMatchObject({ billing_cycle: "biweekly", anchor_day: null, anchor_date: "2026-09-04" });
  });

  it("rejects a biweekly template with no start date", async () => {
    const writes = stub();

    expect((await createSubscription({ ...VALID, billing_cycle: "biweekly" })).error).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("drops the start date on a day-number cycle", async () => {
    const writes = stub();

    await createSubscription({ ...VALID, anchor_day: 3, anchor_date: "2026-09-04" });

    expect(writes[0]).toMatchObject({ anchor_day: 3, anchor_date: null });
  });

  it("stores a payment's destination and keeps its category", async () => {
    const writes = stub();
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    const c = "33333333-3333-4333-8333-333333333333";

    await createSubscription({ ...VALID, kind: "payment", account_id: a, to_account_id: b, category_id: c });

    expect(writes[0]).toMatchObject({ kind: "payment", account_id: a, to_account_id: b, category_id: c });
  });

  it("leaves a payment's category null when none was picked", async () => {
    const writes = stub();
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";

    // Optional, not required: the empty string the Select's "none" resolves to
    // must land as null rather than as a category id of "".
    await createSubscription({ ...VALID, kind: "payment", account_id: a, to_account_id: b, category_id: "" });

    expect(writes[0]).toMatchObject({ kind: "payment", category_id: null });
  });

  it("rejects a payment into the account it comes from", async () => {
    const writes = stub();
    const a = "11111111-1111-4111-8111-111111111111";

    expect((await createSubscription({ ...VALID, kind: "payment", account_id: a, to_account_id: a })).error).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("never stores a destination on an expense", async () => {
    const writes = stub();

    await createSubscription({ ...VALID, to_account_id: "22222222-2222-4222-8222-222222222222" });

    expect(writes[0]).toMatchObject({ kind: "expense", to_account_id: null });
  });

  it("rejects an income template with no deposit account", async () => {
    const writes = stub();

    // "" is what the account Select's "none" submits. It could be saved before,
    // then failed at record time with needsAccount — the account is what gives
    // the recorded deposit its currency.
    expect((await createSubscription({ ...VALID_INCOME, account_id: "" })).error).toBeTruthy();
    expect(writes).toHaveLength(0);
  });

  it("never stores a category or destination on an income template", async () => {
    const writes = stub();

    await createSubscription({
      ...VALID_INCOME,
      category_id: "22222222-2222-4222-8222-222222222222",
      to_account_id: "33333333-3333-4333-8333-333333333333",
    });

    expect(writes[0]).toMatchObject({ kind: "income", to_account_id: null, category_id: null });
  });
});

describe("saving an active income template syncs the pay cycle", () => {
  it("maps a monthly income template onto pay_cycle when it's the only one", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID_INCOME, billing_cycle: "monthly", anchor_day: 15 });

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ pay_cycle: "monthly", pay_anchor_day: 15 });
  });

  it("remaps a weekly income template's anchor day to ISO", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID_INCOME, billing_cycle: "weekly", anchor_day: 6 });

    expect(writes[1]).toMatchObject({ pay_cycle: "weekly", pay_anchor_day: 5 });
  });

  it("does not sync when a second active income template already exists", async () => {
    const writes = stub(undefined, { count: 2 });

    await createSubscription({ ...VALID_INCOME, billing_cycle: "monthly", anchor_day: 15 });

    expect(writes).toHaveLength(1);
  });

  it("does not sync an inactive income template", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID_INCOME, billing_cycle: "monthly", is_active: false });

    expect(writes).toHaveLength(1);
  });

  it("does not sync a non-income template", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID, kind: "expense" });

    expect(writes).toHaveLength(1);
  });

  it("does not sync a cycle with no pay_cycle equivalent", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({
      ...VALID_INCOME,
      billing_cycle: "biweekly",
      anchor_date: "2026-09-04",
    });

    expect(writes).toHaveLength(1);
  });

  it("also syncs on update, not just create", async () => {
    const writes = stub({ data: { name: "Netflix" } }, { count: 1 });

    await updateSubscription("sub-1", { ...VALID_INCOME, billing_cycle: "monthly", anchor_day: 1 });

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ pay_cycle: "monthly", pay_anchor_day: 1 });
  });
});
