import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("#/i18n", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("#/lib/statements/triage", () => ({ getImportTriage: vi.fn() }));

import { createClient } from "#/lib/supabase/server";
import { getImportTriage } from "#/lib/statements/triage";
import { categorizeTriageGroup } from "./imports";

// `selectResult`, when given, is what a bare `await` resolves to once `.select()`
// has been called on the chain — mirrors real supabase-js, where `update()`
// alone returns `{ error }` but `update().select()` returns `{ data, error }`.
// `.maybeSingle()` is unaffected: it always resolves through `result`, which is
// what the categories lookup (`.select().eq().maybeSingle()`) relies on.
function chainable(result: unknown, extra: Record<string, unknown> = {}, selectResult?: unknown) {
  const obj: Record<string, unknown> = { ...extra };
  let selected = false;
  obj.select = vi.fn(() => {
    selected = true;
    return obj;
  });
  obj.eq = vi.fn(() => obj);
  obj.is = vi.fn(() => obj);
  obj.in = vi.fn(() => obj);
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(selected && selectResult !== undefined ? selectResult : result);
  return obj;
}

const TRIAGE = {
  importId: "imp-1",
  fileName: "popular.pdf",
  accountName: "Popular Visa",
  totalLines: 3,
  categorizedLines: 0,
  groups: [
    {
      key: "DOP|SM NACIONAL",
      pattern: "SM NACIONAL",
      description: "SM Nacional",
      currency: "DOP",
      count: 2,
      total: 1500,
      transactionIds: ["txn-a", "txn-b"],
      firstDate: "2026-07-02",
      lastDate: "2026-07-10",
    },
  ],
};

function stubWith(category: unknown, writtenRows: { id: string }[] = [{ id: "txn-a" }, { id: "txn-b" }]) {
  const update = vi.fn(() => chainable({ error: null }, {}, { data: writtenRows, error: null }));
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => {
      if (table === "transactions") return chainable({ error: null }, { update });
      if (table === "categories") return chainable({ data: category });
      if (table === "category_rules") return chainable({ data: [] }, { upsert });
      return chainable({ data: null });
    }),
    update,
    upsert,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getImportTriage as Mock).mockResolvedValue(TRIAGE);
});

describe("categorizeTriageGroup", () => {
  it("writes the category onto the group's transactions and saves one rule", async () => {
    const stub = stubWith({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SM NACIONAL", "cat-1");

    expect(result.error).toBeUndefined();
    expect(result.updated).toBe(2);
    expect(stub.update).toHaveBeenCalledWith({ category_id: "cat-1" });
    expect(stub.upsert).toHaveBeenCalledTimes(1);
    expect((stub.upsert as unknown as Mock).mock.calls[0][0]).toMatchObject({
      rule_type: "merchant",
      pattern: "SM NACIONAL",
      category_id: "cat-1",
    });
  });

  it("reports rows actually written, not the size of the group", async () => {
    // One of the group's two transactions was categorised from the ledger
    // between getImportTriage resolving the group and this update running —
    // the `.is("category_id", null)` filter skips it, so only one row writes.
    const stub = stubWith({ id: "cat-1" }, [{ id: "txn-a" }]);
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SM NACIONAL", "cat-1");

    expect(result.error).toBeUndefined();
    expect(result.updated).toBe(1);
  });

  it("refuses a category that is not the caller's", async () => {
    const stub = stubWith(null);
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SM NACIONAL", "cat-someone-else");

    expect(result.error).toBeTruthy();
    expect(stub.update).not.toHaveBeenCalled();
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("refuses a group that is not in this import", async () => {
    const stub = stubWith({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SOMETHING ELSE", "cat-1");

    expect(result.error).toBeTruthy();
    expect(stub.update).not.toHaveBeenCalled();
  });
});
