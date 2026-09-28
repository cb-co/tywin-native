import { describe, it, expect } from "vitest";
import { shareRows } from "./share";

const d = (name: string, value: number, categoryId?: string | null) => ({
  name,
  value,
  color: "#123456",
  categoryId,
});

describe("shareRows", () => {
  it("returns each row with its share of the total", () => {
    const rows = shareRows([d("a", 75), d("b", 25)], 100);
    expect(rows.map((r) => r.pct)).toEqual([75, 25]);
    expect(rows.every((r) => !r.rest)).toBe(true);
  });
  it("rolls everything past `max` into one rest row so the rows still sum to the total", () => {
    const rows = shareRows([d("a", 50), d("b", 30), d("c", 15), d("d", 5)], 100, 2);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ rest: true, value: 20, pct: 20 });
  });
  it("gives a zero total zero shares, never NaN", () => {
    expect(shareRows([d("a", 0)], 0)[0].pct).toBe(0);
  });

  it("gives each head row its own category as a single-element list", () => {
    const rows = shareRows([d("Dining", 100, "d1"), d("Transport", 50, "t1")], 150);
    expect(rows.map((r) => r.categoryIds)).toEqual([["d1"], ["t1"]]);
  });

  it("treats an uncategorized head row's null id the same way", () => {
    const rows = shareRows([d("Uncategorized", 100, null)], 100);
    expect(rows[0].categoryIds).toEqual([null]);
  });

  it("folds every tail category's id into the rest row, so tapping it can query all of them", () => {
    const data = Array.from({ length: 9 }, (_, i) => d(`Cat ${i}`, 100 - i, `cat-${i}`));
    const rows = shareRows(data, data.reduce((s, r) => s + r.value, 0), 7);
    const rest = rows.at(-1)!;
    expect(rest.rest).toBe(true);
    expect(rest.categoryIds).toEqual(["cat-7", "cat-8"]);
  });

  it("keeps a null id among the folded categories", () => {
    const data = [
      ...Array.from({ length: 7 }, (_, i) => d(`Cat ${i}`, 100 - i, `cat-${i}`)),
      d("Uncategorized", 10, null),
    ];
    const rows = shareRows(data, data.reduce((s, r) => s + r.value, 0), 7);
    expect(rows.at(-1)!.categoryIds).toEqual([null]);
  });
});
