import { describe, it, expect } from "vitest";
import { unconvertedCurrencies } from "./fx";

describe("unconvertedCurrencies", () => {
  const rates = { DOP: 60, EUR: 0.9, USD: 1 };

  it("is empty when every currency has a rate", () => {
    expect(unconvertedCurrencies(["USD", "DOP", "EUR"], "USD", rates)).toEqual([]);
  });

  it("never reports the base currency, which needs no rate", () => {
    expect(unconvertedCurrencies(["DOP", "DOP"], "DOP", {})).toEqual([]);
  });

  it("reports every currency the rate table is missing, deduped and sorted", () => {
    expect(unconvertedCurrencies(["EUR", "DOP", "EUR", "USD"], "USD", {})).toEqual(["DOP", "EUR"]);
  });

  it("ignores null and empty currencies rather than reporting a blank code", () => {
    expect(unconvertedCurrencies([null, undefined, ""], "USD", {})).toEqual([]);
  });

  it("treats a zero rate as missing — dividing by it would not convert anything", () => {
    expect(unconvertedCurrencies(["DOP"], "USD", { DOP: 0 })).toEqual(["DOP"]);
  });
});
