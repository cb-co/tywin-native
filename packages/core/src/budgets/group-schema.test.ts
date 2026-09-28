import { describe, it, expect } from "vitest";
import {
  NO_GROUP,
  budgetGroupSchema,
  categoryGroupSchema,
  setGroupBudgetSchema,
  toGroupId,
} from "./group-schema";

const schema = budgetGroupSchema("Name is required");
const UUID = "4b6e8639-43c7-446c-b2de-6db62eddb6f1";

describe("budgetGroupSchema", () => {
  it("accepts a name on its own", () => {
    const parsed = schema.safeParse({ name: "Essentials" });
    expect(parsed.success).toBe(true);
  });

  it("trims the name and rejects one that is only whitespace", () => {
    expect(schema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("reports the translated message for a missing name", () => {
    const parsed = schema.safeParse({ name: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Name is required");
  });

  it("rejects a name past the 40-character cap categories use", () => {
    expect(schema.safeParse({ name: "x".repeat(41) }).success).toBe(false);
  });

  it("accepts an empty emoji and colour, the way the dialog sends them", () => {
    expect(schema.safeParse({ name: "Fun", emoji: "", color: "" }).success).toBe(true);
  });
});

describe("setGroupBudgetSchema", () => {
  it("accepts the first of a month", () => {
    expect(
      setGroupBudgetSchema.safeParse({ budget_group_id: UUID, month: "2026-08-01", amount: 500 })
        .success,
    ).toBe(true);
  });

  it("rejects a month that is not the first", () => {
    expect(
      setGroupBudgetSchema.safeParse({ budget_group_id: UUID, month: "2026-08-15", amount: 500 })
        .success,
    ).toBe(false);
  });

  it("coerces the amount the input element sends as a string", () => {
    const parsed = setGroupBudgetSchema.safeParse({
      budget_group_id: UUID,
      month: "2026-08-01",
      amount: "500.25",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.amount).toBe(500.25);
  });

  it("rejects a negative amount", () => {
    expect(
      setGroupBudgetSchema.safeParse({ budget_group_id: UUID, month: "2026-08-01", amount: -1 })
        .success,
    ).toBe(false);
  });
});

describe("categoryGroupSchema", () => {
  it("accepts an assignment", () => {
    expect(
      categoryGroupSchema.safeParse({ category_id: UUID, budget_group_id: UUID }).success,
    ).toBe(true);
  });

  // The clearing path. Null has to parse as a value, or removing a category's
  // group turns into a write of nothing and the old group stays put.
  it("accepts an explicit null, so clearing a category's group is a real write", () => {
    const parsed = categoryGroupSchema.safeParse({ category_id: UUID, budget_group_id: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.budget_group_id).toBeNull();
  });

  it("rejects a missing budget_group_id rather than treating it as a clear", () => {
    expect(categoryGroupSchema.safeParse({ category_id: UUID }).success).toBe(false);
  });

  it("rejects an empty string, which is what an unset select would send raw", () => {
    expect(
      categoryGroupSchema.safeParse({ category_id: UUID, budget_group_id: "" }).success,
    ).toBe(false);
  });
});

describe("toGroupId", () => {
  it("passes a real id through", () => {
    expect(toGroupId(UUID)).toBe(UUID);
  });

  it("turns every way of saying 'no group' into null", () => {
    expect(toGroupId("")).toBeNull();
    expect(toGroupId(NO_GROUP)).toBeNull();
    expect(toGroupId(null)).toBeNull();
    expect(toGroupId(undefined)).toBeNull();
  });
});
