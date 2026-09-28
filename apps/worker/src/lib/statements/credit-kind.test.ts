import { describe, expect, it } from "vitest";
import {
  classifyCredit,
  indexPurchases,
  merchantWords,
  precheckCredit,
  resolveCreditKinds,
} from "./credit-kind";

const NO_PURCHASES = indexPurchases([]);
const credit = (description: string, mcc: string | null = null) => ({ description, mcc });

describe("classifyCredit", () => {
  it("counts bank-issued credits with no merchant behind them as cashback", () => {
    for (const d of [
      "Credito por Promocion",
      "Crédito por Promoción",
      "Rebate VISA ISI",
      "BONO BUEN COMPORTAMIENTO",
      "REDENCION DE PUNTOS",
      "AHORRO POR COMPRA",
    ]) {
      expect(classifyCredit(credit(d), NO_PURCHASES), d).toBe("cashback");
    }
  });

  it("defaults an unexplained credit to cashback", () => {
    expect(classifyCredit(credit("CREDITO ESPECIAL CLIENTE"), NO_PURCHASES)).toBe("cashback");
  });

  it("treats a credit that undoes a charge as a refund", () => {
    for (const d of [
      "REVERSO CARGO ANUALIDAD",
      "REVERSO COMPRA",
      "ANULACION SEGURO",
      "CREDITO POR PAGO TOTAL",
      "CREDITO POR PAGO OPORTUNO",
      "CREDITO PROVISIONAL DISPUTA",
      "AJUSTE CARGO DUPLICADO",
      "REEMBOLSO",
      "DEVOLUCION MERCANCIA",
      "DEV AMAZON",
    ]) {
      expect(classifyCredit(credit(d), NO_PURCHASES), d).toBe("refund");
    }
  });

  it("lets reward vocabulary win over refund vocabulary", () => {
    expect(classifyCredit(credit("BONO POR PAGO OPORTUNO"), NO_PURCHASES)).toBe("cashback");
    expect(classifyCredit(credit("DEVOLUCION CASHBACK"), NO_PURCHASES)).toBe("cashback");
  });

  it("treats a credit carrying a merchant category code as a refund", () => {
    expect(classifyCredit(credit("ZARA BLUE MALL", "5651"), NO_PURCHASES)).toBe("refund");
  });

  it("treats a credit naming a merchant the card bought from as a refund", () => {
    const bought = indexPurchases(["PULL & BEAR AGORA MALL SANTO DOMINGO 5651 050477"]);
    expect(classifyCredit(credit("PULL & BEAR AGORA MALL"), bought)).toBe("refund");
    expect(classifyCredit(credit("CREDITO PULL & BEAR"), bought)).toBe("refund");
  });

  it("does not match a different merchant sharing only a first word", () => {
    const bought = indexPurchases(["AMEX TRAVEL RESERVAS"]);
    expect(classifyCredit(credit("AMEX STATEMENT CREDIT"), bought)).toBe("cashback");
  });

  it("matches a one-word merchant name against a longer purchase description", () => {
    const bought = indexPurchases(["NETFLIX.COM LOS GATOS"]);
    expect(classifyCredit(credit("NETFLIX"), bought)).toBe("refund");
  });
});

describe("resolveCreditKinds", () => {
  it("only lets purchases on the same card turn a credit into a refund", () => {
    const lines = [
      { id: "a", account_id: "amex", description: "PULL & BEAR AGORA MALL", mcc: null },
      { id: "b", account_id: "visa", description: "PULL & BEAR AGORA MALL", mcc: null },
      { id: "c", account_id: "amex", description: "Credito por Promocion", mcc: null },
    ];
    const purchases = [{ account_id: "amex", description: "PULL & BEAR AGORA MALL" }];
    expect(resolveCreditKinds(lines, purchases)).toEqual(
      new Map([
        ["a", "refund"],
        ["b", "cashback"],
        ["c", "cashback"],
      ]),
    );
  });
});

describe("precheckCredit", () => {
  it("leaves a plain merchant-looking credit undecided until purchases are known", () => {
    expect(precheckCredit(credit("PULL & BEAR AGORA MALL"))).toBeNull();
  });
});

describe("merchantWords", () => {
  it("drops auth codes, MCCs and filler so a refund and its purchase line up", () => {
    expect(merchantWords("PICA POLLO SABROSURA SANTO DOMINGO 5814 050477")).toEqual(["PICA", "POLLO"]);
    expect(merchantWords("CREDITO POR PICA POLLO")).toEqual(["PICA", "POLLO"]);
  });

  it("is null when nothing merchant-like is left", () => {
    expect(merchantWords("0644812001")).toBeNull();
  });
});
