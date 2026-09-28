import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "#/lib/supabase/server";
import { getPendingTriageCounts } from "./queries";

function chainable(result: unknown) {
  const obj: Record<string, unknown> = {};
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.in = vi.fn(() => obj);
  obj.not = vi.fn(() => obj);
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

describe("getPendingTriageCounts", () => {
  it("counts only null-category lines, and omits statements with none", async () => {
    (createClient as Mock).mockResolvedValue({
      from: vi.fn((table: string) =>
        table === "card_statements"
          ? chainable({
              data: [
                { id: "st-1", import_id: "imp-1" },
                { id: "st-2", import_id: "imp-2" },
              ],
            })
          : chainable({
              data: [
                { statement_id: "st-1", transaction: { category_id: null } },
                { statement_id: "st-1", transaction: { category_id: null } },
                { statement_id: "st-1", transaction: { category_id: "cat-1" } },
                { statement_id: "st-2", transaction: { category_id: "cat-1" } },
              ],
            }),
      ),
    });

    const counts = await getPendingTriageCounts("acc-1");

    expect(counts["st-1"]).toEqual({ importId: "imp-1", count: 2 });
    expect(counts["st-2"]).toBeUndefined();
  });
});
