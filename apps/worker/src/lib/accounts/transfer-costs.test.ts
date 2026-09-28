import { describe, expect, it } from "vitest";
import { sumAccountTransferCosts } from "./transfer-costs";

describe("sumAccountTransferCosts", () => {
  it("sums fees and tax separately, in the account's own currency", () => {
    expect(
      sumAccountTransferCosts([
        { fee_amount: 50, tax_amount: 15 },
        { fee_amount: 0, tax_amount: 3.5 },
      ]),
    ).toEqual({ fees: 50, tax: 18.5 });
  });

  it("treats null amounts as zero", () => {
    expect(sumAccountTransferCosts([{ fee_amount: null, tax_amount: null }])).toEqual({ fees: 0, tax: 0 });
  });

  it("returns zeros for no rows", () => {
    expect(sumAccountTransferCosts([])).toEqual({ fees: 0, tax: 0 });
  });

  it("rounds to cents", () => {
    expect(
      sumAccountTransferCosts([
        { fee_amount: 0.1, tax_amount: 0.0015 },
        { fee_amount: 0.2, tax_amount: 0.0015 },
      ]),
    ).toEqual({ fees: 0.3, tax: 0 });
  });
});
