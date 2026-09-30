import { describe, expect, it } from "vitest";
import { MEDALLION, medallionPlatePath, medallionSvg } from "./medallion";

const COLOURS = { plate: "#111", disc: "#4a1f8c", ink: "#fff" };

describe("medallionPlatePath", () => {
  it("draws the plate's outer layer inside its circle in the 64 box", () => {
    const d = medallionPlatePath("chrome");
    expect(d.match(/M/g)).toHaveLength(MEDALLION.plateLayers);
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const r = 32 * MEDALLION.plate;
    expect(Math.min(...nums)).toBeGreaterThanOrEqual(32 - r);
    expect(Math.max(...nums)).toBeLessThanOrEqual(32 + r);
  });

  it("stays light enough to inline at chrome size and full at print size", () => {
    expect(medallionPlatePath("chrome").length).toBeLessThan(15_000);
    expect(medallionPlatePath("print").length).toBeGreaterThan(medallionPlatePath("chrome").length * 8);
  });
});

describe("medallionSvg", () => {
  it("is one standalone SVG with the ring, disc and bird", () => {
    const svg = medallionSvg({ ...COLOURS, attrs: 'xmlns="http://www.w3.org/2000/svg"' });
    expect(svg).toMatch(/^<svg viewBox="0 0 64 64"[^>]*xmlns=/);
    expect(svg).toContain('class="plate"');
    expect(svg).toContain('fill="#4a1f8c"');
    expect(svg.match(/<path/g)!.length).toBe(3);
  });

  it("draws print lines finer than chrome lines", () => {
    const width = (svg: string) => Number(svg.match(/class="plate"[^>]*stroke-width="([\d.]+)"/)![1]);
    expect(width(medallionSvg({ ...COLOURS, size: "print" }))).toBeLessThan(width(medallionSvg(COLOURS)));
  });

  it("puts optional CSS first", () => {
    expect(medallionSvg({ ...COLOURS, style: ".plate{stroke:red}" })).toContain("<style>.plate{stroke:red}</style>");
  });
});
