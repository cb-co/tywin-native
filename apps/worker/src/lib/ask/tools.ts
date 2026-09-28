import { z } from "zod";
import { env } from "#/env";
import { tool } from "ai";
import { createClient } from "#/lib/supabase/server";
import { guardSql } from "./guard";

/**
 * Seven steps: six queries and the answer.
 *
 * The last step is not a query — it is the turn the model needs to WRITE the
 * answer once it has rows. The budget must be one larger than the query budget
 * the prompt states, or a question that uses every query ends on a tool result
 * with no prose after it.
 *
 * Six because the observed failure was never one bad query, it was a model
 * exploring: one call to find an account, one to see what a column holds, one
 * refused for asking two things at once, and the answer's turn already gone.
 * Widening alone does not fix that — see `callBudget`, which tells the model
 * what it is spending — but a ceiling low enough to cut off a reasonable line of
 * enquiry turns a slow answer into no answer.
 */
export const CHAT_MAX_STEPS = 7;

/** Queries, as distinct from steps: the last step writes the answer. */
export const MAX_QUERIES = CHAT_MAX_STEPS - 1;

/**
 * What the model is told about its remaining budget, with every result.
 *
 * The loop's hardest failure to diagnose is a transcript that simply stops: the
 * model is mid-plan, the step budget runs out, and the page renders "I ran out
 * of tries". It reads like a bug and it is not one — it is a model spending a
 * budget it was never shown. `stopWhen` is invisible from inside the
 * conversation, and a rule in the system prompt ("you get six") is a number the
 * model has to track itself across turns, which is exactly the kind of
 * bookkeeping it is worst at.
 *
 * So the count rides along with the rows, where it cannot be lost, and the last
 * one is an instruction rather than a number. Cheap: two fields on a result the
 * model is already reading.
 */
export function callBudget(used: number): { calls_left: number; note?: string } {
  const left = Math.max(0, MAX_QUERIES - used);

  if (left === 0) {
    return {
      calls_left: 0,
      note: "That was your last query. Answer now, from the rows you already have. If they cannot answer the question, say what is missing instead of asking again.",
    };
  }

  if (left === 1) {
    return {
      calls_left: 1,
      note: "One query left. Make it the one that answers the question, then write the answer.",
    };
  }

  return { calls_left: left };
}

/**
 * How much query result may go back to the model, in bytes of JSON.
 *
 * `ask_query` caps rows, which is the wrong unit for the thing that actually
 * breaks: 500 rows of a 30-column view is well over a hundred thousand tokens.
 * That does not merely cost money, it spends the 15s budget on transferring a
 * table nobody asked for, and it pushes the schema document out of the model's
 * attention on the step where it matters most.
 *
 * Bytes, then, and generously below the model's window: an answer about money
 * is a handful of aggregate rows. Anything larger means the model should have
 * aggregated in SQL, and `truncated` is what tells it so.
 */
const MAX_RESULT_BYTES = 48_000;

/** Row counts to fall back through, largest first. */
const ROW_LADDER = [200, 100, 50, 20, 10, 5, 1];

/**
 * Trims a result to fit MAX_RESULT_BYTES, reporting that it did.
 *
 * Fails toward the smallest ladder rung rather than toward an error: one row of
 * a wide view still tells the model what shape it asked for and lets it narrow
 * the next query, where an error tells it nothing.
 */
export function capResult(data: unknown): unknown {
  if (data === null || typeof data !== "object" || !("rows" in data)) return data;

  const result = data as { rows: unknown[]; truncated?: boolean };
  const rows = Array.isArray(result.rows) ? result.rows : [];
  if (JSON.stringify(rows).length <= MAX_RESULT_BYTES) return data;

  for (const n of ROW_LADDER) {
    const kept = rows.slice(0, n);
    if (JSON.stringify(kept).length <= MAX_RESULT_BYTES) {
      return { rows: kept, truncated: true };
    }
  }

  return { rows: [], truncated: true };
}

/**
 * The model's one tool.
 *
 * `purpose` is required and is not a debug field. It is the copy the loading
 * state renders while the query runs, which is what keeps a 15s ceiling from
 * reading as a stall — and asking for it demonstrably sharpens the SQL that
 * comes with it.
 *
 * Errors are returned, never thrown. For free-form SQL that is essential
 * rather than defensive: first attempts get a column name wrong, and
 * self-correction on the next step is the difference between "I could not
 * answer that" and a right answer a second later.
 */
export function askTools() {
  /* Per request, because `askTools()` is called once per question. A module-level
     counter would leak one person's budget into the next person's question. */
  let used = 0;

  return {
    askQuery: tool({
      description:
        "Run one read-only SQL SELECT against the q_ views and return the rows.",
      inputSchema: z.object({
        sql: z
          .string()
          .describe(
            "ONE SELECT statement. No semicolons, no writes. To answer two things at once, combine them with UNION ALL or a CTE — never two statements.",
          ),
        purpose: z
          .string()
          .describe(
            "One short line, in the user's language, saying what this query is for. Shown to them while it runs.",
          ),
      }),
      execute: async ({ sql, purpose }) => {
        /* Counts refusals too. A rejected statement costs a step whether or not
           it reached the database, and hiding that from the model is how it
           runs out mid-plan. */
        const budget = callBudget(++used);

        const guarded = guardSql(sql);
        if (!guarded.ok) {
          trace(purpose, `REJECTED ${guarded.reason}`, sql);
          return { error: guarded.reason, ...budget };
        }

        const supabase = await createClient();
        const { data, error } = await supabase.rpc("ask_query", { p_sql: guarded.sql });

        if (error) {
          trace(purpose, `FAILED ${error.message}`, guarded.sql);
          return { error: error.message, ...budget };
        }

        trace(purpose, "ok", guarded.sql);
        const capped = capResult(data);
        return typeof capped === "object" && capped !== null
          ? { ...capped, ...budget }
          : capped;
      },
    }),
  };
}

/**
 * What the model asked for, in the dev server's terminal.
 *
 * The schema document is the highest-churn artifact in this feature and every
 * wrong answer's fix is a sentence in it — but you cannot fix prose you cannot
 * see the effect of. Without this, a bad answer is indistinguishable from a
 * rejected query, a Postgres error the model recovered from, and the model
 * simply reasoning badly over correct rows.
 *
 * Off unless ASK_TRACE=1 (local development only): these lines carry the shape
 * of someone's finances, and a log is a place data goes to be forgotten about.
 */
function trace(purpose: string, outcome: string, sql: string): void {
  if (env("ASK_TRACE") !== "1") return;
  console.log(`[ask] ${outcome}\n  purpose: ${purpose}\n  sql: ${sql}`);
}
