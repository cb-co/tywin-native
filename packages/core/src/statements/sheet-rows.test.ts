import { describe, it, expect } from "vitest";
import { sheetRows } from "./sheet-rows";

const line = (lineNo: number, amountCents: number, madeOn = "2026-09-05", kind?: string) => ({
  lineNo, madeOn, postedOn: madeOn, reference: null, description: `LINE ${lineNo}`,
  mcc: null, authCode: null, amountCents, kind: kind ?? (amountCents < 0 ? "credit" : "purchase"), suggestedCategory: null,
});
const stmt = JSON.stringify({
  parserId: "p", cardLast4: "4417",
  sections: [
    { sectionKey: "DOP", currency: "DOP", lines: [line(1, 438210), line(2, -5000, "2026-09-06"), line(3, 100), line(4, 200)] },
    { sectionKey: "USD", currency: "USD", lines: [line(9, 1549)] },
  ],
});

describe("sheetRows", () => {
  it("returns the section's real lines, newest data untouched, limited", () => {
    const { rows, more } = sheetRows(stmt, "DOP", 2);
    expect(rows).toHaveLength(2);
    expect(more).toBe(2);
    expect(rows[0]).toEqual({ key: "DOP-1", date: "05/09", text: "LINE 1", amount: 4382.1, credit: false });
  });

  it("marks a negative line as a credit with a positive magnitude", () => {
    const { rows } = sheetRows(stmt, "DOP", 8);
    expect(rows[1]).toMatchObject({ amount: 50, credit: true, date: "06/09" });
    expect(sheetRows(stmt, "DOP", 8).more).toBe(0);
  });

  it("leaves off lines that never become transactions and counts more from the rest", () => {
    const withPayment = JSON.stringify({
      parserId: "p", cardLast4: "4417",
      sections: [{ sectionKey: "DOP", currency: "DOP", lines: [line(1, 100), line(2, -9000, "2026-09-06", "payment"), line(3, 200), line(4, 300)] }],
    });
    const { rows, more } = sheetRows(withPayment, "DOP", 2);
    expect(rows.map((r) => r.key)).toEqual(["DOP-1", "DOP-3"]);
    expect(more).toBe(1);
  });

  it("does not throw on a line missing its date or description", () => {
    const bad = JSON.stringify({ sections: [{ sectionKey: "DOP", currency: "DOP", lines: [{ lineNo: 1, amountCents: 100, kind: "purchase" }] }] });
    expect(sheetRows(bad, "DOP", 8).rows).toHaveLength(1);
  });

  it("only reads the requested section", () => {
    expect(sheetRows(stmt, "USD", 8).rows.map((r) => r.key)).toEqual(["USD-9"]);
  });

  it("degrades to nothing for null, malformed or unknown input", () => {
    expect(sheetRows(null, "DOP", 8)).toEqual({ rows: [], more: 0 });
    expect(sheetRows("{nope", "DOP", 8)).toEqual({ rows: [], more: 0 });
    expect(sheetRows(stmt, "EUR", 8)).toEqual({ rows: [], more: 0 });
  });
});
