import { describe, expect, it } from "vitest";
import { resolveCategoryId, MCC_DEFAULT_CATEGORY } from "./categorize";

const names = new Map([
  ["Groceries", "cat-groceries"],
  ["Dining", "cat-dining"],
  ["Transport", "cat-transport"],
  ["Shopping", "cat-shopping"],
  ["Entertainment", "cat-entertainment"],
  ["Health", "cat-health"],
]);

describe("resolveCategoryId", () => {
  it("merchant rule beats mcc rule beats defaults", () => {
    const rules = [
      { rule_type: "merchant" as const, pattern: "UBER EATS", category_id: "cat-dining", priority: 0 },
      { rule_type: "mcc" as const, pattern: "4111", category_id: "cat-transport", priority: 0 },
    ];
    expect(
      resolveCategoryId({ mcc: "4111", description: "UBER EATS-WB*UBER EATS" }, rules, names),
    ).toBe("cat-dining");
    expect(
      resolveCategoryId({ mcc: "4111", description: "METRO CARD" }, rules, names),
    ).toBe("cat-transport");
  });

  it("merchant matching is case-insensitive substring, higher priority wins", () => {
    const rules = [
      { rule_type: "merchant" as const, pattern: "pricemart", category_id: "cat-groceries", priority: 1 },
      { rule_type: "merchant" as const, pattern: "price", category_id: "cat-shopping", priority: 0 },
    ];
    expect(
      resolveCategoryId({ mcc: null, description: "PRICEMART SAN ISIDRO" }, rules, names),
    ).toBe("cat-groceries");
  });

  it("falls back to built-in MCC defaults by seeded category name", () => {
    expect(resolveCategoryId({ mcc: "5411", description: "X" }, [], names)).toBe("cat-groceries");
    expect(resolveCategoryId({ mcc: "5812", description: "X" }, [], names)).toBe("cat-dining");
    expect(resolveCategoryId({ mcc: "5541", description: "X" }, [], names)).toBe("cat-transport");
  });

  it("returns null when nothing matches — the importer says so rather than guessing", () => {
    expect(resolveCategoryId({ mcc: null, description: "MYSTERY" }, [], names)).toBeNull();
    expect(resolveCategoryId({ mcc: "9999", description: "X" }, [], names)).toBeNull();
    const empty = new Map<string, string>();
    expect(resolveCategoryId({ mcc: "5411", description: "X" }, [], empty)).toBeNull();
  });

  it("covers the MCCs seen on real statements", () => {
    for (const mcc of ["5411", "5499", "5812", "5813", "5814", "5541", "4111", "9399", "5311", "5999", "5921", "5912", "8011", "8099"]) {
      expect(MCC_DEFAULT_CATEGORY[mcc]).toBeTruthy();
    }
  });

  it("LLM suggestion beats the MCC default table when no rule matches", () => {
    expect(
      resolveCategoryId(
        { mcc: null, description: "SOME NEW MERCHANT", suggestedCategory: "Entertainment" },
        [],
        names,
      ),
    ).toBe("cat-entertainment");
  });

  it("LLM suggestion matches case-insensitively", () => {
    expect(
      resolveCategoryId(
        { mcc: null, description: "SOME NEW MERCHANT", suggestedCategory: "groceries" },
        [],
        names,
      ),
    ).toBe("cat-groceries");
  });

  it("a merchant or MCC rule still beats the LLM suggestion", () => {
    const rules = [
      { rule_type: "mcc" as const, pattern: "5812", category_id: "cat-transport", priority: 0 },
    ];
    expect(
      resolveCategoryId(
        { mcc: "5812", description: "X", suggestedCategory: "Dining" },
        rules,
        names,
      ),
    ).toBe("cat-transport");
  });

  it("falls through to the MCC default table when the LLM suggestion isn't a real category", () => {
    expect(
      resolveCategoryId(
        { mcc: "5411", description: "X", suggestedCategory: "NotARealCategory" },
        [],
        names,
      ),
    ).toBe("cat-groceries");
  });
});
