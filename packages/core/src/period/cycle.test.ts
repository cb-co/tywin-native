import { describe, it, expect } from "vitest";
import { periodFor, nextPayday, shiftPeriod, isWholeMonth, localDate, addDays } from "./cycle";

describe("periodFor · semimonthly", () => {
  it("puts the 1st through the 15th in the first half", () => {
    expect(periodFor("2026-09-08", "semimonthly", null)).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("puts the 16th onward in the second half, ending on the month's last day", () => {
    expect(periodFor("2026-09-16", "semimonthly", null)).toEqual({
      start: "2026-09-16",
      end: "2026-09-30",
    });
  });

  it("ends February's second half on the 28th in a common year", () => {
    expect(periodFor("2026-02-20", "semimonthly", null)).toEqual({
      start: "2026-02-16",
      end: "2026-02-28",
    });
  });

  it("ends February's second half on the 29th in a leap year", () => {
    expect(periodFor("2028-02-20", "semimonthly", null)).toEqual({
      start: "2028-02-16",
      end: "2028-02-29",
    });
  });

  it("ends a 31-day month's second half on the 31st", () => {
    expect(periodFor("2026-08-31", "semimonthly", null)).toEqual({
      start: "2026-08-16",
      end: "2026-08-31",
    });
  });
});

describe("periodFor · semimonthly with an anchor", () => {
  it("splits a 5/20 month into 5-19 and 20-4", () => {
    expect(periodFor("2026-09-10", "semimonthly", 5)).toEqual({ start: "2026-09-05", end: "2026-09-19" });
    expect(periodFor("2026-09-25", "semimonthly", 5)).toEqual({ start: "2026-09-20", end: "2026-10-04" });
  });

  it("puts the days before the first payday in last month's second period", () => {
    expect(periodFor("2026-09-03", "semimonthly", 5)).toEqual({ start: "2026-08-20", end: "2026-09-04" });
  });

  it("wraps across the year", () => {
    expect(periodFor("2027-01-02", "semimonthly", 5)).toEqual({ start: "2026-12-20", end: "2027-01-04" });
  });

  it("clamps a 15/30 split to February's last day", () => {
    expect(periodFor("2026-02-20", "semimonthly", 15)).toEqual({ start: "2026-02-15", end: "2026-02-27" });
    expect(periodFor("2026-02-28", "semimonthly", 15)).toEqual({ start: "2026-02-28", end: "2026-03-14" });
    expect(periodFor("2026-03-31", "semimonthly", 15)).toEqual({ start: "2026-03-30", end: "2026-04-14" });
  });

  it("treats 1 the same as no anchor", () => {
    expect(periodFor("2026-09-20", "semimonthly", 1)).toEqual(periodFor("2026-09-20", "semimonthly", null));
  });

  it("falls back to the 1st for an anchor past 15", () => {
    expect(periodFor("2026-09-20", "semimonthly", 20)).toEqual({ start: "2026-09-16", end: "2026-09-30" });
  });

  it("steps period to period with no gaps or overlaps", () => {
    let p = periodFor("2026-01-01", "semimonthly", 12);
    for (let i = 0; i < 30; i++) {
      const next = shiftPeriod(p, "semimonthly", 12, 1);
      expect(next.start).toBe(addDays(p.end, 1));
      expect(shiftPeriod(next, "semimonthly", 12, -1)).toEqual(p);
      p = next;
    }
  });
});

describe("periodFor · monthly", () => {
  it("is the calendar month when anchored on the 1st", () => {
    expect(periodFor("2026-09-08", "monthly", 1)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("treats a null anchor as the 1st", () => {
    expect(periodFor("2026-09-08", "monthly", null)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("spans two calendar months when anchored mid-month", () => {
    expect(periodFor("2026-09-08", "monthly", 25)).toEqual({
      start: "2026-08-25",
      end: "2026-09-24",
    });
  });

  it("clamps a 31st anchor to the last day of a 30-day month", () => {
    // September has no 31st: the period starts on the 30th and runs to the
    // day before October's 31st.
    expect(periodFor("2026-09-30", "monthly", 31)).toEqual({
      start: "2026-09-30",
      end: "2026-10-30",
    });
  });
});

describe("periodFor · weekly", () => {
  it("starts on the anchored ISO weekday", () => {
    // 2026-09-08 is a Tuesday (ISO 2). Anchored to Monday (ISO 1).
    expect(periodFor("2026-09-08", "weekly", 1)).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("returns the current week when the date is the anchor day itself", () => {
    expect(periodFor("2026-09-07", "weekly", 1)).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("crosses a month boundary without special-casing it", () => {
    expect(periodFor("2026-10-01", "weekly", 1)).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
  });

  it("crosses a year boundary without special-casing it", () => {
    expect(periodFor("2027-01-01", "weekly", 1)).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });
});

describe("nextPayday", () => {
  it("is the day after the period ends", () => {
    expect(nextPayday("2026-09-08", "semimonthly", null)).toBe("2026-09-16");
  });

  it("rolls into the next month from the second half", () => {
    expect(nextPayday("2026-09-20", "semimonthly", null)).toBe("2026-10-01");
  });

  it("rolls into the next year from December", () => {
    expect(nextPayday("2026-12-20", "semimonthly", null)).toBe("2027-01-01");
  });
});

describe("shiftPeriod", () => {
  it("round-trips ±1 for semimonthly across a month boundary", () => {
    const p = periodFor("2026-09-08", "semimonthly", null);
    const back = shiftPeriod(p, "semimonthly", null, -1);
    expect(back).toEqual({ start: "2026-08-16", end: "2026-08-31" });
    expect(shiftPeriod(back, "semimonthly", null, 1)).toEqual(p);
  });

  it("round-trips ±1 for monthly", () => {
    const p = periodFor("2026-09-08", "monthly", 1);
    const back = shiftPeriod(p, "monthly", 1, -1);
    expect(back).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(shiftPeriod(back, "monthly", 1, 1)).toEqual(p);
  });

  it("round-trips ±1 for weekly across a year boundary", () => {
    const p = periodFor("2027-01-01", "weekly", 1);
    const back = shiftPeriod(p, "weekly", 1, -1);
    expect(back).toEqual({ start: "2026-12-21", end: "2026-12-27" });
    expect(shiftPeriod(back, "weekly", 1, 1)).toEqual(p);
  });
});

describe("isWholeMonth", () => {
  it("is true for a calendar month", () => {
    expect(isWholeMonth({ start: "2026-09-01", end: "2026-09-30" })).toBe(true);
  });

  it("is false for a quincena", () => {
    expect(isWholeMonth({ start: "2026-09-01", end: "2026-09-15" })).toBe(false);
  });

  it("is false for a period that spans two months", () => {
    expect(isWholeMonth({ start: "2026-08-25", end: "2026-09-24" })).toBe(false);
  });
});

describe("localDate", () => {
  it("zero-pads single-digit months and days", () => {
    expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("returns the given calendar date for a Date built from local midnight, unlike toISOString at a positive UTC offset", () => {
    // 2026-09-08 local midnight: at any positive UTC offset,
    // `d.toISOString().slice(0, 10)` would roll back to 2026-09-07 because
    // toISOString renders in UTC. localDate must read the local getters and
    // return the same date the constructor was given.
    const d = new Date(2026, 8, 8, 0, 0, 0);
    expect(localDate(d)).toBe("2026-09-08");
  });

  it("does not zero-pad past two digits, for a double-digit month and day", () => {
    expect(localDate(new Date(2026, 11, 25))).toBe("2026-12-25");
  });
});
