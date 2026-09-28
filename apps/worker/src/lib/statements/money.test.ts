import { describe, expect, it } from "vitest";
import { centsToDecimal } from "./money";

describe("centsToDecimal", () => {
  it("renders with two decimals and sign", () => {
    expect(centsToDecimal(338800)).toBe("3388.00");
    expect(centsToDecimal(-1976546)).toBe("-19765.46");
    expect(centsToDecimal(0)).toBe("0.00");
  });

  it("pads a sub-dollar amount", () => {
    expect(centsToDecimal(7)).toBe("0.07");
    expect(centsToDecimal(-7)).toBe("-0.07");
  });
});
