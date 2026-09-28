import { describe, expect, it } from "vitest";
import { validateChecksums } from "./validate";
import type { LineKind, ParsedSection, ParsedStatement } from "@cigua/core/statements/types";

function section(over: Partial<ParsedSection>): ParsedSection {
  return {
    sectionKey: "DOP",
    currency: "DOP",
    periodStart: "2026-05-26",
    periodEnd: "2026-06-25",
    dueDate: null,
    previousBalanceCents: 100000,
    totalDebitsCents: 0,
    totalCreditsCents: 0,
    closingBalanceCents: 100000,
    balanceToPayCents: 100000,
    minimumPaymentCents: null,
    overdueAmountCents: null,
    overdueInstallments: null,
    creditLimitCents: null,
    availableCreditCents: null,
    interestRateAnnual: null,
    avgDailyBalanceCents: null,
    avgDailyBalancePriorCents: null,
    costOfCarryCents: null,
    costOfCarryPriorCents: null,
    cashbackCents: null,
    lines: [],
    ...over,
  };
}
const stmt = (...sections: ParsedSection[]): ParsedStatement => ({
  parserId: "test",
  cardLast4: "0000",
  sections,
});
const line = (amountCents: number, lineNo: number, kind?: LineKind) => ({
  lineNo,
  madeOn: "2026-06-01",
  postedOn: "2026-06-02",
  reference: null,
  description: "X",
  mcc: null,
  authCode: null,
  amountCents,
  kind: kind ?? (amountCents < 0 ? ("payment" as const) : ("purchase" as const)),
  suggestedCategory: null,
});

describe("validateChecksums", () => {
  it("passes when previous + lines == closing (payments included)", () => {
    const s = section({
      previousBalanceCents: 100000,
      lines: [line(50000, 1), line(-20000, 2)],
      closingBalanceCents: 130000,
    });
    expect(validateChecksums(stmt(s))).toEqual([]);
  });
  it("fails with computed vs stated when the sum is off", () => {
    const s = section({
      previousBalanceCents: 100000,
      lines: [line(50000, 1)],
      closingBalanceCents: 140000,
    });
    expect(validateChecksums(stmt(s))).toEqual([
      { sectionKey: "DOP", computedCents: 150000, statedCents: 140000 },
    ]);
  });
  it("uses stated totals for line-less sections (Cuotas)", () => {
    const ok = section({
      sectionKey: "CUOTAS_DOP",
      previousBalanceCents: 0,
      totalDebitsCents: 0,
      totalCreditsCents: 0,
      closingBalanceCents: 0,
      lines: [],
    });
    const bad = section({
      sectionKey: "CUOTAS_DOP",
      previousBalanceCents: 0,
      totalDebitsCents: 5000,
      totalCreditsCents: 0,
      closingBalanceCents: 0,
      lines: [],
    });
    expect(validateChecksums(stmt(ok))).toEqual([]);
    expect(validateChecksums(stmt(bad))).toEqual([
      { sectionKey: "CUOTAS_DOP", computedCents: 5000, statedCents: 0 },
    ]);
  });

  /* Balance-neutral by construction. Banco Santa Cruz prints CREDITO POR PAGO
     TOTAL — the interest it reverses when you pay in full — in the credit
     column and counts it in the credit total, but its closing balance does not
     reflect it, because the interest being reversed was never inside the
     previous balance either. Summing it like any other credit made a faithful
     extraction fail by exactly that line's amount. */
  it("ignores adjustment lines, which the statement shows but does not apply", () => {
    const s = section({
      previousBalanceCents: 100000,
      lines: [line(50000, 1), line(-20000, 2), line(-114008, 3, "adjustment")],
      closingBalanceCents: 130000,
    });
    expect(validateChecksums(stmt(s))).toEqual([]);
  });

  it("still fails when a real line is off, adjustments notwithstanding", () => {
    const s = section({
      previousBalanceCents: 100000,
      lines: [line(50000, 1), line(-7, 2, "adjustment")],
      closingBalanceCents: 140000,
    });
    expect(validateChecksums(stmt(s))).toEqual([
      { sectionKey: "DOP", computedCents: 150000, statedCents: 140000 },
    ]);
  });

});
