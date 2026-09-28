import { describe, it, expect } from "vitest";
import { inferNetwork, inferLast4 } from "./network";

describe("inferNetwork", () => {
  it("prefers the stored brand over the name", () => {
    expect(inferNetwork("Some Bank Gold", "mastercard")).toBe("mastercard");
  });

  it("normalises a stored brand's case and spacing", () => {
    expect(inferNetwork(null, "  VISA ")).toBe("visa");
    expect(inferNetwork(null, "American Express")).toBe("amex");
  });

  it.each([
    ["Visa Platinum", "visa"],
    ["Mastercard Black", "mastercard"],
    ["Master Card Gold", "mastercard"],
    ["MC Classic", "mastercard"],
    ["Amex Gold", "amex"],
    ["American Express Platinum", "amex"],
  ])("infers %s as %s", (name, expected) => {
    expect(inferNetwork(name)).toBe(expected);
  });

  // Dropped from CARD_NETWORKS: not issued in the DR, so they were four marks
  // nobody would see. They must fall through to "no mark" like any other
  // unrecognised name, NOT throw or half-match.
  it.each(["Discover it", "Diners Club", "JCB Standard", "UnionPay Debit"])(
    "returns null for the unsupported network in %o",
    (name) => {
      expect(inferNetwork(name)).toBeNull();
    },
  );

  it("is case insensitive", () => {
    expect(inferNetwork("visa platinum")).toBe("visa");
  });

  // A wrong mark is worse than no mark.
  it("returns null when nothing matches", () => {
    expect(inferNetwork("Popular Platinum")).toBeNull();
    expect(inferNetwork("Savings")).toBeNull();
    expect(inferNetwork(null)).toBeNull();
    expect(inferNetwork("")).toBeNull();
  });

  // "mc" must not match inside a word.
  it("does not match mc inside another word", () => {
    expect(inferNetwork("McDonald's Rewards")).toBeNull();
    expect(inferNetwork("McKinsey Card")).toBeNull();
  });
});

describe("inferLast4", () => {
  it("prefers the stored last4", () => {
    expect(inferLast4("Visa 9999", "1234")).toBe("1234");
  });

  it("ignores a stored value that is not four digits", () => {
    expect(inferLast4("Visa 4821", "12")).toBe("4821");
  });

  it("infers a trailing four-digit group from the name", () => {
    expect(inferLast4("Visa Platinum 4821")).toBe("4821");
    expect(inferLast4("4821 Visa")).toBe("4821");
  });

  // "Amex 2024" is a vintage, not a card number.
  it("skips values that look like a year", () => {
    expect(inferLast4("Amex 2024")).toBeNull();
    expect(inferLast4("Card 1999")).toBeNull();
    expect(inferLast4("Card 2099")).toBeNull();
  });

  it("accepts four digits outside the year range", () => {
    expect(inferLast4("Card 1899")).toBe("1899");
    expect(inferLast4("Card 0042")).toBe("0042");
  });

  it("does not match inside a longer digit run", () => {
    expect(inferLast4("Account 123456")).toBeNull();
  });

  it("returns null when there is nothing to infer", () => {
    expect(inferLast4("Visa Gold")).toBeNull();
    expect(inferLast4(null)).toBeNull();
  });
});
