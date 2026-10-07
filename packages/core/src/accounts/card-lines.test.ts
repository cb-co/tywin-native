import { describe, expect, test } from "vitest";
import { cardLineCurrency, cardLineName, cardLineSpecs, compareCardLines } from "./card-lines";

const specs = (multiCurrency: boolean, installments: boolean) => cardLineSpecs({ multiCurrency, installments });

describe("cardLineSpecs", () => {
  test("no toggles means no group at all", () => {
    expect(specs(false, false)).toEqual([]);
  });

  test("cuotas alone is DOP + Cuotas: no USD line nobody asked for", () => {
    expect(specs(false, true).map((s) => s.line)).toEqual(["DOP", "CUOTAS"]);
  });

  test("multi-currency alone is DOP + USD: no cuotas line nobody asked for", () => {
    expect(specs(true, false).map((s) => s.line)).toEqual(["DOP", "USD"]);
  });

  test("both toggles give all three lines", () => {
    expect(specs(true, true).map((s) => s.line)).toEqual(["DOP", "USD", "CUOTAS"]);
  });

  test("every line points at its own limit and balance field", () => {
    const fields = specs(true, true).map((s) => [s.limitField, s.balanceField]);
    expect(fields).toEqual([
      ["credit_limit", "current_balance"],
      ["usd_credit_limit", "usd_current_balance"],
      ["installments_credit_limit", "installments_current_balance"],
    ]);
    // No two lines may share a field, or one line's limit silently becomes another's.
    expect(new Set(fields.flat()).size).toBe(6);
  });
});

describe("cardLineCurrency", () => {
  test("cuotas are billed in pesos", () => {
    expect(cardLineCurrency("DOP")).toBe("DOP");
    expect(cardLineCurrency("USD")).toBe("USD");
    expect(cardLineCurrency("CUOTAS")).toBe("DOP");
  });
});

describe("cardLineName", () => {
  test("names the currency lines by their currency and cuotas by its label", () => {
    expect(cardLineName("Visa Signature", "DOP", "Cuotas")).toBe("Visa Signature · DOP");
    expect(cardLineName("Visa Signature", "USD", "Cuotas")).toBe("Visa Signature · USD");
    expect(cardLineName("Visa Signature", "CUOTAS", "Cuotas")).toBe("Visa Signature · Cuotas");
  });
});

describe("compareCardLines", () => {
  test("orders DOP, USD, Cuotas, with untagged rows last", () => {
    expect(["CUOTAS", null, "USD", "DOP"].sort(compareCardLines)).toEqual(["DOP", "USD", "CUOTAS", null]);
  });
});
