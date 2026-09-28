import { describe, expect, it } from "vitest";
import { cardAmountDue, dayAfter } from "./card-due";

describe("dayAfter", () => {
  it("advances one day", () => {
    expect(dayAfter("2026-07-19")).toBe("2026-07-20");
  });
  it("crosses month and year boundaries", () => {
    expect(dayAfter("2026-07-31")).toBe("2026-08-01");
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
  });
  it("handles leap day", () => {
    expect(dayAfter("2028-02-28")).toBe("2028-02-29");
    expect(dayAfter("2026-02-28")).toBe("2026-03-01");
  });
});

describe("cardAmountDue", () => {
  it("nets payments off the statement balance", () => {
    expect(cardAmountDue(37992.08, 40000, 10000)).toBeCloseTo(27992.08, 2);
  });
  it("shows the full statement when nothing has been paid", () => {
    expect(cardAmountDue(37992.08, 40000, 0)).toBeCloseTo(37992.08, 2);
  });
  it("drops the card once payments cover the statement", () => {
    expect(cardAmountDue(37992.08, 5000, 37992.08)).toBeNull();
    expect(cardAmountDue(37992.08, 5000, 40000)).toBeNull(); // overpaid
  });
  it("treats a sub-cent remainder as settled", () => {
    expect(cardAmountDue(100, 0, 99.999)).toBeNull();
  });
  it("falls back to the live balance when there is no statement", () => {
    expect(cardAmountDue(null, 1500, 0)).toBe(1500);
    expect(cardAmountDue(null, 0, 0)).toBeNull();
    expect(cardAmountDue(null, null, 0)).toBeNull();
  });
  it("ignores payments when there is no statement — owed is already net", () => {
    expect(cardAmountDue(null, 1500, 9999)).toBe(1500);
  });
});
