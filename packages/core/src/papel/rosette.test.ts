import { describe, it, expect } from "vitest";
import { rosettePath } from "./rosette";

describe("rosettePath", () => {
  it("returns an SVG path that starts with a move and stays inside the box", () => {
    const d = rosettePath(64);
    expect(d.startsWith("M")).toBe(true);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(nums.length).toBeGreaterThan(100);
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(64);
    }
  });
  it("is deterministic", () => {
    expect(rosettePath(48)).toBe(rosettePath(48));
  });
});
