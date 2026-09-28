import type { ParsedLine, ParsedStatement } from "@cigua/core/statements/types";

export interface ChecksumFailure {
  sectionKey: string;
  computedCents: number;
  statedCents: number;
}

/** Whether a printed line actually moved the balance. The one carve-out is
 *  `adjustment`; see validateChecksums below for what that is and why. */
export function movesBalance(l: ParsedLine): boolean {
  return l.kind !== "adjustment";
}

/** previous + Σ(lines that moved the balance) must equal the closing balance.
 *  Line-less sections (e.g. Cuotas) fall back to the stated totals.
 *
 *  Payments count; `adjustment` lines do not. An adjustment is a row the
 *  statement prints without applying it to its own closing balance — Banco
 *  Santa Cruz's CREDITO POR PAGO TOTAL reverses the financing interest it
 *  charges you when you pay in full, and since that interest was never inside
 *  the previous balance, neither is its reversal. It IS counted in the bank's
 *  printed credit-column total, which is why the extraction can be faithful to
 *  the last cent and still fail this check: on the statement that prompted
 *  this, both currency sections were off by exactly their own adjustment line
 *  (1,140.08 DOP and 0.07 USD). Summing it here would import a credit the
 *  cardholder never received.
 */
export function validateChecksums(parsed: ParsedStatement): ChecksumFailure[] {
  const failures: ChecksumFailure[] = [];
  for (const s of parsed.sections) {
    const movement =
      s.lines.length > 0
        ? s.lines.filter(movesBalance).reduce((sum, l) => sum + l.amountCents, 0)
        : s.totalDebitsCents - s.totalCreditsCents;
    const computed = s.previousBalanceCents + movement;
    if (computed !== s.closingBalanceCents) {
      failures.push({
        sectionKey: s.sectionKey,
        computedCents: computed,
        statedCents: s.closingBalanceCents,
      });
    }
  }
  return failures;
}
