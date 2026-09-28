import { describe, expect, it } from "vitest";
import { suggestAccountId, suggestAccountMappings } from "./mapping";

const options = [
  { id: "dop-main", name: "AMEX DOP", currency: "DOP", credit_limit: 624400 },
  { id: "usd", name: "AMEX USD", currency: "USD", credit_limit: 6036 },
  { id: "cuotas", name: "AMEX Cuotas", currency: "DOP", credit_limit: 40000 },
];

describe("suggestAccountId", () => {
  it("matches by currency when unambiguous", () => {
    expect(suggestAccountId({ currency: "USD", creditLimitCents: 603600 }, options)).toBe("usd");
  });
  it("disambiguates same-currency lines by nearest credit limit", () => {
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: 62440000 }, options)).toBe("dop-main");
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: 4000000 }, options)).toBe("cuotas");
  });
  it("returns null when no option shares the currency", () => {
    expect(suggestAccountId({ currency: "EUR", creditLimitCents: null }, options)).toBeNull();
  });
  it("without a statement limit, picks the sole currency match or null", () => {
    expect(suggestAccountId({ currency: "USD", creditLimitCents: null }, options)).toBe("usd");
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: null }, options)).toBeNull();
  });
});

describe("suggestAccountMappings", () => {
  const dopOnly = [{ id: "dop-main", name: "Visa DOP", currency: "DOP", credit_limit: 40000 }];

  it("leaves cuotas unmapped instead of borrowing the one DOP line the consumos section already claimed", () => {
    const sections = [
      { sectionKey: "DOP", currency: "DOP", creditLimitCents: null },
      { sectionKey: "DOP_CUOTAS", currency: "DOP", creditLimitCents: null },
    ];
    const result = suggestAccountMappings(sections, new Map(), dopOnly);
    expect(result.get("DOP")).toBe("dop-main");
    expect(result.get("DOP_CUOTAS")).toBeNull();
  });

  it("does the same regardless of which order the sections were parsed in", () => {
    const sections = [
      { sectionKey: "DOP_CUOTAS", currency: "DOP", creditLimitCents: null },
      { sectionKey: "DOP", currency: "DOP", creditLimitCents: null },
    ];
    const result = suggestAccountMappings(sections, new Map(), dopOnly);
    expect(result.get("DOP")).toBe("dop-main");
    expect(result.get("DOP_CUOTAS")).toBeNull();
  });

  it("gives each section its own line once a cuotas line exists", () => {
    const sections = [
      { sectionKey: "DOP", currency: "DOP", creditLimitCents: 6244000000 },
      { sectionKey: "DOP_CUOTAS", currency: "DOP", creditLimitCents: 400000000 },
    ];
    const result = suggestAccountMappings(sections, new Map(), [
      { id: "dop-main", name: "Visa DOP", currency: "DOP", credit_limit: 624400 },
      { id: "cuotas", name: "Visa Cuotas", currency: "DOP", credit_limit: 40000 },
    ]);
    expect(result.get("DOP")).toBe("dop-main");
    expect(result.get("DOP_CUOTAS")).toBe("cuotas");
  });

  it("keeps a saved mapping and does not let a fresh suggestion steal its line", () => {
    const sections = [
      { sectionKey: "DOP", currency: "DOP", creditLimitCents: null },
      { sectionKey: "DOP_CUOTAS", currency: "DOP", creditLimitCents: null },
    ];
    const saved = new Map([["DOP", "dop-main"]]);
    const result = suggestAccountMappings(sections, saved, dopOnly);
    // DOP is already saved, so it is skipped rather than re-suggested — its
    // account is still excluded from what cuotas can be offered.
    expect(result.has("DOP")).toBe(false);
    expect(result.get("DOP_CUOTAS")).toBeNull();
  });
});
