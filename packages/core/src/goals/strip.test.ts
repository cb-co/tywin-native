import { describe, it, expect } from "vitest";
import { goalStripCells } from "./strip";

const count = (cells: string[], k: string) => cells.filter((c) => c === k).length;

describe("goalStripCells", () => {
  it("draws an empty strip at 0%", () => {
    const c = goalStripCells(0, 1);
    expect(c).toHaveLength(20);
    expect(count(c, "empty")).toBe(20);
  });
  it("fills the strip only when the goal is complete", () => {
    expect(count(goalStripCells(100, 1), "solid")).toBe(20);
    expect(count(goalStripCells(99.6, 1), "empty")).toBeGreaterThan(0);
  });
  it("shows at least one cell for any progress", () => {
    expect(count(goalStripCells(1, 1), "solid")).toBe(1);
  });
  it("orders solid, then borrowed, then empty", () => {
    const c = goalStripCells(50, 0.5);
    expect(c.slice(0, 5).every((x) => x === "solid")).toBe(true);
    expect(c.slice(5, 10).every((x) => x === "borrowed")).toBe(true);
    expect(c.slice(10).every((x) => x === "empty")).toBe(true);
  });
  it("never hides a borrowed-back share, however small", () => {
    expect(count(goalStripCells(50, 0.99), "borrowed")).toBe(1);
  });
  it("clamps out-of-range input", () => {
    expect(count(goalStripCells(-10, 1), "empty")).toBe(20);
    expect(count(goalStripCells(250, 1), "solid")).toBe(20);
    expect(goalStripCells(50, 5)).toHaveLength(20);
  });
});
