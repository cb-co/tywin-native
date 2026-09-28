import { describe, it, expect } from "vitest";
import { perforationCells } from "./perforation";

describe("perforationCells", () => {
  it("marks the first `paid` cells as punched", () => {
    const { cells, hidden } = perforationCells(6, 2);
    expect(cells.map((c) => c.paid)).toEqual([true, true, false, false, false, false]);
    expect(hidden).toBe(0);
  });
  it("clamps paid into 0..total", () => {
    expect(perforationCells(3, 9).cells.every((c) => c.paid)).toBe(true);
    expect(perforationCells(3, -1).cells.some((c) => c.paid)).toBe(false);
  });
  it("scales a long term into the cap so progress stays proportional", () => {
    const { cells, hidden } = perforationCells(48, 10, 24);
    expect(cells).toHaveLength(24);
    expect(cells.filter((c) => c.paid)).toHaveLength(5);
    expect(hidden).toBe(0);
  });
  it("shows at least one cell for any progress but only fills when finished", () => {
    expect(perforationCells(120, 1, 24).cells.filter((c) => c.paid)).toHaveLength(1);
    expect(perforationCells(120, 119, 24).cells.every((c) => c.paid)).toBe(false);
    expect(perforationCells(120, 120, 24).cells.every((c) => c.paid)).toBe(true);
  });
  it("returns nothing for a zero or invalid total", () => {
    expect(perforationCells(0, 0).cells).toEqual([]);
    expect(perforationCells(Number.NaN, 1).cells).toEqual([]);
  });
  it("punches every cell when paid equals total", () => {
    const { cells, hidden } = perforationCells(4, 4);
    expect(cells.every((c) => c.paid)).toBe(true);
    expect(hidden).toBe(0);
  });
  it("handles a fractional total without throwing", () => {
    const { cells } = perforationCells(3.5, 1);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(4);
  });
});
