import { describe, expect, it } from "vitest";
import { subscriptionInput } from "../subscriptions/schema";
import { BILL_PRESETS, billFromPreset, categoryIdForPreset } from "./bills";

const categories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Housing" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Utilities" },
];
const acct = "33333333-3333-4333-8333-333333333333";

describe("categoryIdForPreset", () => {
  it("matches the seeded category name, case-insensitively", () => {
    expect(categoryIdForPreset("rent", [{ id: categories[0].id, name: "housing" }])).toBe(categories[0].id);
    expect(categoryIdForPreset("power", categories)).toBe(categories[1].id);
  });

  it("refuses to guess when there is no match", () => {
    expect(categoryIdForPreset("insurance", categories)).toBe("");
    expect(categoryIdForPreset("other", categories)).toBe("");
  });
});

describe("billFromPreset", () => {
  it("builds a monthly expense template that the schema accepts", () => {
    const row = billFromPreset(
      { preset: "rent", name: "Alquiler", amount: "25000", day: "30", accountId: acct, currency: "DOP" },
      categories,
    );
    expect(row).toEqual({
      kind: "expense",
      name: "Alquiler",
      amount: 25000,
      currency: "DOP",
      billing_cycle: "monthly",
      anchor_day: 30,
      account_id: acct,
      category_id: categories[0].id,
      is_active: true,
    });
    expect(subscriptionInput.safeParse(row).success).toBe(true);
  });

  it("leaves the day unset when blank", () => {
    const row = billFromPreset(
      { preset: "other", name: "Gimnasio", amount: "1500", day: "", accountId: "", currency: "DOP" },
      categories,
    );
    expect(row.anchor_day).toBeUndefined();
    expect(row.category_id).toBe("");
    expect(subscriptionInput.safeParse(row).success).toBe(true);
  });

  it("covers every preset", () => {
    expect(BILL_PRESETS.map((p) => p.key)).toEqual(["rent", "power", "water", "internet", "phone", "insurance", "other"]);
  });
});
