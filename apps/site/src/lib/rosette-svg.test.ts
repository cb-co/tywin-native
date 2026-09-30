import { describe, expect, it } from "vitest";
import { ROSETTE_LAYERS } from "@cigua/core/papel/rosette";
import { ROSETTE_EXTENT, rosetteLayerPaths } from "./rosette-svg";

describe("rosetteLayerPaths", () => {
  const paths = rosetteLayerPaths();

  it("draws one path per lathe layer", () => {
    expect(paths).toHaveLength(ROSETTE_LAYERS.length);
    for (const d of paths) expect(d.startsWith("M")).toBe(true);
  });

  it("stays inside the viewBox the canvas used (±176)", () => {
    for (const d of paths) {
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(Math.max(...nums.map(Math.abs))).toBeLessThanOrEqual(ROSETTE_EXTENT);
    }
  });
});
