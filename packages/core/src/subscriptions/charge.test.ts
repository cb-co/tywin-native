import { describe, expect, test } from "vitest";
import {
  CARD_FX_SPREAD,
  chargeCrossesCurrency,
  estimateSettledAmount,
  settledCharge,
} from "./charge";

/* The bug these guard: addCharge wrote the subscription's own amount and
 * currency into the charge account, so Netflix at USD 15.99 on a DOP card took
 * 15.99 pesos off it instead of roughly 960. `account_balances` subtracts
 * `total_amount` raw, so the denomination has to be the account's. */

const rates = { USD: 1, DOP: 59.3 }; // units per 1 USD, i.e. base = USD

describe("chargeCrossesCurrency", () => {
  test("a dollar sub on a peso card crosses", () => {
    expect(chargeCrossesCurrency("USD", "DOP")).toBe(true);
  });

  test("the gym billed in pesos on a peso card does not", () => {
    expect(chargeCrossesCurrency("DOP", "DOP")).toBe(false);
  });

  test("a subscription with no account does not", () => {
    expect(chargeCrossesCurrency("USD", null)).toBe(false);
  });
});

describe("estimateSettledAmount", () => {
  test("converts the billed amount and leans above market", () => {
    const market = 15.99 * 59.3;
    const estimate = estimateSettledAmount({
      subAmount: 15.99,
      subCurrency: "USD",
      accountCurrency: "DOP",
      rates,
    })!;
    expect(estimate).toBeGreaterThan(market);
    expect(estimate).toBeCloseTo(market * (1 + CARD_FX_SPREAD), 1);
  });

  /* The issuer takes its cut whichever way round the pair is, so the estimate
   * raises the account-currency figure in both directions — never reduces it. */
  test("leans high on a peso sub charged to a dollar account too", () => {
    const market = 1500 / 59.3;
    const estimate = estimateSettledAmount({
      subAmount: 1500,
      subCurrency: "DOP",
      accountCurrency: "USD",
      rates,
    })!;
    expect(estimate).toBeGreaterThan(market);
  });

  test("rounds to the 2dp the money field steps in", () => {
    const estimate = estimateSettledAmount({
      subAmount: 15.99,
      subCurrency: "USD",
      accountCurrency: "DOP",
      rates,
    })!;
    expect(estimate).toBe(Math.round(estimate * 100) / 100);
  });

  /* A hint invented from a missing rate is worse than none — the field starts
   * empty and the person types what the bank actually charged. */
  test("returns null when the pair's rate is unknown", () => {
    expect(
      estimateSettledAmount({
        subAmount: 15.99,
        subCurrency: "USD",
        accountCurrency: "EUR",
        rates,
      }),
    ).toBeNull();
  });
});

describe("settledCharge", () => {
  test("same currency uses the billed amount", () => {
    expect(
      settledCharge({ subAmount: 1500, subCurrency: "DOP", accountCurrency: "DOP" }),
    ).toEqual({ amount: 1500 });
  });

  /* Nothing to convert, so a settled figure could only be a bug — ignored
   * rather than written. */
  test("same currency ignores a settled amount that disagrees", () => {
    expect(
      settledCharge({
        subAmount: 1500,
        subCurrency: "DOP",
        accountCurrency: "DOP",
        settledAmount: 9999,
      }),
    ).toEqual({ amount: 1500 });
  });

  test("crossing currencies uses the settled figure", () => {
    expect(
      settledCharge({
        subAmount: 15.99,
        subCurrency: "USD",
        accountCurrency: "DOP",
        settledAmount: 965.4,
      }),
    ).toEqual({ amount: 965.4 });
  });

  /* The whole point: it must never fall back to the billed amount, which is the
   * number that corrupted the balance. */
  test.each([undefined, null, 0, -5])(
    "crossing currencies refuses to guess when the settled figure is %s",
    (settledAmount) => {
      expect(
        settledCharge({
          subAmount: 15.99,
          subCurrency: "USD",
          accountCurrency: "DOP",
          settledAmount,
        }),
      ).toEqual({ needsSettledAmount: true });
    },
  );
});
