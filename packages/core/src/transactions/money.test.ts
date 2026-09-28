import { describe, expect, test } from "vitest";
import { destinationAmount, invertRate, resolveBaseRate, round4 } from "./money";

/* A payment between two currencies has two legs, each denominated in its own
 * account's currency. The original model carried a single `amount` and applied
 * it verbatim to both legs, so a 10,000 DOP payment out of a USD account took
 * 10,000 USD off the source. These helpers produce the destination leg. */

describe("round4", () => {
  test("matches the numeric(18,4) the DB stores", () => {
    expect(round4(1742.00005)).toBe(1742.0001);
    expect(round4(0.123456)).toBe(0.1235);
    expect(round4(10000)).toBe(10000);
  });
});

describe("invertRate", () => {
  /* The form shows "1 USD = 5.741 DOP" (whole-ish numbers, dollar first) while
   * the DB stores base-per-unit — the reciprocal. */
  test("round-trips a rate through display and back", () => {
    const stored = 0.1742;
    const shown = invertRate(stored);
    expect(shown).toBeCloseTo(5.7405, 3);
    expect(invertRate(shown)).toBeCloseTo(stored, 8);
  });

  test("leaves parity alone", () => {
    expect(invertRate(1)).toBe(1);
  });

  test("refuses a non-positive rate rather than returning Infinity", () => {
    expect(() => invertRate(0)).toThrow();
    expect(() => invertRate(-2)).toThrow();
  });
});

describe("destinationAmount", () => {
  /* The reported bug, as a test: 1742 USD out of Main, at 5.741 DOP per USD,
   * must land 10,000 DOP in Santa Cruz — not 1742. */
  test("converts the source amount into destination currency", () => {
    expect(destinationAmount(1742, 5.741)).toBe(10000.822);
  });

  test("is identity at rate 1 (same-currency payment)", () => {
    expect(destinationAmount(10000, 1)).toBe(10000);
  });

  test("rounds to 4dp", () => {
    expect(destinationAmount(100, 1.23456789)).toBe(123.4568);
  });

  test("refuses a non-positive rate", () => {
    expect(() => destinationAmount(100, 0)).toThrow();
  });
});

describe("resolveBaseRate", () => {
  /* Base USD; the market says 1 USD = 60 DOP, so a DOP row is worth 1/60 USD
   * per unit. The user is never shown any of this. */
  const rates = { USD: 1, DOP: 60, EUR: 0.9 };

  test("is 1 when the transaction is already in the base currency", () => {
    expect(
      resolveBaseRate({ currency: "USD", baseCurrency: "USD", amount: 100, rates }),
    ).toBe(1);
  });

  /* The complaint that started this: a DOP expense from a DOP account with a
   * USD base used to demand a rate. Nothing was converted — take the market's. */
  test("uses the market rate for a foreign-currency expense", () => {
    expect(
      resolveBaseRate({ currency: "DOP", baseCurrency: "USD", amount: 3000, rates }),
    ).toBeCloseTo(1 / 60, 10);
  });

  /* A payment DOP -> USD with a USD base: the user told us 3000 DOP became
   * 50 USD, so that is the rate, not the market's 1/60. */
  test("prefers the user's own rate when the payment lands in the base currency", () => {
    expect(
      resolveBaseRate({
        currency: "DOP",
        baseCurrency: "USD",
        amount: 3000,
        toCurrency: "USD",
        toAmount: 50,
        rates,
      }),
    ).toBeCloseTo(50 / 3000, 10);
  });

  /* DOP -> EUR with a USD base: neither leg is the base, so the destination
   * amount says nothing about USD. Market rate for the source currency. */
  test("falls back to the market rate when neither leg is the base currency", () => {
    expect(
      resolveBaseRate({
        currency: "DOP",
        baseCurrency: "USD",
        amount: 3000,
        toCurrency: "EUR",
        toAmount: 45,
        rates,
      }),
    ).toBeCloseTo(1 / 60, 10);
  });

  /* A same-currency payment into a base-currency account carries to_amount ===
   * amount; treating that as the rate would be a no-op anyway, but the guard
   * keeps the intent explicit. */
  test("ignores the destination leg when both legs share a currency", () => {
    expect(
      resolveBaseRate({
        currency: "USD",
        baseCurrency: "USD",
        amount: 100,
        toCurrency: "USD",
        toAmount: 100,
        rates,
      }),
    ).toBe(1);
  });

  /* FX request failed. 1:1 keeps the row saveable (exchange_rate > 0 is a DB
   * constraint) and matches convertToBase's fallback elsewhere. */
  test("falls back to 1 when the rate is unknown", () => {
    expect(
      resolveBaseRate({ currency: "DOP", baseCurrency: "USD", amount: 3000, rates: {} }),
    ).toBe(1);
  });
});
