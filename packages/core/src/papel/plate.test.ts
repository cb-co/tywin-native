import { describe, it, expect } from "vitest";
import { HATCHES, hatchFor } from "./plate";

describe("hatchFor", () => {
  it("has eight patterns that differ from each other", () => {
    expect(HATCHES).toHaveLength(8);
    const keys = HATCHES.map((h) => `${h.angle}/${h.gap}`);
    expect(new Set(keys).size).toBe(8);
  });
  it("maps a zero-based index onto slots 1..8 and wraps", () => {
    expect(hatchFor(0).slot).toBe(1);
    expect(hatchFor(7).slot).toBe(8);
    expect(hatchFor(8).slot).toBe(1);
  });
  it("never returns a negative or fractional slot", () => {
    expect(hatchFor(-1).slot).toBe(8);
    expect(hatchFor(2.7).slot).toBe(3);
  });
});
