import { describe, it, expect } from "vitest";
import { payCycleOf, payAnchorOf, currentPeriod } from "./profile";

describe("payCycleOf", () => {
  it("reads the profile's cycle", () => {
    expect(payCycleOf({ pay_cycle: "semimonthly" })).toBe("semimonthly");
  });

  it("falls back to monthly for a profile that has not loaded", () => {
    // Deliberately monthly, not the column default: an unloaded profile must
    // render today's app, never a period the user did not choose.
    expect(payCycleOf(null)).toBe("monthly");
    expect(payCycleOf(undefined)).toBe("monthly");
    expect(payCycleOf({})).toBe("monthly");
  });

  it("falls back to monthly for an unrecognised value", () => {
    expect(payCycleOf({ pay_cycle: "fortnightly" })).toBe("monthly");
  });
});

describe("payAnchorOf", () => {
  it("reads the anchor", () => {
    expect(payAnchorOf({ pay_cycle: "monthly", pay_anchor_day: 25 })).toBe(25);
  });

  it("is null when absent", () => {
    expect(payAnchorOf({ pay_cycle: "semimonthly" })).toBeNull();
    expect(payAnchorOf(null)).toBeNull();
  });
});

describe("currentPeriod", () => {
  it("gives a quincenal profile the half it is in", () => {
    expect(currentPeriod({ pay_cycle: "semimonthly" }, "2026-09-08")).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("gives an unloaded profile the calendar month", () => {
    expect(currentPeriod(null, "2026-09-08")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });
});
