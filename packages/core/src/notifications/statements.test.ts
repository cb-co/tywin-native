import { describe, expect, it } from "vitest";
import { pendingClosings } from "./statements";

describe("pendingClosings", () => {
  it("lists the last closing and the next when neither statement is in", () => {
    expect(pendingClosings("2026-10-07", 20, "2026-08-20")).toEqual(["2026-09-20", "2026-10-20"]);
  });
  it("leaves out a closing whose statement was imported", () => {
    expect(pendingClosings("2026-10-07", 20, "2026-09-20")).toEqual(["2026-10-20"]);
  });
  it("counts a statement that closed a few days early", () => {
    expect(pendingClosings("2026-10-07", 20, "2026-09-18")).toEqual(["2026-10-20"]);
  });
  it("treats a closing today as the last one", () => {
    expect(pendingClosings("2026-10-20", 20, "2026-09-20")).toEqual(["2026-10-20", "2026-11-20"]);
  });
  it("clamps to the end of a short month", () => {
    expect(pendingClosings("2026-11-10", 31, null)).toEqual(["2026-10-31", "2026-11-30"]);
  });
  it("wraps the year", () => {
    expect(pendingClosings("2027-01-05", 15, null)).toEqual(["2026-12-15", "2027-01-15"]);
  });
});
