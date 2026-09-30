import { describe, it, expect } from "vitest";
import { budgetLabelParts } from "./label";

describe("budgetLabelParts", () => {
  it("shows one figure for a whole calendar month — today's page, unchanged", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-30" }, 5000, 5000),
    ).toEqual({ monthly: 5000, prorated: null });
  });

  it("shows both figures for a quincena", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-15" }, 5000, 2500),
    ).toEqual({ monthly: 5000, prorated: 2500 });
  });

  it("shows one figure for a monthly cycle's pay period, which takes the month whole", () => {
    expect(
      budgetLabelParts({ start: "2026-09-14", end: "2026-10-13" }, 200, 200),
    ).toEqual({ monthly: 200, prorated: null });
  });

  it("shows one figure when nothing is budgeted, rather than 0 of 0", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-15" }, 0, 0),
    ).toEqual({ monthly: 0, prorated: null });
  });
});
