import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("#/i18n", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { createClient } from "#/lib/supabase/server";
import { updateRule, deleteRule } from "./rules";

function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

function stub(category: unknown) {
  const update = vi.fn(() => chainable({ error: null }));
  const del = vi.fn(() => chainable({ error: null }));
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => {
      if (table === "categories") return chainable({ data: category });
      return chainable({ error: null }, { update, delete: del });
    }),
    update,
    del,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("updateRule", () => {
  it("normalises the pattern before saving", async () => {
    const s = stub({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(s);
    const result = await updateRule("rule-1", { pattern: "  sm nacional ", categoryId: "cat-1" });
    expect(result.error).toBeUndefined();
    expect(s.update).toHaveBeenCalledWith({ pattern: "SM NACIONAL", category_id: "cat-1" });
  });

  it("rejects an empty pattern", async () => {
    const s = stub({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(s);
    const result = await updateRule("rule-1", { pattern: "   ", categoryId: "cat-1" });
    expect(result.error).toBeTruthy();
    expect(s.update).not.toHaveBeenCalled();
  });

  it("rejects a category that is not the caller's", async () => {
    const s = stub(null);
    (createClient as Mock).mockResolvedValue(s);
    const result = await updateRule("rule-1", { pattern: "SM NACIONAL", categoryId: "nope" });
    expect(result.error).toBeTruthy();
    expect(s.update).not.toHaveBeenCalled();
  });
});

describe("deleteRule", () => {
  it("deletes by id", async () => {
    const s = stub({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(s);
    const result = await deleteRule("rule-1");
    expect(result.error).toBeUndefined();
    expect(s.del).toHaveBeenCalled();
  });
});
