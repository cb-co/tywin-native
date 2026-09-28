import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "#/lib/supabase/server";
import { collectAskContext, EMPTY_ASK_CONTEXT } from "./context";

function chainable(result: unknown) {
  const obj: Record<string, unknown> = {};
  obj.select = vi.fn(() => obj);
  obj.order = vi.fn(() => obj);
  obj.limit = vi.fn(() => obj);
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

function client(tables: Record<string, unknown>) {
  (createClient as Mock).mockResolvedValue({
    from: vi.fn((table: string) => chainable(tables[table] ?? { data: [] })),
  });
}

const ACCOUNTS = {
  data: [
    { name: "Amex Platinum", type: "credit_card", brand: "amex", last4: "1234", currency: "USD", is_archived: false },
    { name: "Efectivo", type: "cash", brand: null, last4: null, currency: "DOP", is_archived: false },
  ],
};

describe("collectAskContext", () => {
  it("returns the accounts, categories and the range the data covers", async () => {
    client({
      q_accounts: ACCOUNTS,
      categories: { data: [{ name: "Dining" }, { name: "Groceries" }] },
      budget_groups: { data: [{ name: "Essentials" }, { name: "Lifestyle" }] },
      transactions: { data: [{ occurred_at: "2024-03-11T14:02:00+00:00" }] },
    });

    const ctx = await collectAskContext();

    expect(ctx.budgetGroups).toEqual(["Essentials", "Lifestyle"]);
    expect(ctx.accounts).toHaveLength(2);
    expect(ctx.accounts[0]).toMatchObject({ name: "Amex Platinum", last4: "1234", archived: false });
    expect(ctx.categories).toEqual(["Dining", "Groceries"]);
    /* A timestamptz, and the prompt only ever wants the calendar day. */
    expect(ctx.earliest).toBe("2024-03-11");
    expect(ctx.partial).toBe(false);
  });

  /* A view column is nullable in the generated types, and a nameless account is
     not something the model could match a question against. */
  it("drops rows with no name rather than rendering a blank one", async () => {
    client({
      q_accounts: { data: [{ name: null, type: "cash", brand: null, last4: null, currency: "DOP", is_archived: false }] },
      categories: { data: [{ name: null }, { name: "Dining" }] },
    });

    const ctx = await collectAskContext();

    expect(ctx.accounts).toEqual([]);
    expect(ctx.categories).toEqual(["Dining"]);
  });

  /* The view arrives with a migration and this code ships ahead of it.
     PostgREST answers a missing relation with an error, not a throw — losing
     the groups paragraph must not lose the accounts and categories too. */
  it("keeps the rest of the context when budget_groups does not exist yet", async () => {
    client({
      q_accounts: ACCOUNTS,
      categories: { data: [{ name: "Dining" }] },
      budget_groups: { data: null, error: { message: 'relation "budget_groups" does not exist' } },
    });

    const ctx = await collectAskContext();

    expect(ctx.budgetGroups).toEqual([]);
    expect(ctx.accounts).toHaveLength(2);
    expect(ctx.categories).toEqual(["Dining"]);
  });

  it("reports a cut list as partial, so the prompt stops claiming it is complete", async () => {
    client({
      q_accounts: ACCOUNTS,
      categories: { data: Array.from({ length: 61 }, (_, i) => ({ name: `Cat ${i}` })) },
    });

    const ctx = await collectAskContext();

    expect(ctx.categories).toHaveLength(60);
    expect(ctx.partial).toBe(true);
  });

  /* The question is still answerable without any of this — the model falls back
     to the subquery lookup. Nothing here may cost an answer. */
  it("comes back empty rather than throwing when a read fails", async () => {
    (createClient as Mock).mockRejectedValue(new Error("down"));
    expect(await collectAskContext()).toEqual(EMPTY_ASK_CONTEXT);
  });
});
