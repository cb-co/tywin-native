import { describe, expect, it } from "vitest";
import { sealRingPath } from "./rosette-svg";

describe("sealRingPath", () => {
  it("is light enough to inline on every page", () => {
    expect(sealRingPath().length).toBeLessThan(40_000);
  });

  it("stays inside the seal's 64 box", () => {
    const nums = sealRingPath().match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...nums)).toBeLessThanOrEqual(64);
  });

  it("closes one sub-path per lathe layer", () => {
    expect(sealRingPath().match(/M/g)).toHaveLength(3);
  });
});
