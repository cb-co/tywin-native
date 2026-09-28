import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { dbError } from "#/lib/errors";
import { extractStatementText } from "#/lib/statements/extract";
import { scrubPii } from "#/lib/statements/llm/scrub-pii";
import { extractWithLLM, toParsedStatement } from "#/lib/statements/llm/extract";
import { validateChecksums } from "#/lib/statements/validate";
import { centsToDecimal } from "#/lib/statements/money";
import { MAX_STATEMENT_BYTES } from "@cigua/core/statements/limits";
import { takeStatementParseToken } from "#/lib/statements/rate-limit";
import { suggestAccountMappings, type CardAccountOption } from "#/lib/statements/mapping";
import { cardBackfillFromSection } from "#/lib/statements/backfill";
import { resolveCategoryId, type CategoryRuleRow } from "#/lib/statements/categorize";
import { getCreditKinds } from "#/lib/statements/credit-kind-queries";
import type { CreditKind } from "#/lib/statements/credit-kind";
import { baseRate, getExchangeRates } from "#/lib/fx";
import { baseCurrencyOf, DEFAULT_BASE_CURRENCY } from "@cigua/core/profile";
import { becomesTransaction, type LineKind, type ParsedStatement } from "@cigua/core/statements/types";
import type { ImportTarget } from "@cigua/core/statements/import-targets";

export interface SectionPreview {
  sectionKey: string;
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
  mappedAccountId: string | null;
  suggestedAccountId: string | null;
}
export interface StatementPreviewResult {
  error?: string;
  needsPassword?: boolean;
  passwordIncorrect?: boolean;
  preview?: {
    parserId: string;
    cardLast4: string | null;
    fileName: string;
    cardGroupId: string | null;
    needsMapping: boolean;
    sections: SectionPreview[];
    accountOptions: { id: string; name: string; currency: string }[];
  };
  /** JSON-serialized ParsedStatement. The client echoes this back on Import
   *  (confirmStatementImport) so confirm never re-extracts the PDF or re-calls
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

export type StubCurrencyOptions = {
  /** The profile's base currency — what a card the user hasn't described yet
   *  is most likely denominated in. */
  baseCurrency: string;
  currencies: { code: string; name: string }[];
};

/**
 * The currency list the stub form offers, plus the currency to preselect.
 *
 * `getCurrencies` (lib/accounts/queries) is server-only and every other form
 * receives the list as a prop from its page. The stub step has no page of its
 * own — it is mounted inside a dialog that itself resolves its target — so it
 * reads the list through an action instead.
 */
export async function listStubCurrencies(): Promise<StubCurrencyOptions> {
  const { supabase, user } = await requireUser();
  if (!user) return { baseCurrency: DEFAULT_BASE_CURRENCY, currencies: [] };
  const [{ data: currencies }, { data: profile }] = await Promise.all([
    supabase.from("currencies").select("code,name").order("code"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
  ]);
  return { baseCurrency: baseCurrencyOf(profile), currencies: currencies ?? [] };
}

/** Cheap half of the old runPipeline: account, card-group siblings, and saved
 *  section mappings for one card account + parser. No PDF/LLM work — safe to
 *  call on every parse AND every confirm. */
async function loadAccountContext(supabase: Supabase, accountId: string, parserId: string) {
  const t = await getTranslations("Statements");
  const { data: account } = await supabase
    .from("accounts")
    .select("id,name,currency,credit_limit,statement_closing_day,payment_due_day,card_group_id,type")
    .eq("id", accountId)
    .single();
  if (!account || account.type !== "credit_card") return { error: t("notACard") } as const;

  let options: CardAccountOption[] = [
    {
      id: account.id,
      name: account.name,
      currency: account.currency,
      credit_limit: account.credit_limit,
      statement_closing_day: account.statement_closing_day,
      payment_due_day: account.payment_due_day,
    },
  ];
  if (account.card_group_id) {
    const { data: group } = await supabase
      .from("accounts")
      .select("id,name,currency,credit_limit,statement_closing_day,payment_due_day")
      .eq("card_group_id", account.card_group_id)
      .eq("type", "credit_card")
      .eq("is_archived", false);
    if (group?.length) options = group;
  }

  const { data: savedRows } = await supabase
    .from("statement_section_mappings")
    .select("section_key,account_id")
    .eq("parser_id", parserId)
    .eq("card_group_id", account.card_group_id ?? "00000000-0000-0000-0000-000000000000");
  const saved = new Map((savedRows ?? []).map((m) => [m.section_key, m.account_id]));

  return { account, options, saved } as const;
}

/** Expensive half of the old runPipeline: PDF extraction, PII scrub, and the
 *  Gemini call. Only ever run on parse — see design spec §1: this step used
 *  to be a cheap local regex (detectParser) and confirm re-ran it for free;
 *  it's an LLM network call now, so confirm must not repeat it. */
async function extractAndParse(formData: FormData) {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") } as const;

  const file = formData.get("file");
  const password = String(formData.get("password") ?? "") || undefined;
  if (!(file instanceof File)) return { error: t("invalidUpload") } as const;
  // Checked before the bytes are read, not after: an oversize upload should
  // cost nothing and leave no failed-import row for an attempt never made. The
  // panel checks the same limit first, so reaching this is a forged request.
  if (file.size > MAX_STATEMENT_BYTES) {
    return { error: t("fileTooLarge", { limit: MAX_STATEMENT_BYTES / (1024 * 1024) }) } as const;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractStatementText(bytes, password);
  if (!extracted.ok) {
    if (extracted.reason === "unreadable") return { error: t("unreadablePdf") } as const;
    if (extracted.reason === "bad_password") return { needsPassword: true, passwordIncorrect: true } as const;
    return { needsPassword: true } as const;
  }

  // Taken only now that the PDF has opened, right before the model call: a
  // password prompt or a wrong password doesn't spend it, so the upload
  // dialog's re-tries for a protected statement don't lock the person out of
  // their own import. A refused request here still costs nothing and leaves
  // no failed-import row.
  if (!takeStatementParseToken(user.id, Date.now())) {
    return { error: t("llmRateLimited") } as const;
  }


  const llmResult = await extractWithLLM(scrubPii(extracted.text));
  if (!llmResult.ok) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: llmResult.reason === "rate_limited" ? "llm rate limited" : "llm extraction failed",
    });
    return { error: llmResult.reason === "rate_limited" ? t("llmRateLimited") : t("unsupportedBank") } as const;
  }


  let parsed: ParsedStatement;
  try {
    parsed = toParsedStatement(llmResult.statement);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // The model's own output is the only thing that explains this failure, and
    // it is different on every run — without it a report of "the statement
    // couldn't be parsed" is unactionable. Server-side log; the JSON dump above
    // has the same payload for local runs.
    console.error("[statements] conversion failed:", detail, JSON.stringify(llmResult.statement));
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
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
      file_name: file.name,
      status: "failed_validation",
      error: detail,
    });
    return { error: t("checksumFailed", { detail }) } as const;
  }

  return { supabase, fileName: file.name, parsed } as const;
}

export async function parseStatement(formData: FormData): Promise<StatementPreviewResult> {
  const t = await getTranslations("Statements");
  const accountId = String(formData.get("account_id") ?? "");
  if (!accountId) return { error: t("invalidUpload") };

  const ctx = await extractAndParse(formData);
  if ("error" in ctx || "needsPassword" in ctx) return ctx as StatementPreviewResult;
  const { supabase, parsed, fileName } = ctx;

  const accountCtx = await loadAccountContext(supabase, accountId, parsed.parserId);
  if ("error" in accountCtx) return { error: accountCtx.error };
  const { account, options, saved } = accountCtx;

  const suggestions = suggestAccountMappings(parsed.sections, saved, options);

  const sections: SectionPreview[] = parsed.sections.map((s) => {
    const mapped =
      saved.get(s.sectionKey) ??
      (parsed.sections.length === 1 && options.length === 1 ? options[0].id : null);
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
      mappedAccountId: mapped,
      suggestedAccountId: mapped ?? suggestions.get(s.sectionKey) ?? null,
    };
  });

  return {
    preview: {
      parserId: parsed.parserId,
      cardLast4: parsed.cardLast4,
      fileName,
      cardGroupId: account.card_group_id,
      needsMapping: sections.some((s) => !s.mappedAccountId),
      sections,
      accountOptions: options.map(({ id, name, currency }) => ({ id, name, currency })),
    },
    parsedStatement: JSON.stringify(parsed),
  };
}

/** Lightweight shape guard for the client-echoed parsed statement — same
 *  spirit as the `mappings` JSON guard below: not a new trust boundary (a
 *  caller could already forge arbitrary FormData today), just protects
 *  against a corrupted/stale payload crashing the RPC downstream. */
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

  const accountCtx = await loadAccountContext(supabase, accountId, parsed.parserId);
  if ("error" in accountCtx) return { error: accountCtx.error };
  const { account, options } = accountCtx;

  let mappings: Record<string, string>;
  try {
    const raw: unknown = JSON.parse(String(formData.get("mappings") ?? "{}"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
    mappings = Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  } catch {
    return { error: t("invalidUpload") };
  }
  const optionById = new Map(options.map((o) => [o.id, o]));

  // Every section must land on a currency-matching card the user owns.
  for (const s of parsed.sections) {
    const target = mappings[s.sectionKey];
    const opt = target ? optionById.get(target) : undefined;
    if (!opt) return { error: t("unmappedSection", { section: s.sectionKey }) };
    if (opt.currency !== s.currency)
      return { error: t("currencyMismatch", { section: s.sectionKey, currency: s.currency }) };
  }

  // Two sections mapped to the same account would each delete-by-(account,
  // period_end) in the RPC, so the second section's import silently destroys
  // the first's — reject the duplicate before it ever reaches the database.
  const mappedIds = parsed.sections.map((s) => mappings[s.sectionKey]);
  if (new Set(mappedIds).size !== mappedIds.length) return { error: t("duplicateMapping") };

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
    card_group_id: account.card_group_id ?? "",
    file_name: fileName,
    file_path: "",
    exclude_from_budget: excludeFromBudget,
    sections: parsed.sections.map((s) => {
      const rate = baseRate(s.currency, baseCurrency, rates);
      const fxFallback = s.currency !== baseCurrency && !rates[s.currency];
      return {
        account_id: mappings[s.sectionKey],
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
     being a stub. Each mapped account is filled from its own section: on a grouped
     card the DOP line may be a sibling, and each line carries its own limit.
     Fills nulls only; see lib/statements/backfill.ts. */
  for (const s of parsed.sections) {
    const target = optionById.get(mappings[s.sectionKey]);
    if (!target) continue;
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

  // Remember confirmed mappings for zero-touch future imports.
  if (account.card_group_id) {
    const cardGroupId = account.card_group_id;
    for (const s of parsed.sections) {
      await supabase.from("statement_section_mappings").upsert(
        {
          user_id: user.id,
          parser_id: parsed.parserId,
          card_group_id: cardGroupId,
          section_key: s.sectionKey,
          account_id: mappings[s.sectionKey],
        },
        { onConflict: "user_id,parser_id,card_group_id,section_key" },
      );
    }
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
