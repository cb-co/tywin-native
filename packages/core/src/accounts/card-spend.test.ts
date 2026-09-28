import { describe, expect, it } from "vitest";
import {
  cardSpendDistribution,
  spendTotal,
  type CardSpendTransaction,
  type SpendCategory,
} from "./card-spend";

const CHART_1 = "var(--chart-1)";
const CHART_2 = "var(--chart-2)";

const CATEGORIES: SpendCategory[] = [
  { id: "dining", name: "Dining", color: "#E85B3F", emoji: "🍜" },
  { id: "transport", name: "Transport", color: "#1A96CE" },
  { id: "nocolor", name: "Sin color", color: null },
];

function tx(category_id: string | null, total_amount: number | string | null): CardSpendTransaction {
  return { category_id, total_amount };
}

describe("cardSpendDistribution", () => {
  it("sums each category and orders the slices largest first", () => {
    const slices = cardSpendDistribution(
      [tx("transport", 300), tx("dining", 1000), tx("transport", 250), tx("dining", 200)],
      CATEGORIES,
      "Uncategorized",
    );
    expect(slices).toEqual([
      { name: "Dining", value: 1200, color: "#E85B3F", emoji: "🍜", categoryId: "dining" },
      { name: "Transport", value: 550, color: "#1A96CE", categoryId: "transport" },
    ]);
  });

  it("folds every category-less charge into one slice", () => {
    // `category_id` is ON DELETE SET NULL, so deleting a category leaves its
    // charges behind with a null. Three of them are one slice, not three.
    const slices = cardSpendDistribution(
      [tx(null, 40), tx(null, 60), tx(null, 100), tx("dining", 500)],
      CATEGORIES,
      "Uncategorized",
    );
    expect(slices).toEqual([
      { name: "Dining", value: 500, color: "#E85B3F", emoji: "🍜", categoryId: "dining" },
      { name: "Uncategorized", value: 200, color: CHART_2, categoryId: null },
    ]);
  });

  it("falls back to a series colour for a category with none stored", () => {
    const slices = cardSpendDistribution([tx("nocolor", 75)], CATEGORIES, "Uncategorized");
    expect(slices).toEqual([{ name: "Sin color", value: 75, color: CHART_1, categoryId: "nocolor" }]);
  });

  it("assigns fallback colours in ring order, not row order", () => {
    // The small slice arrives first but is drawn second, so it takes --chart-2.
    const slices = cardSpendDistribution(
      [tx(null, 10), tx("nocolor", 900)],
      CATEGORIES,
      "Uncategorized",
    );
    expect(slices.map((s) => s.color)).toEqual([CHART_1, CHART_2]);
  });

  it("ignores rows that carry no positive amount", () => {
    const slices = cardSpendDistribution(
      [tx("dining", 0), tx("transport", null), tx("dining", "not a number"), tx("dining", 120)],
      CATEGORIES,
      "Uncategorized",
    );
    expect(slices).toEqual([{ name: "Dining", value: 120, color: "#E85B3F", emoji: "🍜", categoryId: "dining" }]);
  });

  it("reads a numeric column that arrives as a string", () => {
    // Postgres numeric(18,4) comes back as a string once it outgrows a double.
    const slices = cardSpendDistribution(
      [tx("dining", "1234.5600"), tx("dining", "0.4400")],
      CATEGORIES,
      "Uncategorized",
    );
    expect(slices[0].value).toBeCloseTo(1235, 10);
  });

  it("is empty when the card was charged nothing in the window", () => {
    expect(cardSpendDistribution([], CATEGORIES, "Uncategorized")).toEqual([]);
  });

  // Regression: the credit card detail page's ledger fell back to Dining's
  // first letter ("D") instead of its emoji, because SpendCategory/SpendSlice
  // had no emoji field for it to travel through.
  it("carries a category's emoji through to its slice", () => {
    const slices = cardSpendDistribution([tx("dining", 100)], CATEGORIES, "Uncategorized");
    expect(slices[0].emoji).toBe("🍜");
  });

  it("leaves emoji undefined for a category that has none", () => {
    const slices = cardSpendDistribution([tx("transport", 100)], CATEGORIES, "Uncategorized");
    expect(slices[0].emoji).toBeUndefined();
  });

  // Regression: a category row had no id to drill into — tapping it to see
  // the transactions behind the number had nothing to filter by.
  it("carries a category's id through to its slice", () => {
    const slices = cardSpendDistribution([tx("dining", 100)], CATEGORIES, "Uncategorized");
    expect(slices[0].categoryId).toBe("dining");
  });

  it("gives the uncategorized/deleted-category slice a null id", () => {
    const slices = cardSpendDistribution([tx(null, 100)], CATEGORIES, "Uncategorized");
    expect(slices[0].categoryId).toBeNull();
  });
});

describe("spendTotal", () => {
  it("sums the slices it is given", () => {
    const slices = cardSpendDistribution(
      [tx("dining", 1200), tx("transport", 550), tx(null, 200)],
      CATEGORIES,
      "Uncategorized",
    );
    expect(spendTotal(slices)).toBe(1950);
  });

  it("is zero for an empty ring", () => {
    expect(spendTotal([])).toBe(0);
  });
});
