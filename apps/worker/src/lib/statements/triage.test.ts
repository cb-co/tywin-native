import { describe, expect, it } from "vitest";
import { groupForTriage, type TriageLine } from "./triage";

function line(over: Partial<TriageLine> = {}): TriageLine {
  return {
    transactionId: "t-1",
    description: "SM NACIONAL METRO PLZA SANTO DOMINGO-DO",
    currency: "DOP",
    amount: 1000,
    madeOn: "2026-07-10",
    categoryId: null,
    ...over,
  };
}

describe("groupForTriage", () => {
  it("groups identical descriptions and sums them", () => {
    const groups = groupForTriage([
      line({ transactionId: "a", amount: 1000, madeOn: "2026-07-10" }),
      line({ transactionId: "b", amount: 500, madeOn: "2026-07-02" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].total).toBe(1500);
    expect(groups[0].transactionIds).toEqual(["a", "b"]);
    expect(groups[0].firstDate).toBe("2026-07-02");
    expect(groups[0].lastDate).toBe("2026-07-10");
  });

  it("excludes lines that already have a category", () => {
    expect(groupForTriage([line({ categoryId: "cat-1" })])).toHaveLength(0);
  });

  it("never merges two currencies — an import can carry a DOP and a USD section", () => {
    const groups = groupForTriage([
      line({ transactionId: "a", currency: "DOP" }),
      line({ transactionId: "b", currency: "USD" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.currency))).toEqual(new Set(["DOP", "USD"]));
  });

  it("sorts by count, then total, then description — the biggest win first", () => {
    const groups = groupForTriage([
      line({ transactionId: "a", description: "ONE OFF", amount: 9000 }),
      line({ transactionId: "b", description: "TWICE", amount: 100 }),
      line({ transactionId: "c", description: "TWICE", amount: 100 }),
    ]);
    expect(groups.map((g) => g.description)).toEqual(["TWICE", "ONE OFF"]);
  });

  it("carries the rule pattern, normalised", () => {
    const groups = groupForTriage([line({ description: "  helados bon  metro " })]);
    expect(groups[0].pattern).toBe("HELADOS BON METRO");
  });
});
