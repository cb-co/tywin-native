import { describe, expect, test } from "vitest";
import { cardLineName, cardLineSpecs } from "./card-lines";

const specs = (multiCurrency: boolean, installments: boolean, currency = "EUR") =>
  cardLineSpecs({ multiCurrency, installments, currency });

describe("cardLineSpecs", () => {
  test("no toggles means no group at all", () => {
    expect(specs(false, false)).toEqual([]);
  });

  test("installments alone keeps the chosen currency and adds a DOP line", () => {
    expect(specs(false, true).map((s) => [s.key, s.currency])).toEqual([
      ["primary", "EUR"],
      ["installments", "DOP"],
    ]);
  });

  test("multi-currency is the fixed DOP + USD pair, ignoring the currency select", () => {
    expect(specs(true, false).map((s) => [s.key, s.currency])).toEqual([
      ["primary", "DOP"],
      ["usd", "USD"],
    ]);
  });

  test("both toggles give three lines, two of them DOP", () => {
    expect(specs(true, true).map((s) => [s.key, s.currency])).toEqual([
      ["primary", "DOP"],
      ["usd", "USD"],
      ["installments", "DOP"],
    ]);
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

describe("cardLineName", () => {
  test("names currency lines by their currency", () => {
    const [dop, usd] = specs(true, false);
    expect(cardLineName("Visa Signature", dop, "Cuotas")).toBe("Visa Signature · DOP");
    expect(cardLineName("Visa Signature", usd, "Cuotas")).toBe("Visa Signature · USD");
  });

  /* The reason currency alone can't name a line: a card with installments has two
     DOP lines, and the group tile headlines the name. */
  test("names the installments line by its label, not DOP", () => {
    const [revolving, cuotas] = specs(false, true, "DOP");
    expect(cardLineName("Visa Signature", revolving, "Cuotas")).toBe("Visa Signature · DOP");
    expect(cardLineName("Visa Signature", cuotas, "Cuotas")).toBe("Visa Signature · Cuotas");
  });
});
