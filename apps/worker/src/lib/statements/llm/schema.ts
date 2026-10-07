import { z } from "zod";
import { CARD_LINES } from "@cigua/core/accounts/card-lines";

/**
 * The schema is the enforcement mechanism, not the prompt.
 *
 * Structured output constrains the decoder: a field typed `number` cannot come
 * back as "RD$ 255.38", and a field typed as an enum cannot come back as "RD$".
 * Both of those were real production failures that a prompt instruction alone
 * did not prevent — the same statement text parsed on one run and threw on the
 * next. Every value that used to arrive as free text and get repaired by
 * hand-written logic downstream is expressed here as a type instead, so the
 * repair code has nothing left to do.
 */

/** A money amount as a plain number — no symbol, no thousands separator, sign
 *  carried by the number itself. Converted to integer cents at the boundary. */
const Amount = z.number().finite();

export const LineSchema = z.object({
  madeOn: z.string(),
  postedOn: z.string(),
  reference: z.string().nullable(),
  description: z.string(),
  mcc: z.string().nullable(),
  authCode: z.string().nullable(),
  amount: Amount,
  kind: z.enum(["purchase", "fee", "credit", "payment", "adjustment"]),
  suggestedCategory: z.string().nullable(),
});

export const SectionSchema = z.object({
  /** Which of the card's three fixed lines the section belongs to. The
   *  currency follows from it (cuotas are pesos), so the model is never asked
   *  for one separately and the two cannot disagree. */
  line: z.enum(CARD_LINES),
  /** Read off the statement when it prints a period range; the caller derives it
   *  from `periodEnd` when the statement only prints a cutoff date. */
  periodStart: z.string().nullable(),
  periodEnd: z.string(),
  dueDate: z.string().nullable(),
  previousBalance: Amount,
  closingBalance: Amount,
  balanceToPay: Amount.nullable(),
  minimumPayment: Amount.nullable(),
  overdueAmount: Amount.nullable(),
  overdueInstallments: z.number().nullable(),
  creditLimit: Amount.nullable(),
  availableCredit: Amount.nullable(),
  interestRateAnnual: z.number().nullable(),
  avgDailyBalance: Amount.nullable(),
  avgDailyBalancePrior: Amount.nullable(),
  costOfCarry: Amount.nullable(),
  costOfCarryPrior: Amount.nullable(),
  totalDebits: Amount.nullable(),
  totalCredits: Amount.nullable(),
  totalCashback: Amount.nullable(),
  lines: z.array(LineSchema),
});

export const StatementSchema = z.object({
  cardNetwork: z.enum(["visa", "mastercard", "amex", "discover", "other"]),
  cardLast4: z.string().nullable(),
  sections: z.array(SectionSchema),
});

export type LlmLine = z.infer<typeof LineSchema>;
export type LlmSection = z.infer<typeof SectionSchema>;
export type LlmStatement = z.infer<typeof StatementSchema>;
