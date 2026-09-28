import { describe, it, expect } from "vitest";
import { fitFigureClass } from "./fit";

const PX: Record<string, number> = { xl: 20, "2xl": 24, "3xl": 30, "4xl": 36, "5xl": 48, "6xl": 60 };
const sizes = (n: number) => {
  const m = fitFigureClass("x".repeat(n)).match(/^text-(\S+) sm:text-(\S+)$/)!;
  return { base: PX[m[1]], sm: PX[m[2]] };
};
const lengths = Array.from({ length: 25 }, (_, i) => i + 1);

describe("fitFigureClass", () => {
  it("never grows as the figure gets longer", () => {
    for (const n of lengths.slice(1)) {
      expect(sizes(n).base).toBeLessThanOrEqual(sizes(n - 1).base);
      expect(sizes(n).sm).toBeLessThanOrEqual(sizes(n - 1).sm);
    }
  });
  it("uses at least four distinct classes across lengths 8..20", () => {
    const set = new Set(Array.from({ length: 13 }, (_, i) => fitFigureClass("x".repeat(i + 8))));
    expect(set.size).toBeGreaterThanOrEqual(4);
  });
  it("changes class exactly at the boundary lengths", () => {
    const b = (n: number) => fitFigureClass("x".repeat(n));
    for (const [last, next] of [[8, 9], [9, 10], [11, 12], [12, 13], [13, 14], [16, 17], [19, 20]]) {
      expect(b(last)).not.toBe(b(next));
    }
    expect(b(1)).toBe(b(8));
    expect(b(10)).toBe(b(11));
    expect(b(14)).toBe(b(16));
    expect(b(17)).toBe(b(19));
    expect(b(20)).toBe(b(30));
    expect(fitFigureClass("RD$ 1,234,567.89")).toBe("text-2xl sm:text-4xl");
    expect(fitFigureClass("RD$ 12,345,678.90")).toBe("text-xl sm:text-3xl");
  });
  it("fits the 360px note and the narrowest sm+ note up to 20 characters", () => {
    for (const n of lengths.filter((n) => n <= 20)) {
      expect(sizes(n).base * 0.66 * n).toBeLessThanOrEqual(265);
      expect(sizes(n).sm * 0.66 * n).toBeLessThanOrEqual(392);
    }
  });
  it("never goes below text-xl", () => {
    for (const n of lengths) expect(sizes(n).base).toBeGreaterThanOrEqual(20);
  });
  it("gives the same class to figures of the same length", () => {
    expect(fitFigureClass("RD$ 1,000.00")).toBe(fitFigureClass("RD$ 9,999.99"));
  });
});
