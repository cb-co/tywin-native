import { describe, expect, it } from "vitest";
import { BRAND_TILE } from "@cigua/core/papel/brand-tile";
import { tilePlatePath } from "./rosette-svg";

describe("tilePlatePath", () => {
  it("draws only the tile's plate layers, inside the 64 box, light enough to inline", () => {
    const d = tilePlatePath();
    expect(d.match(/M/g)).toHaveLength(BRAND_TILE.plateLayers);
    expect(d.length).toBeLessThan(15_000);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const r = 32 * BRAND_TILE.plate;
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(32 - r);
    expect(Math.max(...nums)).toBeLessThanOrEqual(32 + r);
  });
});
