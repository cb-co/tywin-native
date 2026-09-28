import { describe, expect, it } from "vitest";
import { merchantPattern } from "./merchant";

describe("merchantPattern", () => {
  it("uppercases, collapses whitespace and trims", () => {
    expect(merchantPattern("  Sm  Nacional   Metro Plza  ")).toBe("SM NACIONAL METRO PLZA");
  });

  it("is idempotent", () => {
    const once = merchantPattern("helados bon metro pza santo domingo-do");
    expect(merchantPattern(once)).toBe(once);
  });

  it("keeps the location tail — an over-broad rule mis-files money silently", () => {
    expect(merchantPattern("IN&OUT CHARLES SUMMER SANTO DOMINGO-DO")).toBe(
      "IN&OUT CHARLES SUMMER SANTO DOMINGO-DO",
    );
  });

  it("produces a pattern that matches its own description under includes()", () => {
    const desc = "PRICESMART SAN ISIDRO SANTO DOMINGO-DO";
    expect(desc.toUpperCase().includes(merchantPattern(desc))).toBe(true);
  });
});
