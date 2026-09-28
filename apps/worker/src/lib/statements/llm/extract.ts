import { generateObject, APICallError, RetryError } from "ai";
import { gemini, defaultModelId } from "#/lib/llm/gemini";
import { StatementSchema, type LlmLine, type LlmSection, type LlmStatement } from "./schema";
import { SYSTEM_PROMPT } from "./system-prompt";
import { ddmmyyyyToIso, monthBeforePlusDay } from "../dates";
import { movesBalance } from "../validate";
import type { ParsedLine, ParsedSection, ParsedStatement } from "@cigua/core/statements/types";

export type LlmExtractResult =
  | { ok: true; statement: LlmStatement }
  | { ok: false; reason: "rate_limited" | "llm_error" };

// generateObject retries a retryable failure itself before giving up, then throws
// RetryError wrapping the last underlying error — unwrap it so a rate limit is still
// recognized as one even after the SDK's own retries are exhausted.
export function isRateLimitError(error: unknown): boolean {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(cause) && cause.statusCode === 429;
}

export async function extractWithLLM(text: string): Promise<LlmExtractResult> {
  try {
    const { object } = await generateObject({
      // Moved off Groq: gpt-oss-120b/20b are the only Groq models with native
      // structured-output support, and their free-tier TPM (8k) can't fit a real
      // multi-transaction statement's genuine token needs (~11k+, confirmed against
      // real statements). llama-3.3-70b-versatile has more free-tier headroom (12k TPM)
      // but doesn't support Groq's json_schema response format at all — tried it with
      // structured outputs disabled and it hallucinated duplicate transaction blocks,
      // unsafe for financial data. Gemini supports real schema-constrained output with
      // a free tier that needs no billing account.
      model: gemini(defaultModelId()),
      schema: StatementSchema,
      system: SYSTEM_PROMPT,
      prompt: text,
    });
    return { ok: true, statement: object };
  } catch (e) {
    return { ok: false, reason: isRateLimitError(e) ? "rate_limited" : "llm_error" };
  }
}

/**
 * Decimal money -> integer cents.
 *
 * There is no text to parse any more: the schema types every amount as a
 * number, so the decoder cannot produce "RD$ 255.38" or "N/A" in the first
 * place. All that remains is the float->cents conversion the ledger needs.
 *
 * float64 holds 1234.56 as 1234.5599999999999, so the multiply is followed by a
 * round rather than a truncate — `Math.round(x * 100)` recovers the exact cent
 * for every magnitude a statement can carry (error stays many orders of
 * magnitude below half a cent until ~1e13).
 */
function cents(amount: number): number {
  return Math.round(amount * 100);
}

function centsOrNull(amount: number | null): number | null {
  return amount === null ? null : cents(amount);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The one field the schema still cannot constrain: JSON has no date type, and
 * the pattern keyword is advisory to the decoder. The prompt asks for ISO, and
 * dd/mm/yyyy is the only other form these statements print — repair that, and
 * fail loudly on anything else, because a date lands in the ledger.
 */
function isoDate(raw: string): string {
  return ISO_DATE_RE.test(raw) ? raw : ddmmyyyyToIso(raw);
}

/** For dates that feed nothing but the preview, where an unreadable value is
 *  worth less than the import it would otherwise cancel. */
function isoDateOrNull(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    return isoDate(raw);
  } catch {
    return null;
  }
}

/**
 * Derived, never transcribed.
 *
 * `sectionKey` is persisted in `statement_section_mappings` so that a future
 * import of the same card maps itself with no user input — which only works if
 * the key is byte-identical every time. It used to be a free string the model
 * built to a spec in the prompt, with the caller rewriting it when the model
 * put a currency symbol in; deriving it from two enum fields makes it
 * structurally impossible to vary. Reproduces the keys already saved for
 * existing cards ("DOP", "USD", "DOP_CUOTAS").
 */
function sectionKeyFor(s: LlmSection): string {
  return s.sectionKind === "installments" ? `${s.currency}_CUOTAS` : s.currency;
}

function toLine(l: LlmLine, index: number): ParsedLine {
  return {
    lineNo: index + 1,
    madeOn: isoDate(l.madeOn),
    postedOn: isoDate(l.postedOn),
    reference: l.reference,
    description: l.description,
    mcc: l.mcc,
    authCode: l.authCode,
    amountCents: cents(l.amount),
    kind: l.kind,
    suggestedCategory: l.suggestedCategory,
  };
}

function toSection(s: LlmSection): ParsedSection {
  const lines = s.lines.map(toLine);
  const periodEnd = isoDate(s.periodEnd);
  // Σ over the lines whenever there are lines: the checksum is the point, and a
  // stated total the model mis-transcribed would defeat it. The stated figures
  // are the fallback for a summary-only section, which has nothing to sum.
  //
  // Adjustments are excluded from both totals, because these two figures ARE
  // the movement for a line-less section (the checksum's fallback is
  // totalDebits - totalCredits), and the two paths have to mean the same thing
  // by "moved the balance". The cost is that the stored credit total no longer
  // reproduces the bank's printed credit-column figure on a statement carrying
  // an adjustment; nothing displays or re-derives a balance from it, and an
  // internally consistent number is worth more than that parity.
  const moved = lines.filter(movesBalance);
  const totalDebitsCents =
    lines.length > 0
      ? moved.filter((l) => l.amountCents > 0).reduce((sum, l) => sum + l.amountCents, 0)
      : centsOrNull(s.totalDebits) ?? 0;
  const totalCreditsCents =
    lines.length > 0
      ? moved.filter((l) => l.amountCents < 0).reduce((sum, l) => sum - l.amountCents, 0)
      : centsOrNull(s.totalCredits) ?? 0;

  return {
    sectionKey: sectionKeyFor(s),
    currency: s.currency,
    // Read off the statement when it printed a range; derived from the cutoff
    // date when it printed only that.
    periodStart: isoDateOrNull(s.periodStart) ?? monthBeforePlusDay(periodEnd),
    periodEnd,
    dueDate: isoDateOrNull(s.dueDate),
    previousBalanceCents: cents(s.previousBalance),
    totalDebitsCents,
    totalCreditsCents,
    closingBalanceCents: cents(s.closingBalance),
    // Equals the closing balance when the statement prints no separate figure.
    balanceToPayCents: centsOrNull(s.balanceToPay) ?? cents(s.closingBalance),
    minimumPaymentCents: centsOrNull(s.minimumPayment),
    overdueAmountCents: centsOrNull(s.overdueAmount),
    overdueInstallments: s.overdueInstallments,
    creditLimitCents: centsOrNull(s.creditLimit),
    availableCreditCents: centsOrNull(s.availableCredit),
    interestRateAnnual: s.interestRateAnnual,
    avgDailyBalanceCents: centsOrNull(s.avgDailyBalance),
    avgDailyBalancePriorCents: centsOrNull(s.avgDailyBalancePrior),
    costOfCarryCents: centsOrNull(s.costOfCarry),
    costOfCarryPriorCents: centsOrNull(s.costOfCarryPrior),
    // The magnitude, not the sign: the prompt asks for the minus dropped, but
    // the source lines ARE negative and a model that transcribes -328.00 is
    // reporting the same 328.00 of cashback, not a debt.
    cashbackCents: s.totalCashback === null ? null : Math.abs(cents(s.totalCashback)),
    lines,
  };
}

export function toParsedStatement(statement: LlmStatement): ParsedStatement {
  // Built from the converted sections, not the raw ones: parserId keys the saved
  // section mappings, so it has to be as stable as the currencies it embeds.
  const sections = statement.sections.map(toSection);
  const currencies = [...new Set(sections.map((s) => s.currency))].sort();
  const parserId =
    `${statement.cardNetwork}_${statement.cardLast4 ?? "na"}_${currencies.join("")}`.toLowerCase();
  return {
    parserId,
    cardLast4: statement.cardLast4,
    sections,
  };
}
