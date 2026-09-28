import { describe, it, expect } from "vitest";
import { splitMoney } from "./money-parts";

describe("splitMoney", () => {
  it("splits a USD amount into head, separator and cents", () => {
    expect(splitMoney(8822.89, "USD")).toEqual({ head: "$8,822", sep: ".", cents: "89" });
  });

  // DOP formats in es-DO so it renders the unambiguous RD$ (see lib/format.ts).
  it("keeps the RD$ symbol with the head for DOP", () => {
    expect(splitMoney(8822.89, "DOP")).toEqual({ head: "RD$8,822", sep: ".", cents: "89" });
  });

  it("returns empty cents for a zero-decimal currency", () => {
    const parts = splitMoney(8823, "JPY");
    expect(parts.sep).toBe("");
    expect(parts.cents).toBe("");
    expect(parts.head).toContain("8,823");
  });

  it("pads cents to two digits", () => {
    expect(splitMoney(10.5, "USD")).toEqual({ head: "$10", sep: ".", cents: "50" });
  });

  it("keeps the minus sign with the head", () => {
    expect(splitMoney(-54.99, "USD")).toEqual({ head: "-$54", sep: ".", cents: "99" });
  });

  it("prefixes a plus when signed and positive", () => {
    expect(splitMoney(120, "USD", { signed: true })).toEqual({
      head: "+$120", sep: ".", cents: "00",
    });
  });

  it("does not prefix a plus when signed and negative", () => {
    expect(splitMoney(-120, "USD", { signed: true }).head).toBe("-$120");
  });

  // Compact notation puts a decimal inside the mantissa ("$8.82K"). Splitting
  // there would render "8" huge and "82K" small, which is nonsense.
  it("never splits compact notation", () => {
    const parts = splitMoney(8822.89, "USD", { compact: true });
    expect(parts.sep).toBe("");
    expect(parts.cents).toBe("");
    expect(parts.head).toBe("$8.82K");
  });

  it("agrees with formatMoney when rejoined", async () => {
    const { formatMoney } = await import("./format");
    for (const amount of [0, 1, -1, 10.5, 8822.89, -54.99, 1000000]) {
      const p = splitMoney(amount, "USD");
      expect(p.head + p.sep + p.cents).toBe(formatMoney(amount, "USD"));
    }
  });
});
