import { describe, it, expect } from "vitest";
import {
  joinBudgetGroupRows,
  newestPendingImport,
  type BudgetGroupUsageRow,
  type PendingTriageImportRow,
} from "./queries";

function row(imp: { id: string; created_at: string } | null): PendingTriageImportRow {
  return { statement_line: { statement: { import: imp } } };
}

describe("newestPendingImport", () => {
  it("returns null for an empty input", () => {
    expect(newestPendingImport([])).toBeNull();
  });

  it("picks the import with the latest created_at among several", () => {
    const rows = [
      row({ id: "old", created_at: "2026-01-01T00:00:00Z" }),
      row({ id: "newest", created_at: "2026-08-01T00:00:00Z" }),
      row({ id: "middle", created_at: "2026-05-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("newest");
  });

  it("skips a row whose embedded chain is missing the import, rather than throwing", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: { statement: { import: null } } },
      row({ id: "the-one", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("the-one");
  });

  it("skips a row whose embedded chain is missing the statement, rather than throwing", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: { statement: null } },
      row({ id: "the-one", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("the-one");
  });

  it("skips a row whose embedded chain is missing the statement line, rather than throwing", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: null },
      row({ id: "the-one", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("the-one");
  });

  it("returns null when every row's chain is incomplete", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: null },
      { statement_line: { statement: null } },
      { statement_line: { statement: { import: null } } },
    ];
    expect(newestPendingImport(rows)).toBeNull();
  });
});

describe("joinBudgetGroupRows", () => {
  const essentials = { id: "g1", name: "Essentials", emoji: "🏠", color: "#123456" };
  const usage = (over: Partial<BudgetGroupUsageRow> = {}): BudgetGroupUsageRow => ({
    budget_group_id: "g1",
    budget_monthly: 1000,
    budget: 500,
    used: 340,
    remaining: 160,
    status: "within",
    ...over,
  });

  it("returns no rows for a user with no groups", () => {
    expect(joinBudgetGroupRows([], [])).toEqual([]);
  });

  // The RPC owns proration and status; the join must not recompute either, or
  // the group band grows a second copy of rules that live in SQL.
  it("takes every figure from the RPC as given, status included", () => {
    const rows = joinBudgetGroupRows([essentials], [usage({ status: "approaching" })]);
    expect(rows).toEqual([
      {
        budget_group_id: "g1",
        name: "Essentials",
        emoji: "🏠",
        color: "#123456",
        budget: 500,
        budget_monthly: 1000,
        used: 340,
        remaining: 160,
        status: "approaching",
      },
    ]);
  });

  it("keeps the prorated budget apart from the stored monthly one", () => {
    const [row] = joinBudgetGroupRows([essentials], [usage({ budget_monthly: 3000, budget: 1500 })]);
    expect(row.budget).toBe(1500);
    expect(row.budget_monthly).toBe(3000);
  });

  it("renders a group the RPC did not return as an empty row rather than dropping it", () => {
    const [row] = joinBudgetGroupRows([essentials], []);
    expect(row).toMatchObject({ budget: 0, budget_monthly: 0, used: 0, remaining: 0, status: "within" });
  });

  it("ignores usage for groups that are not in the list", () => {
    expect(joinBudgetGroupRows([essentials], [usage({ budget_group_id: "g2" })])[0].used).toBe(0);
  });

  // Money is numeric in Postgres and arrives as a string.
  it("coerces string money", () => {
    const [row] = joinBudgetGroupRows(
      [essentials],
      [usage({ used: "10.50" as unknown as number, budget: "4.50" as unknown as number })],
    );
    expect(row.used).toBe(10.5);
    expect(row.budget).toBe(4.5);
  });

  it("preserves the order the group list arrives in", () => {
    const rows = joinBudgetGroupRows(
      [essentials, { id: "g2", name: "Lifestyle", emoji: null, color: null }],
      [usage({ budget_group_id: "g2" }), usage()],
    );
    expect(rows.map((r) => r.name)).toEqual(["Essentials", "Lifestyle"]);
  });
});
