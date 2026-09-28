import { describe, it, expect } from "vitest";
import { isInstallmentSection, suggestLineName } from "./line-name";

/** Stands in for next-intl: the shape of the real strings, none of the setup. */
const format = (form: "plain" | "installments" | "installmentsWithCurrency", card: string, currency: string) =>
  form === "plain"
    ? `${card} · ${currency}`
    : form === "installments"
      ? `${card} · Cuotas`
      : `${card} · Cuotas ${currency}`;

const suggest = (sectionKey: string, opts: Partial<Parameters<typeof suggestLineName>[0]> = {}) =>
  suggestLineName({
    cardName: "Amex Platinum",
    currency: "DOP",
    sectionKey,
    takenNames: [],
    maxLength: 80,
    format,
    ...opts,
  });

describe("isInstallmentSection", () => {
  it("recognises the key the extractor writes today", () => {
    expect(isInstallmentSection("DOP_CUOTAS")).toBe(true);
  });

  it("recognises the reversed key older mappings were stored under", () => {
    expect(isInstallmentSection("CUOTAS_DOP")).toBe(true);
  });

  it("leaves a plain currency section alone", () => {
    expect(isInstallmentSection("DOP")).toBe(false);
    expect(isInstallmentSection("USD")).toBe(false);
  });

  it("does not match a currency that merely contains the word", () => {
    // Guards the token boundary: a parser key like "CUOTASX" is not cuotas.
    expect(isInstallmentSection("CUOTASX")).toBe(false);
  });
});

describe("suggestLineName", () => {
  it("names an ordinary section by its currency", () => {
    expect(suggest("USD", { currency: "USD" })).toBe("Amex Platinum · USD");
  });

  it("names an installments section for what it is, not for its currency", () => {
    // The whole point: a DOP cuotas section beside a DOP line must not read as
    // a second DOP card.
    expect(suggest("DOP_CUOTAS")).toBe("Amex Platinum · Cuotas");
  });

  it("adds the currency only when a cuotas line of that name already exists", () => {
    expect(suggest("USD_CUOTAS", { currency: "USD", takenNames: ["Amex Platinum · Cuotas"] })).toBe(
      "Amex Platinum · Cuotas USD",
    );
  });

  it("trims the card, not the tail, to fit the name cap", () => {
    const name = suggest("DOP", { cardName: "A".repeat(40), maxLength: 20 });
    expect(name.length).toBeLessThanOrEqual(20);
    // The currency is what makes the line identifiable, so it survives.
    expect(name.endsWith("· DOP")).toBe(true);
  });

  it("trims an installments name the same way", () => {
    const name = suggest("DOP_CUOTAS", { cardName: "A".repeat(40), maxLength: 20 });
    expect(name.length).toBeLessThanOrEqual(20);
    expect(name.endsWith("· Cuotas")).toBe(true);
  });

  it("never trims the card away entirely", () => {
    expect(suggest("DOP", { cardName: "Amex", maxLength: 4 }).length).toBeGreaterThan(0);
  });
});
