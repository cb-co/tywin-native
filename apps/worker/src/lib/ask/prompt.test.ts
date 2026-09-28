import { describe, expect, it } from "vitest";
import { systemPrompt, renderContext, LANGUAGE } from "./prompt";
import { guardSql } from "./guard";
import { documentedColumns } from "./schema-doc";
import type { AskContext } from "./context";

const ctx = { today: "2026-08-20", baseCurrency: "DOP", language: "English" };

describe("systemPrompt", () => {
  /* A model asked what day it is answers from training data, which silently
     corrupts every "last month" and "this week" question in the product. The
     date is injected for exactly this reason, so its absence is a bug worth a
     test rather than a comment. */
  it("states today's date", () => {
    expect(systemPrompt(ctx)).toContain("2026-08-20");
  });

  it("states the base currency", () => {
    expect(systemPrompt(ctx)).toContain("DOP");
  });

  it("names the language to answer in", () => {
    expect(systemPrompt({ ...ctx, language: "Spanish" })).toContain("Spanish");
  });

  it("carries the schema document", () => {
    expect(systemPrompt(ctx)).toContain("q_transactions");
    expect(systemPrompt(ctx)).toContain("budget_spend");
  });

  it("forbids advice, matching the house rule", () => {
    expect(systemPrompt(ctx)).toMatch(/investment, tax/i);
  });

  /* The rule the model broke in testing: two statements in one call, then a
     wasted step, then no answer. */
  it("states the one-statement rule and how to combine two questions", () => {
    expect(systemPrompt(ctx)).toMatch(/one statement per call/i);
    expect(systemPrompt(ctx)).toMatch(/union all/i);
  });

  it("tells the model its query budget is reported back to it", () => {
    expect(systemPrompt(ctx)).toMatch(/how many are left/i);
  });

  /* The answer in the screenshot that started this: the model was writing
     markdown all along and the bubble rendered it as characters. The renderer is
     fixed, so what the prompt has to guarantee now is that the markdown stays
     inside the subset the renderer styles — anything else arrives unstyled or,
     for a link, dropped. */
  it("names the markdown subset the renderer supports", () => {
    const p = systemPrompt(ctx);
    expect(p).toMatch(/only these: \*\*bold\*\*, bullet lists, numbered lists, and tables/i);
    expect(p).toMatch(/no headings, no links/i);
  });

  /* Sixteen transactions with the amounts in brackets is the shape that was
     unreadable, and it is the shape a model reaches for by default. */
  it("asks for a table rather than amounts inside a sentence", () => {
    expect(systemPrompt(ctx)).toMatch(/is a table, never a sentence with the amounts in brackets/i);
  });

  it("shows the alignment syntax that right-aligns an amount column", () => {
    expect(systemPrompt(ctx)).toContain("| :--- | :--- | ---: |");
  });
});

/**
 * Every example query the prompt shows, pulled straight out of the prompt.
 *
 * The examples exist to make the model's FIRST query land, which they only do if
 * they would actually run. An example the guard refuses teaches the model a
 * shape that costs it a query every time it copies one — the exact failure the
 * examples were added to prevent, dressed as a fix for it.
 */
function exampleQueries(): string[] {
  const block = systemPrompt(ctx).split("Worked examples")[1]?.split("How to answer:")[0] ?? "";
  return [...block.matchAll(/`(select [^`]+)`/gi)].map((m) => m[1]);
}

describe("the worked examples", () => {
  it("are actually there", () => {
    expect(exampleQueries().length).toBeGreaterThanOrEqual(5);
  });

  it.each(exampleQueries())("survives the guard: %s", (sql) => {
    expect(guardSql(sql)).toMatchObject({ ok: true });
  });

  /* The examples are what the model copies, so a BETWEEN in one of them would
     propagate the very bug the Dates section is there to stop. */
  it("never demonstrates BETWEEN on occurred_at", () => {
    for (const sql of exampleQueries()) expect(sql.toLowerCase()).not.toContain("between");
  });

  /* The examples cannot be executed here — there is no database in this suite —
     so the failure they could still hide is a column that got renamed in a
     migration. The drift test in schema-doc.test.ts keeps the DOCUMENT honest
     against the generated types; this keeps the EXAMPLES honest against the
     document, which closes the loop back to the database. */
  it("only names columns the schema document declares", () => {
    const documented = documentedColumns();
    const columns = new Set([...documented.values()].flat());
    const used = [
      "budget_spend", "occurred_at", "category", "description",
      "budget", "used", "remaining", "month",
      "statement_balance", "minimum_payment", "due_date", "available_credit",
      "account_id", "period_end", "id", "name", "brand",
    ];

    expect(used.filter((c) => !columns.has(c))).toEqual([]);
    /* And each one is actually in an example, so this list cannot rot into a
       set of names nothing depends on. */
    const sql = exampleQueries().join(" ");
    expect(used.filter((c) => !sql.includes(c))).toEqual([]);
  });

  it("demonstrates the half-open range on occurred_at", () => {
    expect(exampleQueries().join(" ")).toMatch(/occurred_at >= date '[\d-]+' and occurred_at < date '[\d-]+'/);
  });

  /* The model copies an example's range verbatim, so a date pinned when the
     example was written answers "last month" with whichever month that was.
     Every range comes from today — including across the year boundary. */
  it("dates every range from today", () => {
    const prompt = systemPrompt({ ...ctx, today: "2027-01-15" });
    expect(prompt).toContain("occurred_at >= date '2026-12-01' and occurred_at < date '2027-01-01'");
    expect(prompt).toContain("occurred_at >= date '2026-12-01' and occurred_at < date '2027-02-01'");
    expect(prompt).toContain("occurred_at >= date '2027-01-01'");
    const examples = prompt.split("Dates:")[1]?.split("How to answer:")[0] ?? "";
    expect(examples).not.toMatch(/2026-0[1-9]/);
  });
});

describe("the refusal rules the prompt states", () => {
  /* Each of these is a guardSql check that used to cost the model a query to
     discover. If the guard stops enforcing one, the prompt is lying; if the
     prompt drops one, the query budget pays for it. Both directions are bugs,
     so both are asserted here rather than in guard.test.ts alone. */
  it("warns about double quotes, which the guard refuses", () => {
    expect(systemPrompt(ctx)).toMatch(/no double quotes/i);
    expect(guardSql(`select "id" from q_transactions`).ok).toBe(false);
  });

  it("warns about $, which the guard refuses", () => {
    expect(systemPrompt(ctx)).toMatch(/\$1.*placeholder|no `\$`/i);
    expect(guardSql("select id from q_transactions where amount > $1").ok).toBe(false);
  });

  it("names generate_series as unavailable, because it is", () => {
    expect(systemPrompt(ctx)).toMatch(/generate_series/);
    expect(guardSql("select generate_series(1, 12)").ok).toBe(false);
  });

  it("lists the four views it may read", () => {
    expect(systemPrompt(ctx)).toMatch(/q_transactions, q_accounts, q_card_statements, q_budgets/);
  });
});

describe("the budget anchor", () => {
  /* The prompt used to open with "you get at most 6 queries" and only reach
     "aim for one or two" three bullets later, which anchors the model high. The
     ceiling still has to be stated — callBudget counts down against it — but the
     target is what leads. */
  it("leads with one query, not with the ceiling", () => {
    const work = systemPrompt(ctx).split("How to work:")[1];
    expect(work.indexOf("ONE query")).toBeLessThan(work.indexOf("ceiling is 6"));
  });

  it("still tells the model the budget is reported back to it", () => {
    expect(systemPrompt(ctx)).toMatch(/how many are left/i);
  });
});

const context: AskContext = {
  accounts: [
    { name: "Amex Platinum", type: "credit_card", brand: "amex", last4: "1234", currency: "USD", archived: false },
    { name: "Old Savings", type: "savings", brand: null, last4: null, currency: "DOP", archived: true },
  ],
  categories: ["Dining", "Groceries"],
  budgetGroups: ["Essentials", "Lifestyle"],
  earliest: "2024-03-11",
  latest: "2026-08-25",
  partial: false,
};

describe("renderContext", () => {
  it("names the accounts, their type and their last4", () => {
    const out = renderContext(context);
    expect(out).toContain("Amex Platinum");
    expect(out).toContain("credit_card");
    expect(out).toContain("1234");
  });

  it("marks an archived account as archived", () => {
    expect(renderContext(context)).toMatch(/Old Savings.*archived/);
  });

  it("lists the categories and the range the data covers", () => {
    const out = renderContext(context);
    expect(out).toContain("Dining, Groceries");
    expect(out).toContain("2024-03-11");
    expect(out).toContain("2026-08-25");
  });

  /* Saying "their accounts:" above an empty list is a claim that they have
     none, which is a worse answer than saying nothing and letting the model
     look them up the way it always could. */
  it("renders nothing at all when there is nothing to say", () => {
    expect(renderContext({ accounts: [], categories: [], budgetGroups: [], earliest: null, latest: null, partial: false })).toBe("");
  });

  it("says so when a list was cut", () => {
    expect(renderContext({ ...context, partial: true })).toMatch(/not all of them/i);
  });

  /* The whole point of the second dimension: a flat second list of nouns would
     make the confusion worse, not better. */
  it("says the groups are not categories, and which view each one answers", () => {
    const out = renderContext(context);
    expect(out).toMatch(/NOT categories/);
    expect(out).toContain("q_budget_groups");
  });

  it("omits the groups on a database that has none", () => {
    expect(renderContext({ ...context, budgetGroups: [] })).not.toMatch(/budget groups/i);
  });

  it("reaches the system prompt", () => {
    expect(systemPrompt({ ...ctx, context })).toContain("Amex Platinum");
  });
});

describe("LANGUAGE", () => {
  it("covers both app locales", () => {
    expect(LANGUAGE.en).toBe("English");
    expect(LANGUAGE.es).toBe("Spanish");
  });
});
