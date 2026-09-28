import { describe, it, expect } from "vitest";
import { orderByNext } from "./order";

const sub = (name: string, over: Partial<{ is_active: boolean; billing_cycle: string; anchor_day: number | null; anchor_date: string | null }> = {}) => ({
  name,
  is_active: true,
  billing_cycle: "monthly",
  anchor_day: 20,
  anchor_date: null,
  ...over,
});

const from = new Date(2026, 8, 10); // 10 Sep 2026, local

describe("orderByNext", () => {
  it("sorts by the next charge date, soonest first", () => {
    const out = orderByNext([sub("late", { anchor_day: 28 }), sub("soon", { anchor_day: 12 })], from);
    expect(out.map((s) => s.name)).toEqual(["soon", "late"]);
  });
  it("puts paused templates after every active one", () => {
    const out = orderByNext([sub("paused", { is_active: false, anchor_day: 11 }), sub("active", { anchor_day: 28 })], from);
    expect(out.map((s) => s.name)).toEqual(["active", "paused"]);
  });
  it("keeps the input order for ties and does not mutate the input", () => {
    const input = [sub("a", { anchor_day: 15 }), sub("b", { anchor_day: 15 })];
    const out = orderByNext(input, from);
    expect(out.map((s) => s.name)).toEqual(["a", "b"]);
    expect(out).not.toBe(input);
  });
});
