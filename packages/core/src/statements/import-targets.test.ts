import { describe, expect, it } from "vitest";
import { collapseImportTargets, type ImportTarget } from "./import-targets";

function line(over: Partial<ImportTarget> & Pick<ImportTarget, "id">): ImportTarget {
  return {
    name: "Card",
    currency: "DOP",
    last4: null,
    cardGroupId: null,
    groupName: null,
    ...over,
  };
}

describe("collapseImportTargets", () => {
  it("keeps an ungrouped card as its own row, with its currency", () => {
    const rows = collapseImportTargets([line({ id: "a", name: "Popular Visa", last4: "1234" })]);
    expect(rows).toEqual([
      { accountId: "a", label: "Popular Visa", currency: "DOP", last4: "1234" },
    ]);
  });

  it("collapses every line of a card group into one row under the group's name", () => {
    const rows = collapseImportTargets([
      line({ id: "dop", name: "Visa Infinite · DOP", cardGroupId: "g1", groupName: "Visa Infinite" }),
      line({ id: "usd", name: "Visa Infinite · USD", currency: "USD", cardGroupId: "g1", groupName: "Visa Infinite" }),
      line({ id: "cuotas", name: "Visa Infinite · Cuotas", cardGroupId: "g1", groupName: "Visa Infinite" }),
    ]);

    // Three lines are one physical card. Listed raw they read as three cards,
    // which is the failure this exists to prevent.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ accountId: "dop", label: "Visa Infinite" });
    // No single currency is true of the card, so none is claimed.
    expect(rows[0].currency).toBeNull();
  });

  it("takes the digits from whichever line of the group carries them", () => {
    const rows = collapseImportTargets([
      line({ id: "dop", cardGroupId: "g1", groupName: "Visa Infinite", last4: null }),
      line({ id: "usd", cardGroupId: "g1", groupName: "Visa Infinite", last4: "9876" }),
    ]);
    expect(rows[0].last4).toBe("9876");
  });

  it("falls back to a line's own name when the group has none", () => {
    const rows = collapseImportTargets([
      line({ id: "dop", name: "Visa Infinite · DOP", cardGroupId: "g1", groupName: null }),
    ]);
    expect(rows[0].label).toBe("Visa Infinite · DOP");
  });

  it("keeps separate groups separate and preserves the incoming order", () => {
    const rows = collapseImportTargets([
      line({ id: "solo", name: "Amex" }),
      line({ id: "g1-a", cardGroupId: "g1", groupName: "Visa" }),
      line({ id: "g2-a", cardGroupId: "g2", groupName: "Mastercard" }),
      line({ id: "g1-b", cardGroupId: "g1", groupName: "Visa" }),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Amex", "Visa", "Mastercard"]);
  });
});
