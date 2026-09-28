import { describe, expect, test } from "vitest";
import { BILLING_CYCLE_CHOICES, BILLING_CYCLE_VALUES, monthlyEquivalent, nextChargeDate } from "./cycle";

// Local dates throughout: the cycle helpers work on the viewer's calendar.
const ymd = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;

describe("nextChargeDate", () => {
  const from = new Date(2026, 8, 14, 10); // Mon 14 Sep 2026, mid-morning

  test("monthly rolls past a day already gone this month", () => {
    expect(ymd(nextChargeDate({ cycle: "monthly", anchorDay: 5 }, from))).toBe("2026-10-05");
    expect(ymd(nextChargeDate({ cycle: "monthly", anchorDay: 20 }, from))).toBe("2026-09-20");
  });

  test("without an anchor there is no date", () => {
    expect(nextChargeDate({ cycle: "monthly", anchorDay: null }, from)).toBeNull();
    expect(nextChargeDate({ cycle: "biweekly", anchorDate: null }, from)).toBeNull();
  });

  test("biweekly returns a future start date as-is", () => {
    expect(ymd(nextChargeDate({ cycle: "biweekly", anchorDate: "2026-09-25" }, from))).toBe("2026-09-25");
  });

  test("biweekly steps a past start date forward in 14-day jumps", () => {
    // 1 Sep + 14 = 15 Sep, the first one after today.
    expect(ymd(nextChargeDate({ cycle: "biweekly", anchorDate: "2026-09-01" }, from))).toBe("2026-09-15");
    // 10 Aug + 14k: 24 Aug, 7 Sep, 21 Sep.
    expect(ymd(nextChargeDate({ cycle: "biweekly", anchorDate: "2026-08-10" }, from))).toBe("2026-09-21");
  });

  // Same rule weekly already follows: today's occurrence is the one being
  // recorded, so "next" is the one after it.
  test("biweekly landing on today moves to the following occurrence", () => {
    expect(ymd(nextChargeDate({ cycle: "biweekly", anchorDate: "2026-08-31" }, from))).toBe("2026-09-28");
  });

  test("biweekly stays on the calendar day across a DST change", () => {
    const march = new Date(2027, 2, 20, 10);
    expect(ymd(nextChargeDate({ cycle: "biweekly", anchorDate: "2027-03-08" }, march))).toBe("2027-03-22");
  });

  test("an unparseable start date gives no date", () => {
    expect(nextChargeDate({ cycle: "biweekly", anchorDate: "soon" }, from)).toBeNull();
  });

  test("semimonthly lands on the 16th when today is on or before the 15th", () => {
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 14, 10)))).toBe("2026-09-16");
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 1, 10)))).toBe("2026-09-16");
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 15, 10)))).toBe("2026-09-16");
  });

  test("semimonthly lands on the 1st of next month after the 15th", () => {
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 16, 10)))).toBe("2026-10-01");
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 30, 10)))).toBe("2026-10-01");
  });

  test("semimonthly counts from its first payday", () => {
    expect(ymd(nextChargeDate({ cycle: "semimonthly", anchorDay: 5 }, new Date(2026, 8, 3)))).toBe("2026-09-05");
    expect(ymd(nextChargeDate({ cycle: "semimonthly", anchorDay: 5 }, new Date(2026, 8, 10)))).toBe("2026-09-20");
    expect(ymd(nextChargeDate({ cycle: "semimonthly", anchorDay: 5 }, new Date(2026, 8, 25)))).toBe("2026-10-05");
  });

  test("semimonthly treats an anchor past 15 as the 1st/16th", () => {
    expect(
      ymd(nextChargeDate({ cycle: "semimonthly", anchorDay: 99, anchorDate: "bogus" }, new Date(2026, 8, 14))),
    ).toBe("2026-09-16");
  });
});

describe("monthlyEquivalent", () => {
  test("biweekly is 26 charges a year", () => {
    expect(monthlyEquivalent(1200, "biweekly")).toBeCloseTo(2600);
  });

  test("the existing cycles are unchanged", () => {
    expect(monthlyEquivalent(12, "weekly")).toBeCloseTo(52);
    expect(monthlyEquivalent(120, "yearly")).toBeCloseTo(10);
    expect(monthlyEquivalent(10, "monthly")).toBe(10);
  });

  test("semimonthly is twice a month", () => {
    expect(monthlyEquivalent(1000, "semimonthly")).toBe(2000);
  });
});


describe("BILLING_CYCLE_CHOICES", () => {
  test("hides biweekly from pickers but keeps it a valid cycle", () => {
    expect(BILLING_CYCLE_CHOICES).not.toContain("biweekly");
    expect(BILLING_CYCLE_CHOICES).toEqual(["weekly", "semimonthly", "monthly", "yearly", "custom"]);
    expect(BILLING_CYCLE_VALUES).toContain("biweekly");
  });
});
