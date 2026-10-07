import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));
// `unstable_cache` has to be here even though nothing in this file caches:
// modules this file pulls in call it at module scope, so leaving it off the
// mock made the whole FILE fail to collect — which reads as one failing file
// rather than a failing test and is easy to miss in a summary line.
// Real path is lib/accounts/llm/card-art (not lib/accounts/card-art, which only
// holds hasCardAccent/DEFAULT_CARD_ACCENT) — mocking the wrong module would let
// the real inferCardArt run and try to call an LLM during these tests.
vi.mock("#/lib/accounts/llm/card-art", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/accounts/llm/card-art")>()),
  inferCardArt: vi.fn(async () => null),
}));
// dbError() calls getTranslations at module scope of lib/errors.ts; only the
// failure-path tests below reach it, but every test collects the module.
vi.mock("#/i18n", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { createClient } from "#/lib/supabase/server";
import { createCardStub, createCardWithLines } from "./accounts";

function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

beforeEach(() => vi.clearAllMocks());

describe("createCardStub", () => {
  it("writes a credit card with the three describable columns left null", async () => {
    const insert = vi.fn(() => chainable({ data: { id: "acc-new" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn(() => chainable({ data: null }, { insert })),
    });

    const r = await createCardStub({ name: "Popular Visa", currency: "DOP", last4: "4921" });

    expect(r.id).toBe("acc-new");
    const row = (insert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(row.type).toBe("credit_card");
    expect(row.currency).toBe("DOP");
    expect(row.card_line).toBe("DOP");
    expect(row.last4).toBe("4921");
    expect(row).not.toHaveProperty("credit_limit");
    expect(row).not.toHaveProperty("statement_closing_day");
    expect(row).not.toHaveProperty("payment_due_day");
    expect(row.card_group_id).toBeUndefined();
  });

  it("rejects a bad last4 before touching the database", async () => {
    const createClientMock = createClient as Mock;
    const r = await createCardStub({ name: "Popular Visa", currency: "DOP", last4: "49" });
    expect(r.error).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe("createCardWithLines", () => {
  const line = (card_line: "DOP" | "USD" | "CUOTAS", currency: string) => ({
    name: `Visa · ${card_line}`,
    type: "credit_card" as const,
    currency,
    card_line,
    credit_limit: 1000,
    statement_closing_day: 15,
    payment_due_day: 5,
  });

  it("refuses a card with the same line twice before touching the database", async () => {
    const r = await createCardWithLines("Visa", [line("DOP", "DOP"), line("DOP", "DOP")] as never);
    expect(r.error).toBeTruthy();
    expect(createClient as Mock).not.toHaveBeenCalled();
  });

  it("refuses a line held in the wrong currency", async () => {
    const r = await createCardWithLines("Visa", [line("DOP", "DOP"), line("CUOTAS", "USD")] as never);
    expect(r.error).toBeTruthy();
    expect(createClient as Mock).not.toHaveBeenCalled();
  });

  it("writes each line tagged with its line", async () => {
    const accountInsert = vi.fn(() => chainable({ error: null }));
    const groupInsert = vi.fn(() => chainable({ data: { id: "grp-1" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn((table: string) =>
        table === "card_groups" ? chainable({ data: null }, { insert: groupInsert }) : chainable({ data: null }, { insert: accountInsert }),
      ),
    });

    const r = await createCardWithLines("Visa", [line("DOP", "DOP"), line("CUOTAS", "DOP")] as never);

    expect(r.id).toBe("grp-1");
    const rows = (accountInsert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>[];
    expect(rows.map((r) => [r.card_line, r.currency, r.card_group_id])).toEqual([
      ["DOP", "DOP", "grp-1"],
      ["CUOTAS", "DOP", "grp-1"],
    ]);
  });
});
