import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { dbError } from "#/lib/errors";
import { extractWithLLM, toParsedStatement } from "#/lib/statements/llm/extract";
import { validateChecksums } from "#/lib/statements/validate";
import { centsToDecimal } from "#/lib/statements/money";
import { MAX_STATEMENT_TEXT_CHARS } from "@cigua/core/statements/limits";
import { takeStatementParseToken } from "#/lib/statements/rate-limit";
import { takeQuota } from "#/lib/plan";
import { addCardLines } from "#/lib/accounts/card-group";
import { cardBackfillFromSection } from "#/lib/statements/backfill";
import { resolveCategoryId, type CategoryRuleRow } from "#/lib/statements/categorize";
import { getCreditKinds } from "#/lib/statements/credit-kind-queries";
import type { CreditKind } from "#/lib/statements/credit-kind";
import { baseRate, getExchangeRates } from "#/lib/fx";
import { baseCurrencyOf } from "@cigua/core/profile";
import { isCardLine, type CardLine } from "@cigua/core/accounts/card-lines";
import { becomesTransaction, type LineKind, type ParsedStatement } from "@cigua/core/statements/types";
import type { ImportTarget } from "@cigua/core/statements/import-targets";

export interface SectionPreview {
  sectionKey: CardLine;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  closingBalance: string;
  costOfCarry: string | null;
  /** Lines that become transactions. */
  lineCount: number;
  /** Lines the import records but does not turn into transactions: payments,
   *  and adjustments the statement never applied to its own balance. */
  skippedCount: number;
  creditLimit: string | null;
  /** The card's line this section imports onto, or null when the card has no
   *  such line yet — confirming the import adds it. */
  accountId: string | null;
}
export interface StatementPreviewResult {
  error?: string;
  preview?: {
    parserId: string;
    cardLast4: string | null;
    fileName: string;
    sections: SectionPreview[];
  };
  /** JSON-serialized ParsedStatement. The client echoes this back on Import
   *  (confirmStatementImport) so confirm never re-reads the statement or re-calls
   *  the LLM — see design spec §1. */
  parsedStatement?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type { ImportTarget } from "@cigua/core/statements/import-targets";

/**
 * The cards a statement could be imported onto — one row per card *account*,
 * carrying the card group it belongs to so the caller can collapse a multi-line
 * card back into the one physical card it is (`collapseImportTargets`).
 *
 * An action rather than a prop threaded through every page that offers the
 * import: the dialog asks for this itself when it opens, so Overview, Wallet,
 * Insights and onboarding can each mount it without fetching anything of their
 * own. Archived cards are left out — they are not a place new spending lands.
 *
 * The group names are read separately rather than embedded: `card_groups` holds
 * a handful of rows, and a second tiny select is cheaper to read and to stub
 * than a PostgREST join whose shape leaks into this function's return type.
 */
export async function listImportTargets(): Promise<ImportTarget[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const [{ data: accounts }, { data: groups }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,currency,last4,card_group_id")
      .eq("type", "credit_card")
      .eq("is_archived", false)
      .order("sort_order"),
    supabase.from("card_groups").select("id,name"),
  ]);
  const nameByGroup = new Map((groups ?? []).map((g) => [g.id, g.name]));
  return (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    last4: a.last4,
    cardGroupId: a.card_group_id,
    groupName: a.card_group_id ? (nameByGroup.get(a.card_group_id) ?? null) : null,
  }));
}

const LINE_COLUMNS =
  "id,name,currency,credit_limit,statement_closing_day,payment_due_day,card_group_id,card_line,color,brand,last4";

type CardLineRow = {
  id: string;
  name: string;
  credit_limit: number | null;
  statement_closing_day: number | null;
  payment_due_day: number | null;
};

/** The card a statement is being imported onto, and its lines by `card_line`.
 *  No PDF/LLM work — safe to call on every parse AND every confirm. */
async function loadAccountContext(supabase: Supabase, accountId: string) {
  const t = await getTranslations("Statements");
  const { data: account } = await supabase
    .from("accounts")
    .select(`${LINE_COLUMNS},type`)
    .eq("id", accountId)
    .single();
  if (!account || account.type !== "credit_card") return { error: t("notACard") } as const;

  let rows: Omit<typeof account, "type">[] = [account];
  if (account.card_group_id) {
    const { data: group } = await supabase
      .from("accounts")
      .select(LINE_COLUMNS)
      .eq("card_group_id", account.card_group_id)
      .eq("type", "credit_card")
      .eq("is_archived", false);
    if (group?.length) rows = group;
  }
  const lines = new Map<CardLine, CardLineRow>();
  for (const row of rows) if (isCardLine(row.card_line)) lines.set(row.card_line, row);

  return { account, lines } as const;
}

/** What the app sends to read a statement: the text it pulled out of the PDF on
 *  the phone (the PDF and its password never leave the device), the file's name
 *  for the import record, and the card it belongs to. */
export type StatementTextInput = { text: string; fileName: string; accountId: string };

function statementTextInput(raw: unknown): StatementTextInput | null {
  if (!raw || typeof raw !== "object") return null;
  const { text, fileName, accountId } = raw as Record<string, unknown>;
  if (typeof text !== "string" || typeof fileName !== "string" || typeof accountId !== "string") return null;
  if (!text.trim() || text.length > MAX_STATEMENT_TEXT_CHARS || !accountId) return null;
  return { text, fileName: fileName.slice(0, 255) || "statement.pdf", accountId };
}

/** Expensive half of the old runPipeline: the Gemini call. Only
 *  ever run on parse — see design spec §1: this step used to be a cheap local
 *  regex (detectParser) and confirm re-ran it for free; it's an LLM network call
 *  now, so confirm must not repeat it. */
async function extractAndParse({ text, fileName }: StatementTextInput) {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") } as const;

  // Taken right before the model call. Password prompts happen on the phone
  // and never reach here, so re-tries for a protected statement don't spend it.
  // A refused request still costs nothing and leaves no failed-import row.
  if (!takeStatementParseToken(user.id, Date.now())) {
    return { error: t("llmRateLimited") } as const;
  }
  // The plan's monthly allowance, after the burst limiter so a refused burst
  // spends none of it.
  if (!(await takeQuota("statement_parse"))) {
    return { error: (await getTranslations("Plan"))("quota_statement_parse") } as const;
  }


  // Already scrubbed of personal details on the phone (lib/statements/pdf-text in
  // the app). Not repeated here: scrubbing protects a person's own details from
  // the model, so a client that skipped it would only expose its own, and the
  // scrubber is slow on pathological input that only a forged request can send.
  const llmResult = await extractWithLLM(text);
  if (!llmResult.ok) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: fileName,
      status: "failed_detection",
      error: llmResult.detail,
    });
    const message =
      llmResult.reason === "rate_limited"
        ? t("llmRateLimited")
        : llmResult.reason === "unavailable"
          ? t("llmUnavailable")
          : t("unsupportedBank");
    return { error: message } as const;
  }


  let parsed: ParsedStatement;
  try {
    parsed = toParsedStatement(llmResult.statement);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // Only the reason is logged. The model's output is a person's statement
    // (every merchant, amount and date on it), and production logs are no place
    // for it; reproduce a failure locally with the statement in hand instead.
    console.error("[statements] conversion failed:", detail);
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: fileName,
      status: "failed_detection",
      error: String(e),
    });
    return { error: t("parseFailedDetail", { detail }) } as const;
  }

  const failures = validateChecksums(parsed);
  if (failures.length) {
    const detail = failures
      .map((f) => `${f.sectionKey}: ${centsToDecimal(f.computedCents)} ≠ ${centsToDecimal(f.statedCents)}`)
      .join("; ");
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parsed.parserId,
      file_name: fileName,
      status: "failed_validation",
      error: detail,
    });
    return { error: t("checksumFailed", { detail }) } as const;
  }

  return { supabase, fileName, parsed } as const;
}

export async function parseStatement(raw: unknown): Promise<StatementPreviewResult> {
  const t = await getTranslations("Statements");
  const input = statementTextInput(raw);
  if (!input) return { error: t("invalidUpload") };
  const { accountId } = input;

  const ctx = await extractAndParse(input);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, parsed, fileName } = ctx;

  const accountCtx = await loadAccountContext(supabase, accountId);
  if ("error" in accountCtx) return { error: accountCtx.error };
  const { lines } = accountCtx;

  const sections: SectionPreview[] = parsed.sections.map((s) => {
    return {
      sectionKey: s.sectionKey,
      currency: s.currency,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      dueDate: s.dueDate,
      closingBalance: centsToDecimal(s.closingBalanceCents),
      costOfCarry: s.costOfCarryCents === null ? null : centsToDecimal(s.costOfCarryCents),
      lineCount: s.lines.filter((l) => becomesTransaction(l.kind)).length,
      skippedCount: s.lines.filter((l) => !becomesTransaction(l.kind)).length,
      creditLimit: s.creditLimitCents === null ? null : centsToDecimal(s.creditLimitCents),
      accountId: lines.get(s.sectionKey)?.id ?? null,
    };
  });

  return {
    preview: {
      parserId: parsed.parserId,
      cardLast4: parsed.cardLast4,
      fileName,
      sections,
    },
    parsedStatement: JSON.stringify(parsed),
  };
}

/** Lightweight shape guard for the client-echoed parsed statement — not a new
 *  trust boundary (a caller could already forge arbitrary FormData today), just
 *  protects against a corrupted/stale payload crashing the RPC downstream. */
function parseIncomingStatement(raw: string): ParsedStatement | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as ParsedStatement).parserId !== "string" ||
    !Array.isArray((value as ParsedStatement).sections)
  ) {
    return null;
  }
  // Each section is one of the card's lines, and no line twice: the section key
  // is what routes it.
  const keys = (value as ParsedStatement).sections.map((s) => s?.sectionKey);
  if (!keys.every(isCardLine) || new Set(keys).size !== keys.length) return null;
  return value as ParsedStatement;
}

export async function confirmStatementImport(
  formData: FormData,
): Promise<{ error?: string; importId?: string; uncategorized?: number }> {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };

  const accountId = String(formData.get("account_id") ?? "");
  const fileName = String(formData.get("file_name") ?? "");
  const parsed = parseIncomingStatement(String(formData.get("parsed_statement") ?? ""));
  if (!accountId || !fileName || !parsed) return { error: t("invalidUpload") };
  const excludeFromBudget = formData.get("exclude_from_budget") !== "false";

  // Defense-in-depth against a corrupted/stale client payload — cheap, pure,
  // no re-extraction. See design spec §1.
  const failures = validateChecksums(parsed);
  if (failures.length) {
    return { error: t("checksumFailed", { detail: failures.map((f) => f.sectionKey).join(", ") }) };
  }

  const accountCtx = await loadAccountContext(supabase, accountId);
  if ("error" in accountCtx) return { error: accountCtx.error };
  const { account, lines } = accountCtx;
  let cardGroupId = account.card_group_id;

  /* A section the card has no line for yet brings its line with it: the preview
     said so, and confirming is the go-ahead. */
  const missing = parsed.sections.map((s) => s.sectionKey).filter((line) => !lines.has(line));
  if (missing.length > 0) {
    const tForm = await getTranslations("AccountForm");
    const added = await addCardLines(supabase, user.id, account, missing, tForm("lineInstallments"));
    if ("error" in added) return { error: await dbError(added.error, "confirmStatementImport") };
    cardGroupId = added.groupId;
    for (const [line, id] of added.ids)
      lines.set(line, { id, name: "", credit_limit: null, statement_closing_day: null, payment_due_day: null });
  }
  const lineFor = (s: { sectionKey: CardLine }) => lines.get(s.sectionKey)!;

  // Category resolution inputs.
  const [{ data: cats }, { data: ruleRows }, { data: profile }] = await Promise.all([
    supabase.from("categories").select("id,name"),
    supabase.from("category_rules").select("rule_type,pattern,category_id,priority"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
  ]);
  const categoryIdByName = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const rules = (ruleRows ?? []) as CategoryRuleRow[];
  const baseCurrency = baseCurrencyOf(profile);
  const rates = await getExchangeRates(baseCurrency);

  const payload = {
    parser_id: parsed.parserId,
    card_group_id: cardGroupId ?? "",
    file_name: fileName,
    file_path: "",
    exclude_from_budget: excludeFromBudget,
    sections: parsed.sections.map((s) => {
      const rate = baseRate(s.currency, baseCurrency, rates);
      const fxFallback = s.currency !== baseCurrency && !rates[s.currency];
      return {
        account_id: lineFor(s).id,
        section_key: s.sectionKey,
        period_start: s.periodStart,
        period_end: s.periodEnd,
        due_date: s.dueDate ?? "",
        previous_balance: centsToDecimal(s.previousBalanceCents),
        total_debits: centsToDecimal(s.totalDebitsCents),
        total_credits: centsToDecimal(s.totalCreditsCents),
        statement_balance: centsToDecimal(s.balanceToPayCents),
        total_balance: centsToDecimal(s.closingBalanceCents),
        minimum_payment: s.minimumPaymentCents === null ? "" : centsToDecimal(s.minimumPaymentCents),
        overdue_amount: s.overdueAmountCents === null ? "" : centsToDecimal(s.overdueAmountCents),
        overdue_installments: s.overdueInstallments === null ? "" : String(s.overdueInstallments),
        credit_limit: s.creditLimitCents === null ? "" : centsToDecimal(s.creditLimitCents),
        available_credit: s.availableCreditCents === null ? "" : centsToDecimal(s.availableCreditCents),
        interest_rate_annual: s.interestRateAnnual === null ? "" : String(s.interestRateAnnual),
        avg_daily_balance: s.avgDailyBalanceCents === null ? "" : centsToDecimal(s.avgDailyBalanceCents),
        avg_daily_balance_prior:
          s.avgDailyBalancePriorCents === null ? "" : centsToDecimal(s.avgDailyBalancePriorCents),
        cost_of_carry: s.costOfCarryCents === null ? "" : centsToDecimal(s.costOfCarryCents),
        cost_of_carry_prior:
          s.costOfCarryPriorCents === null ? "" : centsToDecimal(s.costOfCarryPriorCents),
        exchange_rate: String(rate),
        fx_fallback: fxFallback,
        // "" (not "0.00") when the statement reported none — the RPC nullifs it,
        // keeping "never reported" distinct from a reported zero.
        cashback_total: s.cashbackCents === null ? "" : centsToDecimal(s.cashbackCents),
        lines: s.lines.map((l) => ({
          line_no: String(l.lineNo),
          made_on: l.madeOn,
          posted_on: l.postedOn,
          reference: l.reference ?? "",
          description: l.description,
          mcc: l.mcc ?? "",
          auth_code: l.authCode ?? "",
          amount: centsToDecimal(l.amountCents),
          kind: l.kind,
          // "" travels to the RPC as a null category — the line could not be
          // identified and goes to triage. Payment lines never become
          // transactions at all, so they take the same empty value.
          category_id:
            l.kind === "payment" ? "" : resolveCategoryId(l, rules, categoryIdByName) ?? "",
        })),
      };
    }),
  };

  // The RPC has always returned the import id (`returns uuid`); it used to be
  // thrown away. It is the handle the triage screen is keyed on.
  const { data: importId, error } = await supabase.rpc("import_card_statement", { p: payload });
  if (error) return { error: await dbError(error, "importCardStatement") };

  /* What the issuer printed, written back onto the card. A stub created during
     import arrives with no closing day, due day or limit — this is where it stops
     being a stub. Each line is filled from its own section: on a grouped card the
     DOP line may be a sibling, and each line carries its own limit.
     Fills nulls only; see lib/statements/backfill.ts. */
  for (const s of parsed.sections) {
    const target = lineFor(s);
    const patch = cardBackfillFromSection(
      {
        statement_closing_day: target.statement_closing_day ?? null,
        payment_due_day: target.payment_due_day ?? null,
        credit_limit: target.credit_limit,
      },
      { periodEnd: s.periodEnd, dueDate: s.dueDate, creditLimitCents: s.creditLimitCents },
    );
    if (Object.keys(patch).length === 0) continue;
    await supabase.from("accounts").update(patch).eq("id", target.id);
  }

  // Counted from the payload rather than re-read from the database: this is the
  // number of lines the importer could not identify, which is exactly what
  // triage will offer to fix.
  const uncategorized = payload.sections.reduce(
    (n, s) => n + s.lines.filter((l) => l.kind !== "payment" && l.category_id === "").length,
    0,
  );
  return { importId: importId ?? undefined, uncategorized };
}

export async function deleteCardStatement(id: string, accountId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("card_statements").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteCardStatement") };
  // Deleting a statement cascades to its lines and then to the expenses they
  // created (card_statement_lines → transactions, both ON DELETE CASCADE).
  return {};
}

export async function saveMerchantRule(pattern: string, categoryId: string): Promise<{ error?: string }> {
  const trimmed = pattern.trim();
  if (!trimmed) return { error: "empty pattern" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("category_rules").upsert(
    { user_id: user.id, rule_type: "merchant", pattern: trimmed, category_id: categoryId, priority: 10 },
    { onConflict: "user_id,rule_type,pattern" },
  );
  if (error) return { error: await dbError(error, "saveMerchantRule") };
  return {};
}

export interface StatementLineDetail {
  id: string;
  lineNo: number;
  madeOn: string;
  description: string;
  mcc: string | null;
  amount: number;
  kind: LineKind;
  /** Set on `credit` lines only. */
  creditKind: CreditKind | null;
}

export async function getStatementLineDetail(statementId: string): Promise<StatementLineDetail[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase
    .from("card_statement_lines")
    .select("id,account_id,line_no,made_on,description,mcc,amount,kind")
    .eq("statement_id", statementId)
    .order("line_no");
  const lines = data ?? [];
  const creditKinds = await getCreditKinds(
    supabase,
    lines.filter((l) => l.kind === "credit"),
  );
  return lines.map((l) => ({
    id: l.id,
    lineNo: l.line_no,
    madeOn: l.made_on,
    description: l.description,
    mcc: l.mcc,
    amount: l.amount,
    kind: l.kind,
    creditKind: creditKinds.get(l.id) ?? null,
  }));
}
