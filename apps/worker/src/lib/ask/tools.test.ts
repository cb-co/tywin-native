import { describe, expect, it } from "vitest";
import { callBudget, capResult, CHAT_MAX_STEPS, MAX_QUERIES } from "./tools";

/** A row wide enough that a few hundred of them are a context problem. */
function wideRow(i: number) {
  return {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    occurred_at: "2026-08-01T00:00:00Z",
    description: "SUPERMERCADO NACIONAL SANTO DOMINGO DN".repeat(3),
    account: "Amex Platinum",
    category: "Groceries",
    base_total_amount: 1234.56,
    notes: "imported from statement, section consumos".repeat(2),
  };
}

describe("capResult", () => {
  it("passes a small result through untouched", () => {
    const data = { rows: [{ total: 8420 }], truncated: false };
    expect(capResult(data)).toBe(data);
  });

  /* The row cap in ask_query is 500. What matters to the model is bytes, and
     500 wide rows is far past anything worth sending back. */
  it("trims a wide result and says that it did", () => {
    const rows = Array.from({ length: 500 }, (_, i) => wideRow(i));
    const capped = capResult({ rows, truncated: false }) as {
      rows: unknown[];
      truncated: boolean;
    };

    expect(capped.truncated).toBe(true);
    expect(capped.rows.length).toBeLessThan(rows.length);
    expect(JSON.stringify(capped.rows).length).toBeLessThanOrEqual(48_000);
  });

  it("keeps as many rows as fit", () => {
    const rows = Array.from({ length: 500 }, (_, i) => wideRow(i));
    const capped = capResult({ rows, truncated: false }) as { rows: unknown[] };
    expect(capped.rows.length).toBeGreaterThan(0);
  });

  it("leaves an error result alone", () => {
    const data = { error: "relation does not exist" };
    expect(capResult(data)).toBe(data);
  });

  it("survives a null result", () => {
    expect(capResult(null)).toBe(null);
  });
});

describe("CHAT_MAX_STEPS", () => {
  /* If the step budget is not larger than the query budget, a question that uses
     every query ends on a tool result with no answer written after it. */
  it("leaves a step for the answer after the queries the prompt allows", () => {
    expect(CHAT_MAX_STEPS).toBe(MAX_QUERIES + 1);
  });
});

/* The loop's hardest failure to diagnose is a transcript that just stops: a
   model mid-plan, cut off by a budget it was never shown, rendering "I ran out
   of tries". These are the fields that make the budget visible from inside the
   conversation. */
describe("callBudget", () => {
  it("counts down from the query budget", () => {
    expect(callBudget(1).calls_left).toBe(MAX_QUERIES - 1);
  });

  it("says nothing extra while there is room", () => {
    expect(callBudget(1).note).toBeUndefined();
  });

  it("warns on the second to last", () => {
    expect(callBudget(MAX_QUERIES - 1).note).toMatch(/one query left/i);
  });

  /* An instruction, not a number: the last result has to say what to do, since
     the model cannot see `stopWhen` and will otherwise plan a seventh query. */
  it("instructs rather than counts on the last", () => {
    const last = callBudget(MAX_QUERIES);
    expect(last.calls_left).toBe(0);
    expect(last.note).toMatch(/answer now/i);
  });

  it("does not go negative if the loop somehow overruns", () => {
    expect(callBudget(MAX_QUERIES + 5).calls_left).toBe(0);
  });
});
