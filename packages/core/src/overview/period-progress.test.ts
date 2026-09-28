import { describe, it, expect } from "vitest";
import { periodProgress } from "./period-progress";

const p = { start: "2026-09-16", end: "2026-09-30" }; // 15 days inclusive

describe("periodProgress", () => {
  it("counts days inclusively and places today on the edge", () => {
    expect(periodProgress(p, "2026-09-16")).toEqual({ day: 1, total: 15, pos: 0 });
    expect(periodProgress(p, "2026-09-30")).toEqual({ day: 15, total: 15, pos: 1 });
    expect(periodProgress(p, "2026-09-23")).toEqual({ day: 8, total: 15, pos: 0.5 });
  });
  it("clamps a today outside the period", () => {
    expect(periodProgress(p, "2026-09-01").day).toBe(1);
    expect(periodProgress(p, "2026-10-05")).toEqual({ day: 15, total: 15, pos: 1 });
  });
  it("survives a one-day period", () => {
    expect(periodProgress({ start: "2026-09-01", end: "2026-09-01" }, "2026-09-01")).toEqual({ day: 1, total: 1, pos: 0 });
  });
});
