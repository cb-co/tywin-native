import { describe, expect, it } from "vitest";
import { StatementSchema } from "./schema";

const VALID = {
  cardNetwork: "visa",
  cardLast4: "1234",
  sections: [
    {
      sectionKind: "revolving",
      currency: "DOP",
      periodStart: "2026-05-26",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalance: 1000,
      closingBalance: 1425.5,
      balanceToPay: 1425.5,
      minimumPayment: 142.55,
      overdueAmount: 0,
      overdueInstallments: 0,
      creditLimit: 10000,
      availableCredit: 8574.5,
      interestRateAnnual: 40,
      avgDailyBalance: 1200,
      avgDailyBalancePrior: 0,
      costOfCarry: 40,
      costOfCarryPrior: 0,
      totalDebits: null,
      totalCredits: null,
      totalCashback: 328,
      lines: [
        {
          madeOn: "2026-05-28",
          postedOn: "2026-05-26",
          reference: "74763946147620851045422",
          description: "MERCADO UNO CIUDAD FALSA",
          mcc: "5411",
          authCode: "045602",
          amount: 500,
          kind: "purchase",
          suggestedCategory: "Groceries",
        },
      ],
    },
  ],
};

const withSection = (patch: Record<string, unknown>) => ({
  ...VALID,
  sections: [{ ...VALID.sections[0], ...patch }],
});

describe("StatementSchema", () => {
  it("accepts a well-formed statement", () => {
    expect(() => StatementSchema.parse(VALID)).not.toThrow();
  });

  it("rejects an invalid line kind", () => {
    const bad = withSection({ lines: [{ ...VALID.sections[0].lines[0], kind: "refund" }] });
    expect(() => StatementSchema.parse(bad)).toThrow();
  });

  it("rejects a missing required field", () => {
    // Deleted rather than destructured-and-dropped: the point is that the key
    // is absent, and an unused `closingBalance` binding is a lint error.
    const section: Record<string, unknown> = { ...VALID.sections[0] };
    delete section.closingBalance;
    expect(() => StatementSchema.parse({ ...VALID, sections: [section] })).toThrow();
  });

  /* The whole reason amounts are numbers: this is what a model handed back on a
     statement printing "RD$" on every row, and the string schema accepted it
     happily, leaving a downstream parse to fail the entire import. */
  it("rejects a money field carrying anything but a number", () => {
    for (const amount of ["RD$ 255.38", "255.38", "N/A", "", null]) {
      const bad = withSection({ lines: [{ ...VALID.sections[0].lines[0], amount }] });
      expect(StatementSchema.safeParse(bad).success, JSON.stringify(amount)).toBe(false);
    }
    expect(StatementSchema.safeParse(withSection({ closingBalance: "1,425.50" })).success).toBe(
      false,
    );
  });

  it("rejects a non-finite amount", () => {
    expect(StatementSchema.safeParse(withSection({ closingBalance: NaN })).success).toBe(false);
    expect(StatementSchema.safeParse(withSection({ closingBalance: Infinity })).success).toBe(false);
  });

  /* A currency symbol here was a real production bug — Intl.NumberFormat throws
     RangeError on "RD$" and the preview died on render. */
  it("rejects a currency that is not an ISO code it knows", () => {
    for (const currency of ["RD$", "$", "dop", "DOLLARS", ""]) {
      expect(StatementSchema.safeParse(withSection({ currency })).success, currency).toBe(false);
    }
    expect(StatementSchema.safeParse(withSection({ currency: "USD" })).success).toBe(true);
  });

  it("rejects a section kind outside the two it derives keys from", () => {
    expect(StatementSchema.safeParse(withSection({ sectionKind: "cuotas" })).success).toBe(false);
  });

  it("allows a nullable figure the statement does not print", () => {
    const ok = withSection({
      dueDate: null,
      periodStart: null,
      creditLimit: null,
      totalCashback: null,
    });
    expect(StatementSchema.safeParse(ok).success).toBe(true);
  });
});
