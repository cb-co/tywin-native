import { describe, expect, it } from "vitest";
import {
  classifyFee,
  reversalTarget,
  summarizeCardFees,
  type FeeLineRow,
} from "./card-fees";

const fee = (description: string, amount: number, posted_on = "2026-06-15"): FeeLineRow =>
  ({ description, amount, kind: "fee", posted_on });

const credit = (description: string, amount: number, posted_on = "2026-07-03"): FeeLineRow =>
  ({ description, amount, kind: "credit", posted_on });

describe("classifyFee", () => {
  it("files interest as interest, whatever the wording", () => {
    expect(classifyFee("INTERES FINANCIAMIENTO")).toBe("interest");
    expect(classifyFee("Interés")).toBe("interest");
    expect(classifyFee("INTEREST CHARGE")).toBe("interest");
    // The two AMEX Platinum lines of 2026-08-17, which the extraction tagged 'fee'.
    expect(classifyFee("INTERESES POR FINANCIAMIENTO")).toBe("interest");
    expect(classifyFee("INTERESES CONSUMOS MES ANTERIOR")).toBe("interest");
  });

  // Interest is tested BEFORE the incident list on purpose: late interest is
  // still interest, and the interest row is the one that owns it.
  it("prefers the interest rule over the incident rule", () => {
    expect(classifyFee("INTERES POR MORA")).toBe("interest");
  });

  it("files things that happened as incidents", () => {
    expect(classifyFee("CARGO SOBREGIRO")).toBe("incidents");
    expect(classifyFee("Cargo por mora")).toBe("incidents");
    expect(classifyFee("LATE PAYMENT FEE")).toBe("incidents");
  });

  it("files known ownership charges as recurring", () => {
    expect(classifyFee("CARGO SEGURO FRAUDE")).toBe("recurring");
    expect(classifyFee("CARGO COBERTURA DE SEGURO")).toBe("recurring");
    expect(classifyFee("CUOTA ANUALIDAD")).toBe("recurring");
  });

  // The live data's argument for defaulting to recurring: the issuer tagged
  // this a fee, and it matches none of the prompt's keywords — it is a bundled
  // insurance product with a pure brand name. Incident vocabulary is a bounded
  // list; ownership charges are unbounded product names.
  it("defaults an unrecognised product name to recurring", () => {
    expect(classifyFee("AHORRO MUJER WHITE")).toBe("recurring");
  });

  // Whole words only: a keyword must not match inside a longer word.
  it("does not match a keyword inside another word", () => {
    expect(classifyFee("CHOCOLATERIA")).toBe("recurring");
    expect(classifyFee("MEMORABLE")).toBe("recurring");
  });
});

describe("reversalTarget", () => {
  it("routes a fee reversal back to the bucket it reverses", () => {
    expect(reversalTarget("REVERSO CARGO SEGURO FRAUDE")).toBe("recurring");
    expect(reversalTarget("ANULACION CARGO SOBREGIRO")).toBe("incidents");
  });

  it("routes an interest reversal to interest", () => {
    expect(reversalTarget("REVERSO DE INTERES")).toBe("interest");
    expect(reversalTarget("REVERSO INTERESES POR FINANCIAMIENTO")).toBe("interest");
  });

  // The guard. Without the fee-word test this would drag an ordinary purchase
  // refund into a card about fees.
  it("ignores a reversal that reverses something other than a fee", () => {
    expect(reversalTarget("REVERSO COMPRA")).toBeNull();
  });

  it("ignores a credit that is not a reversal at all", () => {
    expect(reversalTarget("CASHBACK SERVICIOS DEL")).toBeNull();
    expect(reversalTarget("Rebate VISA ISI")).toBeNull();
  });
});

describe("summarizeCardFees", () => {
  // The four rows actually present in the database, with SEGURO FRAUDE as its
  // two real 350.00 charges. The issuer billed it twice by mistake and reversed
  // one, which is exactly why a naive sum(kind='fee') is wrong here.
  const live: FeeLineRow[] = [
    fee("CARGO SEGURO FRAUDE", 350, "2026-06-26"),
    fee("CARGO SEGURO FRAUDE", 350, "2026-06-30"),
    fee("CARGO COBERTURA DE SEGURO", 1300, "2026-06-26"),
    fee("CARGO SOBREGIRO", 500, "2026-06-25"),
    credit("REVERSO CARGO SEGURO FRAUDE", -350, "2026-07-03"),
  ];

  it("nets reversals against the bucket they reverse", () => {
    expect(summarizeCardFees(live, 2026)).toEqual({
      recurring: 1650,
      incidents: 500,
      interest: 0,
      counted: 5,
    });
  });

  it("keeps interest out of both fee subtotals and totals it on its own", () => {
    const rows = [fee("CARGO SEGURO FRAUDE", 350), fee("INTERES FINANCIAMIENTO", 900)];
    expect(summarizeCardFees(rows, 2026)).toEqual({
      recurring: 350,
      incidents: 0,
      interest: 900,
      counted: 2,
    });
  });

  it("sums the AMEX Platinum interest lines and nets an interest reversal", () => {
    const rows = [
      fee("INTERESES POR FINANCIAMIENTO", 86.98, "2026-08-17"),
      fee("INTERESES CONSUMOS MES ANTERIOR", 27.13, "2026-08-17"),
      credit("REVERSO DE INTERES", -27.13, "2026-09-10"),
    ];
    expect(summarizeCardFees(rows, 2026).interest).toBeCloseTo(86.98, 2);
  });

  it("ignores rows posted in another year", () => {
    const rows = [
      fee("CARGO SEGURO FRAUDE", 350, "2025-12-26"),
      fee("CARGO SEGURO FRAUDE", 350, "2026-01-26"),
    ];
    expect(summarizeCardFees(rows, 2026).recurring).toBe(350);
  });

  // `counted` is what lets the surfaces tell "no fee lines at all" from "fees
  // that netted to zero". The former is omitted; a confident 0.00 drawn from
  // silence is a claim the data cannot support.
  it("reports nothing counted when there are no fee rows", () => {
    expect(summarizeCardFees([], 2026)).toEqual({
      recurring: 0,
      incidents: 0,
      interest: 0,
      counted: 0,
    });
    expect(summarizeCardFees([credit("CASHBACK SERVICIOS DEL", -259)], 2026).counted).toBe(0);
  });

  it("counts rows that net to zero", () => {
    const rows = [fee("CARGO SEGURO FRAUDE", 350), credit("REVERSO CARGO SEGURO FRAUDE", -350)];
    expect(summarizeCardFees(rows, 2026)).toEqual({
      recurring: 0,
      incidents: 0,
      interest: 0,
      counted: 2,
    });
  });
});
