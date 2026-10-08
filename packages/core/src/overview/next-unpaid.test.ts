import { describe, expect, it } from "vitest";
import { nextUnpaid, occurrencesAfter, runUpDays, settlesOccurrence } from "./next-unpaid";

const loan = { schedule: { cycle: "monthly" as const, anchorDay: 5 }, amount: 18500 };

describe("runUpDays", () => {
  it("is two-thirds of the cycle", () => {
    expect(runUpDays("monthly")).toBe(20);
    expect(runUpDays("semimonthly")).toBe(10);
    expect(runUpDays("weekly")).toBe(4);
  });
});

describe("nextUnpaid", () => {
  it("is the next due date, in full, when nothing has been logged", () => {
    expect(nextUnpaid({ ...loan, payments: [], today: "2026-10-02" })).toEqual({ date: "2026-10-05", amount: 18500 });
  });

  it("keeps a payment due today on today", () => {
    expect(nextUnpaid({ ...loan, payments: [], today: "2026-10-05" })).toEqual({ date: "2026-10-05", amount: 18500 });
  });

  it("moves on to next month once this month's installment is paid ahead", () => {
    expect(
      nextUnpaid({ ...loan, payments: [{ date: "2026-10-01", amount: 18500 }], today: "2026-10-02" }),
    ).toEqual({ date: "2026-11-05", amount: 18500 });
  });

  it("counts a payment made on the due date itself", () => {
    expect(
      nextUnpaid({ ...loan, payments: [{ date: "2026-10-05", amount: 18500 }], today: "2026-10-05" }),
    ).toEqual({ date: "2026-11-05", amount: 18500 });
  });

  it("leaves the remainder of a partial payment due on the same date", () => {
    expect(
      nextUnpaid({ ...loan, payments: [{ date: "2026-10-01", amount: 10000 }], today: "2026-10-02" }),
    ).toEqual({ date: "2026-10-05", amount: 8500 });
  });

  it("treats a remainder under 1% as paid", () => {
    expect(
      nextUnpaid({ ...loan, payments: [{ date: "2026-10-01", amount: 18400 }], today: "2026-10-02" }),
    ).toEqual({ date: "2026-11-05", amount: 18500 });
  });

  it("does not let a late payment for last month hide this month's", () => {
    // September's installment, paid on the 8th, three days late.
    expect(
      nextUnpaid({ ...loan, payments: [{ date: "2026-09-08", amount: 18500 }], today: "2026-09-20" }),
    ).toEqual({ date: "2026-10-05", amount: 18500 });
  });

  it("does not let last month's installment count toward this one", () => {
    expect(
      nextUnpaid({ ...loan, payments: [{ date: "2026-09-05", amount: 18500 }], today: "2026-09-06" }),
    ).toEqual({ date: "2026-10-05", amount: 18500 });
  });

  it("works for weekly schedules", () => {
    // 2026-10-07 is a Wednesday; weekly anchor 5 falls on Thursday the 8th.
    const weekly = { schedule: { cycle: "weekly" as const, anchorDay: 5 }, amount: 500 };
    expect(nextUnpaid({ ...weekly, payments: [], today: "2026-10-07" })).toEqual({ date: "2026-10-08", amount: 500 });
    expect(nextUnpaid({ ...weekly, payments: [{ date: "2026-10-07", amount: 500 }], today: "2026-10-07" })).toEqual({
      date: "2026-10-15",
      amount: 500,
    });
  });

  it("is null when the schedule has no anchor", () => {
    expect(nextUnpaid({ schedule: { cycle: "monthly", anchorDay: null }, amount: 1, payments: [], today: "2026-10-07" })).toBeNull();
  });
});

describe("occurrencesAfter", () => {
  it("lists the following due dates in full", () => {
    expect(occurrencesAfter({ cycle: "monthly", anchorDay: 5 }, "2026-10-05", 18500, 2)).toEqual([
      { date: "2026-11-05", amount: 18500 },
      { date: "2026-12-05", amount: 18500 },
    ]);
  });
  it("is empty when the schedule has no date to give", () => {
    expect(occurrencesAfter({ cycle: "monthly", anchorDay: null }, "2026-10-05", 1, 2)).toEqual([]);
  });
});

describe("settlesOccurrence", () => {
  it("is true for a charge recorded in the run-up, on the day, or late", () => {
    expect(settlesOccurrence("2026-10-10", "monthly", "2026-10-01")).toBe(true);
    expect(settlesOccurrence("2026-10-10", "monthly", "2026-10-10")).toBe(true);
    expect(settlesOccurrence("2026-10-10", "monthly", "2026-10-12")).toBe(true);
  });
  it("is false for last month's charge, or none", () => {
    expect(settlesOccurrence("2026-10-10", "monthly", "2026-09-10")).toBe(false);
    expect(settlesOccurrence("2026-10-10", "monthly", null)).toBe(false);
  });
});
