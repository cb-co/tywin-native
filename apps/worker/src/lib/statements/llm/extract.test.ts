import { describe, expect, it } from "vitest";
import { APICallError, RetryError } from "ai";
import { isRateLimitError, toParsedStatement } from "./extract";
import { StatementSchema } from "./schema";
import { validateChecksums } from "../validate";
import type { LlmStatement } from "./schema";

const WITH_LINES: LlmStatement = {
  cardNetwork: "visa",
  cardLast4: "1234",
  sections: [
    {
      sectionKind: "revolving",
      periodStart: null,
      currency: "DOP",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalance: 1000.00,
      closingBalance: 1375.50,
      balanceToPay: 1375.50,
      minimumPayment: 137.55,
      overdueAmount: 0.00,
      overdueInstallments: 0,
      creditLimit: 10000.00,
      availableCredit: 8574.50,
      interestRateAnnual: 40,
      avgDailyBalance: 1200.00,
      avgDailyBalancePrior: 0.00,
      costOfCarry: 40.00,
      costOfCarryPrior: 0.00,
      totalDebits: null,
      totalCredits: null,
      totalCashback: 328.00,
      lines: [
        {
          madeOn: "2026-05-28", postedOn: "2026-05-26", reference: "REF1",
          description: "MERCADO UNO", mcc: "5411", authCode: "045602",
          amount: 500.00, kind: "purchase", suggestedCategory: "Groceries",
        },
        {
          madeOn: "2026-06-05", postedOn: "2026-06-03", reference: "REF2",
          description: "Pago via SPE", mcc: null, authCode: null,
          amount: -200.00, kind: "payment", suggestedCategory: null,
        },
        {
          madeOn: "2026-06-10", postedOn: "2026-06-09", reference: "REF3",
          description: "RESTAURANTE TRES", mcc: "5812", authCode: "013148",
          amount: 75.50, kind: "purchase", suggestedCategory: "Dining",
        },
      ],
    },
  ],
};

const LINE_LESS: LlmStatement = {
  cardNetwork: "amex",
  cardLast4: "6760",
  sections: [
    {
      sectionKind: "installments",
      periodStart: null,
      currency: "DOP",
      periodEnd: "2026-07-15",
      dueDate: "2026-08-10",
      previousBalance: 0.00,
      closingBalance: 800.00,
      balanceToPay: 800.00,
      minimumPayment: 80.00,
      overdueAmount: null,
      overdueInstallments: null,
      creditLimit: 20000.00,
      availableCredit: null,
      interestRateAnnual: null,
      avgDailyBalance: 650.00,
      avgDailyBalancePrior: 0.00,
      costOfCarry: null,
      costOfCarryPrior: null,
      totalDebits: 1300.00,
      totalCredits: 500.00,
      totalCashback: null,
      lines: [],
    },
  ],
};

/* A real Banco Santa Cruz shape: the bank prints CREDITO POR PAGO TOTAL among
   the credits, but its closing balance is computed without it. 1000.00 + 500.00
   = 1500.00 closing, with the -1140.08 adjustment sitting alongside. */
const WITH_ADJUSTMENT: LlmStatement = {
  cardNetwork: "visa",
  cardLast4: "3627",
  sections: [
    {
      sectionKind: "revolving",
      periodStart: null,
      currency: "DOP",
      periodEnd: "2026-08-03",
      dueDate: "2026-08-28",
      previousBalance: 1000.00,
      closingBalance: 1500.00,
      balanceToPay: 1500.00,
      minimumPayment: null,
      overdueAmount: null,
      overdueInstallments: null,
      creditLimit: null,
      availableCredit: null,
      interestRateAnnual: null,
      avgDailyBalance: null,
      avgDailyBalancePrior: null,
      costOfCarry: null,
      costOfCarryPrior: null,
      totalDebits: null,
      totalCredits: null,
      totalCashback: null,
      lines: [
        {
          madeOn: "2026-07-10", postedOn: "2026-07-11", reference: null,
          description: "TOTALENERGIES CARR MELLA", mcc: null, authCode: null,
          amount: 500.00, kind: "purchase", suggestedCategory: "Transport",
        },
        {
          madeOn: "2026-07-04", postedOn: "2026-07-04", reference: null,
          description: "CREDITO POR PAGO TOTAL", mcc: null, authCode: null,
          amount: -1140.08, kind: "adjustment", suggestedCategory: null,
        },
      ],
    },
  ],
};

describe("toParsedStatement", () => {
  it("derives a stable parserId from network + last4 + currencies", () => {
    expect(toParsedStatement(WITH_LINES).parserId).toBe("visa_1234_dop");
  });

  it("computes totals from lines when lines is non-empty, ignoring the LLM's totals", () => {
    const parsed = toParsedStatement(WITH_LINES);
    const s = parsed.sections[0];
    expect(s.totalDebitsCents).toBe(57550); // 500.00 + 75.50
    expect(s.totalCreditsCents).toBe(20000); // |-200.00|
  });

  it("assigns lineNo by index and passes suggestedCategory through", () => {
    const lines = toParsedStatement(WITH_LINES).sections[0].lines;
    expect(lines.map((l) => l.lineNo)).toEqual([1, 2, 3]);
    expect(lines[0].suggestedCategory).toBe("Groceries");
    expect(lines[1].suggestedCategory).toBeNull();
  });

  it("computes periodStart from periodEnd", () => {
    expect(toParsedStatement(WITH_LINES).sections[0].periodStart).toBe("2026-05-26");
  });

  it("passes checksums for a statement with lines", () => {
    expect(validateChecksums(toParsedStatement(WITH_LINES))).toEqual([]);
  });

  it("falls back to the LLM's totalDebits/totalCredits for a line-less section", () => {
    const s = toParsedStatement(LINE_LESS).sections[0];
    expect(s.totalDebitsCents).toBe(130000);
    expect(s.totalCreditsCents).toBe(50000);
    expect(s.lines).toEqual([]);
  });

  it("passes checksums for a line-less section", () => {
    expect(validateChecksums(toParsedStatement(LINE_LESS))).toEqual([]);
  });

  /* An adjustment moves no money, so it must not enter the movement figures
     either — the stored totals and the checksum have to agree on what "moved
     the balance" means, or the line-less fallback (total_debits - total_credits)
     would answer a different question than the with-lines path. */
  it("leaves adjustment lines out of the debit and credit totals", () => {
    const s = toParsedStatement(WITH_ADJUSTMENT).sections[0];
    expect(s.totalDebitsCents).toBe(50000);
    expect(s.totalCreditsCents).toBe(0);
  });

  it("keeps the adjustment line itself, so the imported ledger matches the PDF", () => {
    const lines = toParsedStatement(WITH_ADJUSTMENT).sections[0].lines;
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ kind: "adjustment", amountCents: -114008 });
  });

  it("passes checksums for a statement carrying an adjustment", () => {
    expect(validateChecksums(toParsedStatement(WITH_ADJUSTMENT))).toEqual([]);
  });

  /* `ParsedSection.currency` is declared ISO 4217 and consumed as one — the preview
     hands it to Intl.NumberFormat, confirm compares it against the account's currency,
     and fx looks up a rate by it. A statement that prints only "RD$" and never "DOP"
     used to get the symbol transcribed into it verbatim, and Intl threw RangeError on
     render; the schema types the field as an enum of ISO codes now, so the decoder
     cannot emit a symbol and there is no normalization step left to get wrong. */
  describe("currency and sectionKey", () => {
    const withSection = (patch: Partial<LlmStatement["sections"][number]>): LlmStatement => ({
      ...WITH_LINES,
      sections: [{ ...WITH_LINES.sections[0], ...patch }],
    });

    it("carries the enum value straight through", () => {
      expect(toParsedStatement(withSection({ currency: "USD" })).sections[0].currency).toBe("USD");
    });

    it("builds the parserId from the section currencies", () => {
      expect(toParsedStatement(withSection({ currency: "USD" })).parserId).toBe("visa_1234_usd");
    });

    /* These are the exact keys already persisted in statement_section_mappings for
       existing cards. Deriving them from two enum fields keeps every saved mapping
       matching, and makes a key the model could vary structurally impossible. */
    it("derives the section key from currency and kind", () => {
      expect(toParsedStatement(withSection({ sectionKind: "revolving" })).sections[0].sectionKey)
        .toBe("DOP");
      expect(toParsedStatement(withSection({ sectionKind: "installments" })).sections[0].sectionKey)
        .toBe("DOP_CUOTAS");
      expect(
        toParsedStatement(withSection({ currency: "USD", sectionKind: "revolving" })).sections[0]
          .sectionKey,
      ).toBe("USD");
    });
  });

  /* The failure that motivated the numeric schema: a Qik statement prints "RD$" on
     every transaction row, the model transcribed it into each amount, and three
     imports of the same file died on `unparseable amount: "RD$ 255.38"` — while a
     fourth run of the identical text stripped it unprompted. Typing the field as a
     number moves the guarantee from prompt compliance to the decoder. */
  describe("amounts", () => {
    it("rejects a decorated amount at the schema, before any conversion runs", () => {
      const base = WITH_LINES.sections[0];
      const decorated = {
        ...WITH_LINES,
        sections: [{ ...base, lines: [{ ...base.lines[0], amount: "RD$ 255.38" }] }],
      };
      expect(StatementSchema.safeParse(decorated).success).toBe(false);
      expect(StatementSchema.safeParse(WITH_LINES).success).toBe(true);
    });

    /* float64 cannot hold 1375.50 or 0.07 exactly; the conversion rounds rather than
       truncates so every cent lands on the integer the statement printed. */
    it("converts decimals to exact cents", () => {
      const base = WITH_LINES.sections[0];
      const amounts = [0.07, 1.1, 1375.5, 8574.5, 1e6 + 0.29, -200.2];
      const s = toParsedStatement({
        ...WITH_LINES,
        sections: [
          {
            ...base,
            lines: amounts.map((amount, i) => ({ ...base.lines[0], amount, reference: `R${i}` })),
          },
        ],
      }).sections[0];
      expect(s.lines.map((l) => l.amountCents)).toEqual([7, 110, 137550, 857450, 100000029, -20020]);
    });

    it("keeps a display-only figure the statement omitted as null", () => {
      const s = toParsedStatement({
        ...WITH_LINES,
        sections: [
          {
            ...WITH_LINES.sections[0],
            creditLimit: null,
            avgDailyBalance: null,
            costOfCarry: null,
            balanceToPay: null,
          },
        ],
      }).sections[0];
      expect(s.creditLimitCents).toBeNull();
      expect(s.avgDailyBalanceCents).toBeNull();
      expect(s.costOfCarryCents).toBeNull();
      // Absent balanceToPay means "the same as the closing balance", not "unknown".
      expect(s.balanceToPayCents).toBe(137550);
    });
  });

  /* JSON has no date type and the schema's pattern keyword is advisory, so dates are
     the one field still arriving as free text — the only place a repair step remains. */
  describe("dates", () => {
    const base = WITH_LINES.sections[0];
    const withSection = (patch: Partial<typeof base>): LlmStatement => ({
      ...WITH_LINES,
      sections: [{ ...base, ...patch }],
    });

    it("derives periodStart from periodEnd when the statement printed only a cutoff", () => {
      expect(toParsedStatement(withSection({ periodStart: null })).sections[0].periodStart)
        .toBe("2026-05-26");
    });

    it("prefers the printed period range over the derived one", () => {
      expect(toParsedStatement(withSection({ periodStart: "2026-05-28" })).sections[0].periodStart)
        .toBe("2026-05-28");
    });

    it("repairs the one non-ISO form these statements print", () => {
      const s = toParsedStatement(
        withSection({ lines: [{ ...base.lines[0], madeOn: "28/05/2026", postedOn: "26/05/2026" }] }),
      ).sections[0];
      expect(s.lines[0].madeOn).toBe("2026-05-28");
      expect(s.lines[0].postedOn).toBe("2026-05-26");
    });

    it("fails loudly on a ledger-bound date it cannot read", () => {
      expect(() =>
        toParsedStatement(withSection({ lines: [{ ...base.lines[0], madeOn: "May 28" }] })),
      ).toThrow(/unparseable date/);
      expect(() => toParsedStatement(withSection({ periodEnd: "N/A" }))).toThrow(/unparseable date/);
    });

    it("drops a display-only date it cannot read instead of failing the import", () => {
      const s = toParsedStatement(withSection({ dueDate: "whenever", periodStart: "nonsense" }))
        .sections[0];
      expect(s.dueDate).toBeNull();
      expect(s.periodStart).toBe("2026-05-26"); // falls back to the derived value
      expect(s.lines).toHaveLength(3);
    });
  });

  describe("cashback", () => {
    const withCashback = (totalCashback: number | null): LlmStatement => ({
      ...LINE_LESS,
      sections: [{ ...LINE_LESS.sections[0], totalCashback }],
    });
    const cents = (raw: number | null) =>
      toParsedStatement(withCashback(raw)).sections[0].cashbackCents;

    it("carries the reported figure through as cents", () => {
      expect(cents(328)).toBe(32800);
      expect(cents(1240.5)).toBe(124050);
    });

    it("reports an unreported figure as null rather than zero", () => {
      // Distinguishes "the statement said nothing" from "the statement said
      // zero" — only the latter proves cashback was actually read.
      expect(cents(null)).toBeNull();
      expect(cents(0)).toBe(0);
    });

    it("takes the magnitude when the model transcribes the source's minus sign", () => {
      // The lines it is read off ARE negative; -328.00 is still 328.00 earned.
      expect(cents(-328)).toBe(32800);
    });

    it("leaves the rest of the section intact when the statement reports none", () => {
      const parsed = toParsedStatement(withCashback(null));
      expect(parsed.sections[0].totalDebitsCents).toBe(130000);
      expect(parsed.sections[0].closingBalanceCents).toBe(80000);
      expect(validateChecksums(parsed)).toEqual([]);
    });
  });
});

describe("isRateLimitError", () => {
  const apiError = (statusCode: number) =>
    new APICallError({ message: "failed", url: "https://example.com", requestBodyValues: {}, statusCode });

  it("recognizes a 429 APICallError", () => {
    expect(isRateLimitError(apiError(429))).toBe(true);
  });

  it("recognizes a 429 buried in a RetryError once the SDK's own retries are exhausted", () => {
    const retry = new RetryError({ message: "max retries exceeded", reason: "maxRetriesExceeded", errors: [apiError(429)] });
    expect(isRateLimitError(retry)).toBe(true);
  });

  it("rejects a non-429 APICallError", () => {
    expect(isRateLimitError(apiError(500))).toBe(false);
  });

  it("rejects a plain, non-AI-SDK error", () => {
    expect(isRateLimitError(new Error("boom"))).toBe(false);
  });
});
