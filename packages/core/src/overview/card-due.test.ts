import { describe, expect, it } from "vitest";
import { cardAmountDue, cardDue, dayAfter } from "./card-due";

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

describe("cardDue", () => {
  it("leads with the printed minimum while nothing has been paid", () => {
    expect(cardDue(40000, 45000, 0, 6750)).toEqual({ balance: 40000, minimum: 6750 });
  });
  it("counts the minimum down with payments made since the statement", () => {
    expect(cardDue(40000, 45000, 5000, 6750)).toEqual({ balance: 35000, minimum: 1750 });
  });
  it("reports the minimum as met once payments cover it, with the rest of the balance still standing", () => {
    expect(cardDue(40000, 45000, 6750, 6750)).toEqual({ balance: 33250, minimum: 0 });
    expect(cardDue(40000, 45000, 38000, 6750)).toEqual({ balance: 2000, minimum: 0 });
  });
  it("clamps the minimum to the balance left", () => {
    expect(cardDue(1000, 1000, 0, 6750)).toEqual({ balance: 1000, minimum: 1000 });
  });
  it("has no minimum when the bank printed none, or there is no statement", () => {
    expect(cardDue(40000, 45000, 0, null)).toEqual({ balance: 40000, minimum: null });
    expect(cardDue(null, 1500, 0, 6750)).toEqual({ balance: 1500, minimum: null });
  });
  it("is null once the statement is settled", () => {
    expect(cardDue(40000, 5000, 40000, 6750)).toBeNull();
  });
});
