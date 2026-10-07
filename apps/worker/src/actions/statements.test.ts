import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("#/lib/statements/llm/extract", () => ({
  extractWithLLM: vi.fn(),
  toParsedStatement: vi.fn(),
}));
vi.mock("#/lib/supabase/server", () => ({ createClient: vi.fn() }));
// Only the network call is stubbed; baseRate and friends are pure and stay real.
vi.mock("#/lib/fx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/lib/fx")>()),
  getExchangeRates: vi.fn(async () => ({})),
}));
// `unstable_cache` has to be here even though nothing in this file caches:
// lib/fx.ts calls it at module scope, so leaving it off the mock made the whole
// FILE fail to collect — which reads as one failing file rather than a failing
// test and is easy to miss in a summary line. The stub returns the function
// unchanged; fx's only network call is mocked separately just above.
vi.mock("#/i18n", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("#/lib/accounts/card-group", () => ({
  addCardLines: vi.fn(async () => ({ groupId: "grp-new", ids: new Map([["CUOTAS", "acc-cuotas"]]) })),
}));
// The plan's monthly allowance: granted unless a test spends it.
vi.mock("#/lib/plan", () => ({ takeQuota: vi.fn(async () => true) }));

import { extractWithLLM, toParsedStatement } from "#/lib/statements/llm/extract";
import { createClient } from "#/lib/supabase/server";
import { takeQuota } from "#/lib/plan";
import { addCardLines } from "#/lib/accounts/card-group";
import { confirmStatementImport, listImportTargets, parseStatement } from "./statements";
import { MAX_STATEMENT_TEXT_CHARS } from "@cigua/core/statements/limits";
import {
  resetStatementParseRateLimit,
  STATEMENT_PARSE_MAX_PER_WINDOW,
  takeStatementParseToken,
} from "#/lib/statements/rate-limit";
import { collapseImportTargets } from "@cigua/core/statements/import-targets";
import type { ParsedStatement } from "@cigua/core/statements/types";

/** Minimal fake Supabase query builder: chainable select/eq/order, terminal
 *  single/maybeSingle, and awaitable directly (bare `await supabase.from(...).select(...)`
 *  with no terminal call) via `.then`. `extra` lets a table also expose e.g. `upsert`. */
function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.order = vi.fn(() => obj);
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

/** `accountOverrides` lets a test put the account row in a different state
 *  (e.g. already-populated backfill columns) while every other table keeps
 *  the shared stub — narrower than swapping out `stub.from` wholesale, which
 *  silently breaks unrelated tables like `categories` and short-circuits the
 *  function before the code under test ever runs. */
function makeSupabaseStub(
  accountOverrides: Partial<{
    credit_limit: number | null;
    statement_closing_day: number | null;
    payment_due_day: number | null;
  }> = {},
) {
  const account = {
    id: "acc-1",
    name: "Test Card",
    currency: "DOP",
    credit_limit: null,
    statement_closing_day: null,
    payment_due_day: null,
    card_group_id: null,
    card_line: "DOP",
    type: "credit_card",
    ...accountOverrides,
  };
  const accountUpdate = vi.fn(() => chainable({ error: null }));
  const importInsert = vi.fn(async () => ({ error: null }));
  const byTable: Record<string, () => unknown> = {
    accounts: () => chainable({ data: account }, { update: accountUpdate }),
    categories: () => chainable({ data: [{ id: "cat-other", name: "Other" }] }),
    category_rules: () => chainable({ data: [] }),
    profiles: () => chainable({ data: { base_currency: "DOP" } }),
    statement_imports: () => chainable({ error: null }, { insert: importInsert }),
  };
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => (byTable[table] ?? (() => chainable({ data: null })))()),
    rpc: vi.fn(async () => ({ error: null })),
    accountUpdate,
    importInsert,
  };
}

const PARSED: ParsedStatement = {
  parserId: "visa_1234_dop",
  cardLast4: "1234",
  sections: [
    {
      sectionKey: "DOP",
      currency: "DOP",
      periodStart: "2026-05-26",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalanceCents: 100000,
      totalDebitsCents: 50000,
      totalCreditsCents: 0,
      closingBalanceCents: 150000,
      balanceToPayCents: 150000,
      minimumPaymentCents: 15000,
      overdueAmountCents: null,
      overdueInstallments: null,
      creditLimitCents: 1000000,
      availableCreditCents: 850000,
      interestRateAnnual: 40,
      avgDailyBalanceCents: 120000,
      avgDailyBalancePriorCents: null,
      costOfCarryCents: 4000,
      costOfCarryPriorCents: null,
      cashbackCents: 32800,
      lines: [
        {
          lineNo: 1,
          madeOn: "2026-06-01",
          postedOn: "2026-06-01",
          reference: null,
          description: "MERCADO UNO",
          mcc: "5411",
          authCode: null,
          amountCents: 50000,
          kind: "purchase",
          suggestedCategory: "Groceries",
        },
      ],
    },
  ],
};

function buildConfirmFormData() {
  const fd = new FormData();
  fd.set("account_id", "acc-1");
  fd.set("file_name", "statement.pdf");
  fd.set("parsed_statement", JSON.stringify(PARSED));
  return fd;
}

describe("confirmStatementImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as Mock).mockResolvedValue(makeSupabaseStub());
  });

  it("does not call the LLM again given a valid parsed_statement payload", async () => {
    const result = await confirmStatementImport(buildConfirmFormData());
    expect(result.error).toBeUndefined();
    expect(extractWithLLM).not.toHaveBeenCalled();
  });

  it("sends the section's cashback to the import RPC as a decimal string", async () => {
    const supabase = makeSupabaseStub();
    (createClient as unknown as Mock).mockResolvedValue(supabase);
    await confirmStatementImport(buildConfirmFormData());
    const [fn, args] = supabase.rpc.mock.calls[0] as unknown as [string, { p: { sections: unknown[] } }];
    expect(fn).toBe("import_card_statement");
    expect(args.p.sections[0]).toMatchObject({ cashback_total: "328.00" });
  });

  it("sends an empty string when the statement reported no cashback", async () => {
    // "" and not "0.00": the RPC nullifs it, which is what keeps "never
    // reported" distinct from a statement that printed a zero.
    const supabase = makeSupabaseStub();
    (createClient as unknown as Mock).mockResolvedValue(supabase);
    const fd = buildConfirmFormData();
    fd.set(
      "parsed_statement",
      JSON.stringify({
        ...PARSED,
        sections: [{ ...PARSED.sections[0], cashbackCents: null }],
      }),
    );
    await confirmStatementImport(fd);
    const [, args] = supabase.rpc.mock.calls[0] as unknown as [string, { p: { sections: unknown[] } }];
    expect(args.p.sections[0]).toMatchObject({ cashback_total: "" });
  });

  it("backfills closing day, due day and limit from the statement", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(stub.accountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        statement_closing_day: expect.any(Number),
        payment_due_day: expect.any(Number),
      }),
    );
  });

  it("does not touch a card whose columns are already set", async () => {
    const stub = makeSupabaseStub({
      credit_limit: 100000,
      statement_closing_day: 20,
      payment_due_day: 10,
    });
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(stub.accountUpdate).not.toHaveBeenCalled();
  });

  it("sends an empty category for a line no rule or MCC recognises", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    const [, args] = stub.rpc.mock.calls[0] as unknown as [
      string,
      { p: { sections: { lines: { description: string; category_id: string }[] }[] } },
    ];
    const lines = args.p.sections.flatMap((s) => s.lines);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.category_id).toBe("");
  });

  it("reports how many lines the importer could not identify", async () => {
    const stub = makeSupabaseStub();
    stub.rpc = vi.fn(async () => ({ data: "imp-1", error: null }));
    (createClient as Mock).mockResolvedValue(stub);

    const result = await confirmStatementImport(buildConfirmFormData());

    expect(result.importId).toBe("imp-1");
    expect(result.uncategorized).toBeGreaterThan(0);
  });

  it("routes each section to the card's line of the same kind", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(addCardLines).not.toHaveBeenCalled();
    const [, args] = stub.rpc.mock.calls[0] as unknown as [string, { p: { sections: { account_id: string; section_key: string }[] } }];
    expect(args.p.sections.map((s) => [s.section_key, s.account_id])).toEqual([["DOP", "acc-1"]]);
  });

  it("adds the line a section needs and imports onto it", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);
    const fd = buildConfirmFormData();
    const cuotas = { ...PARSED.sections[0], sectionKey: "CUOTAS" as const };
    fd.set("parsed_statement", JSON.stringify({ ...PARSED, sections: [PARSED.sections[0], cuotas] }));

    const result = await confirmStatementImport(fd);

    expect(result.error).toBeUndefined();
    expect((addCardLines as Mock).mock.calls[0][3]).toEqual(["CUOTAS"]);
    const [, args] = stub.rpc.mock.calls[0] as unknown as [
      string,
      { p: { card_group_id: string; sections: { account_id: string; section_key: string }[] } },
    ];
    expect(args.p.card_group_id).toBe("grp-new");
    expect(args.p.sections.map((s) => [s.section_key, s.account_id])).toEqual([
      ["DOP", "acc-1"],
      ["CUOTAS", "acc-cuotas"],
    ]);
  });

  it("refuses a payload with a section on no known line, or two on one", async () => {
    for (const sections of [
      [{ ...PARSED.sections[0], sectionKey: "DOP_CUOTAS" }],
      [PARSED.sections[0], PARSED.sections[0]],
    ]) {
      const fd = buildConfirmFormData();
      fd.set("parsed_statement", JSON.stringify({ ...PARSED, sections }));
      expect((await confirmStatementImport(fd)).error).toBe("invalidUpload");
    }
  });
});

describe("parseStatement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStatementParseRateLimit();
    (createClient as unknown as Mock).mockResolvedValue(makeSupabaseStub());
  });

  const input = (text: string) => ({ text, fileName: "statement.pdf", accountId: "acc-1" });

  it("rejects text past the size limit without calling the model", async () => {
    const result = await parseStatement(input("x".repeat(MAX_STATEMENT_TEXT_CHARS + 1)));
    expect(result.error).toBe("invalidUpload");
    expect(extractWithLLM).not.toHaveBeenCalled();
  });

  it("rejects a malformed body, and empty text", async () => {
    expect((await parseStatement({ fileName: "s.pdf", accountId: "acc-1" })).error).toBe("invalidUpload");
    expect((await parseStatement(null)).error).toBe("invalidUpload");
    expect((await parseStatement(input("   "))).error).toBe("invalidUpload");
    expect(extractWithLLM).not.toHaveBeenCalled();
  });

  it("sends text at the limit to the model as the phone scrubbed it", async () => {
    (extractWithLLM as unknown as Mock).mockResolvedValue({ ok: false, reason: "llm_error", detail: "boom" });
    const supabase = makeSupabaseStub();
    (createClient as unknown as Mock).mockResolvedValue(supabase);
    const text = "x".repeat(MAX_STATEMENT_TEXT_CHARS);
    const result = await parseStatement(input(text));
    expect(extractWithLLM).toHaveBeenCalledWith(text);
    expect(result.error).toBe("unsupportedBank");
    // The model's own error is kept on the failed import, not a fixed string.
    expect(supabase.importInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "failed_detection", error: "boom" }));
  });

  it("previews each section on its line, and a line the card lacks as one to add", async () => {
    (extractWithLLM as unknown as Mock).mockResolvedValue({ ok: true, statement: {} });
    const cuotas = { ...PARSED.sections[0], sectionKey: "CUOTAS" as const };
    (toParsedStatement as unknown as Mock).mockReturnValue({ ...PARSED, sections: [PARSED.sections[0], cuotas] });

    const result = await parseStatement(input("statement text"));

    expect(result.preview?.sections.map((s) => [s.sectionKey, s.accountId])).toEqual([
      ["DOP", "acc-1"],
      ["CUOTAS", null],
    ]);
  });

  it("refuses the model call once the plan's monthly imports are used up", async () => {
    (takeQuota as unknown as Mock).mockResolvedValueOnce(false);
    const result = await parseStatement(input("statement text"));
    expect(takeQuota).toHaveBeenCalledWith("statement_parse");
    expect(result.error).toBe("quota_statement_parse");
    expect(extractWithLLM).not.toHaveBeenCalled();
  });

  it("refuses the model call once the person's parse budget is spent", async () => {
    for (let i = 0; i < STATEMENT_PARSE_MAX_PER_WINDOW; i++) {
      takeStatementParseToken("user-1", Date.now());
    }
    const result = await parseStatement(input("15/08  UBER  100.00"));
    expect(result.error).toBe("llmRateLimited");
    expect(extractWithLLM).not.toHaveBeenCalled();
  });
});

describe("listImportTargets", () => {
  const accounts = [
    { id: "acc-1", name: "Visa Infinite · DOP", currency: "DOP", last4: "1234", card_group_id: "grp-1" },
    { id: "acc-2", name: "Visa Infinite · USD", currency: "USD", last4: null, card_group_id: "grp-1" },
    { id: "acc-3", name: "Amex Gold", currency: "DOP", last4: "9876", card_group_id: null },
  ];
  const groups = [{ id: "grp-1", name: "Visa Infinite" }];

  function stubWithCards(
    accountData: unknown,
    user: { id: string } | null = { id: "user-1" },
    groupData: unknown = groups,
  ) {
    const tables: Record<string, Record<string, Mock>> = {
      accounts: chainable({ data: accountData }) as Record<string, Mock>,
      card_groups: chainable({ data: groupData }) as Record<string, Mock>,
    };
    return {
      auth: { getUser: vi.fn(async () => ({ data: { user } })) },
      from: vi.fn((table: string) => tables[table] ?? chainable({ data: null })),
      tables,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user's unarchived credit cards in sort order, with their group", async () => {
    const stub = stubWithCards(accounts);
    (createClient as unknown as Mock).mockResolvedValue(stub);

    await expect(listImportTargets()).resolves.toEqual([
      {
        id: "acc-1",
        name: "Visa Infinite · DOP",
        currency: "DOP",
        last4: "1234",
        cardGroupId: "grp-1",
        groupName: "Visa Infinite",
      },
      {
        id: "acc-2",
        name: "Visa Infinite · USD",
        currency: "USD",
        last4: null,
        cardGroupId: "grp-1",
        groupName: "Visa Infinite",
      },
      {
        id: "acc-3",
        name: "Amex Gold",
        currency: "DOP",
        last4: "9876",
        cardGroupId: null,
        groupName: null,
      },
    ]);

    expect(stub.from).toHaveBeenCalledWith("accounts");
    expect(stub.tables.accounts.select).toHaveBeenCalledWith(
      "id,name,currency,last4,card_group_id",
    );
    // Checking-account rows and archived cards would both render as targets the
    // import can't actually land on.
    expect(stub.tables.accounts.eq).toHaveBeenCalledWith("type", "credit_card");
    expect(stub.tables.accounts.eq).toHaveBeenCalledWith("is_archived", false);
    expect(stub.tables.accounts.order).toHaveBeenCalledWith("sort_order");
  });

  it("collapses a card group's lines into one pickable card", async () => {
    (createClient as unknown as Mock).mockResolvedValue(stubWithCards(accounts));

    const rows = collapseImportTargets(await listImportTargets());

    // Two lines of one physical Visa plus a standalone Amex: two cards, not three.
    expect(rows).toEqual([
      { accountId: "acc-1", label: "Visa Infinite", currency: null, last4: "1234" },
      { accountId: "acc-3", label: "Amex Gold", currency: "DOP", last4: "9876" },
    ]);
  });

  it("leaves a grouped card's name null when the group row is missing", async () => {
    (createClient as unknown as Mock).mockResolvedValue(stubWithCards(accounts, { id: "user-1" }, []));
    const targets = await listImportTargets();
    expect(targets[0].groupName).toBeNull();
    // Still one row: the grouping is the card_group_id, not the name.
    expect(collapseImportTargets(targets)).toHaveLength(2);
  });

  it("returns an empty list, not null, when the query comes back with nothing", async () => {
    (createClient as unknown as Mock).mockResolvedValue(stubWithCards(null));
    await expect(listImportTargets()).resolves.toEqual([]);
  });

  it("never touches the accounts table when nobody is signed in", async () => {
    const stub = stubWithCards(accounts, null);
    (createClient as unknown as Mock).mockResolvedValue(stub);

    await expect(listImportTargets()).resolves.toEqual([]);
    // The point of the guard: it short-circuits before the query, so an
    // unauthenticated caller can't lean on RLS to do the filtering.
    expect(stub.from).not.toHaveBeenCalled();
  });
});
