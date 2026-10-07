import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { addCardLines } from "./card-group";

/** Chainable query builder, awaitable directly or through single(). */
function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.single = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

const SOLO = {
  id: "acc-1",
  name: "Popular Visa",
  card_group_id: null,
  card_line: "DOP",
  color: "#123456",
  brand: "visa",
  last4: "4921",
};

function stub({
  insertError = null as unknown,
  linkError = null as unknown,
  groupName = "Popular Visa",
} = {}) {
  const accountInsert = vi.fn(() =>
    chainable(
      insertError
        ? { data: null, error: insertError }
        : { data: [{ id: "acc-usd", card_line: "USD" }, { id: "acc-cuotas", card_line: "CUOTAS" }], error: null },
    ),
  );
  const accountUpdate = vi.fn(() => chainable({ error: null }));
  accountUpdate.mockImplementationOnce(() => chainable({ error: linkError }));
  const groupInsert = vi.fn(() => chainable({ data: { id: "grp-new" }, error: null }));
  let deletedGroupEq: Mock | undefined;
  const groupDelete = vi.fn(() => {
    const obj = chainable({ error: null });
    deletedGroupEq = obj.eq as Mock;
    return obj;
  });
  const supabase = {
    from: vi.fn((table: string) =>
      table === "card_groups"
        ? chainable({ data: { name: groupName } }, { insert: groupInsert, delete: groupDelete })
        : chainable({ data: null }, { insert: accountInsert, update: accountUpdate }),
    ),
  };
  return { supabase: supabase as never, accountInsert, accountUpdate, groupInsert, groupDelete, deleted: () => deletedGroupEq };
}

describe("addCardLines", () => {
  it("promotes an ungrouped card: a group under its name, the card renamed as its DOP line", async () => {
    const s = stub();
    const r = await addCardLines(s.supabase, "user-1", SOLO, ["USD", "CUOTAS"], "Cuotas");

    expect(r).toEqual({ groupId: "grp-new", ids: new Map([["USD", "acc-usd"], ["CUOTAS", "acc-cuotas"]]) });
    expect(s.groupInsert).toHaveBeenCalled();
    expect(s.accountUpdate).toHaveBeenCalledWith({ card_group_id: "grp-new", name: "Popular Visa · DOP" });
    const rows = (s.accountInsert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>[];
    expect(rows.map((r) => [r.name, r.card_line, r.currency, r.card_group_id, r.last4, r.color])).toEqual([
      ["Popular Visa · USD", "USD", "USD", "grp-new", "4921", "#123456"],
      ["Popular Visa · Cuotas", "CUOTAS", "DOP", "grp-new", "4921", "#123456"],
    ]);
  });

  it("adds only the lines asked for, to the card's existing group", async () => {
    const s = stub({ groupName: "Visa Gold" });
    await addCardLines(s.supabase, "user-1", { ...SOLO, card_group_id: "grp-existing" }, ["CUOTAS"], "Cuotas");

    expect(s.groupInsert).not.toHaveBeenCalled();
    expect(s.accountUpdate).not.toHaveBeenCalled();
    const rows = (s.accountInsert as unknown as Mock).mock.calls[0][0] as Record<string, unknown>[];
    expect(rows.map((r) => [r.name, r.card_group_id])).toEqual([["Visa Gold · Cuotas", "grp-existing"]]);
  });

  it("deletes the group it just created if linking the card to it fails", async () => {
    const s = stub({ linkError: { code: "XXXXX", message: "boom" } });
    const r = await addCardLines(s.supabase, "user-1", SOLO, ["USD"], "Cuotas");

    expect("error" in r).toBe(true);
    expect(s.accountInsert).not.toHaveBeenCalled();
    // .delete() alone selects nothing; .eq is what targets only the new group.
    expect(s.deleted()).toHaveBeenCalledWith("id", "grp-new");
  });

  it("undoes a promotion it made if the new lines fail to insert", async () => {
    const s = stub({ insertError: { code: "XXXXX", message: "boom" } });
    const r = await addCardLines(s.supabase, "user-1", SOLO, ["USD"], "Cuotas");

    expect("error" in r).toBe(true);
    expect(s.accountUpdate).toHaveBeenLastCalledWith({ card_group_id: null, name: "Popular Visa" });
    expect(s.deleted()).toHaveBeenCalledWith("id", "grp-new");
  });

  it("never deletes a group that already existed", async () => {
    const s = stub({ insertError: { code: "XXXXX", message: "boom" } });
    const r = await addCardLines(s.supabase, "user-1", { ...SOLO, card_group_id: "grp-existing" }, ["USD"], "Cuotas");

    expect("error" in r).toBe(true);
    expect(s.groupDelete).not.toHaveBeenCalled();
  });
});
