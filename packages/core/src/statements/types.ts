/** `adjustment` is the odd one: a line the statement PRINTS but does not apply
 *  to its own closing balance (see validate.ts). Every other kind moves the
 *  balance by its amount. */
export type LineKind = "purchase" | "fee" | "credit" | "payment" | "adjustment";

/** Kinds the import records as a statement line but never turns into a
 *  transaction. A payment is money arriving at the card rather than spending,
 *  and an adjustment moved no money at all. Mirrored by the `kind not in
 *  (...)` guard in import_card_statement — change both together. */
export const NON_TRANSACTION_KINDS: readonly LineKind[] = ["payment", "adjustment"];

export const becomesTransaction = (kind: LineKind) => !NON_TRANSACTION_KINDS.includes(kind);

export interface ParsedLine {
  lineNo: number;
  madeOn: string;   // ISO date (yyyy-mm-dd) — the date the user made the transaction
  postedOn: string; // ISO date — bank posting date
  reference: string | null;
  description: string;
  mcc: string | null;
  authCode: string | null;
  amountCents: number; // negative = credit
  kind: LineKind;
  suggestedCategory: string | null; // LLM's best-guess category name, non-authoritative
}

export interface ParsedSection {
  sectionKey: string;      // stable per parser: "DOP" | "USD" | "CUOTAS_DOP" | ...
  currency: string;        // ISO 4217
  periodStart: string;     // ISO date
  periodEnd: string;       // ISO date (fecha de corte) — the anchor date
  dueDate: string | null;
  previousBalanceCents: number;
  totalDebitsCents: number;   // Σ positive line amounts, adjustments excluded (or stated total when no lines)
  totalCreditsCents: number;  // Σ |negative| line amounts, adjustments excluded (or stated total)
  closingBalanceCents: number;   // BALANCE TOTAL / BALANCE AL CORTE — the anchor value
  balanceToPayCents: number;     // BALANCE A PAGAR (equals closing when absent)
  minimumPaymentCents: number | null;
  overdueAmountCents: number | null;
  overdueInstallments: number | null;
  creditLimitCents: number | null;
  availableCreditCents: number | null;
  interestRateAnnual: number | null;      // percent, e.g. 40 or 60
  avgDailyBalanceCents: number | null;
  avgDailyBalancePriorCents: number | null;
  costOfCarryCents: number | null;
  costOfCarryPriorCents: number | null;
  /** Cashback/rewards the ISSUER credited for this period, as a positive
   *  magnitude. Null when the statement reports none — distinct from 0, which
   *  means the statement reported a zero. Only a fallback: the card report
   *  prefers the statement's credit lines that lib/statements/credit-kind.ts
   *  classifies as cashback. */
  cashbackCents: number | null;
  lines: ParsedLine[];
}

export interface ParsedStatement {
  parserId: string;
  cardLast4: string | null;
  sections: ParsedSection[];
}
