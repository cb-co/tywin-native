import { z } from "zod";

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

/**
 * ISO 4217 codes the extractor may assign.
 *
 * Deliberately far wider than the three currencies the app currently holds
 * accounts in (DOP/EUR/USD). An enum leaves the model no way to say "none of
 * these" — it must return one of the listed values — so a narrow list would not
 * make an unlisted currency fail loudly, it would make it come back silently
 * wrong. The list therefore covers every currency a statement reaching this app
 * could plausibly be denominated in: the majors, plus Latin America and the
 * Caribbean.
 */
export const CURRENCIES = [
  "DOP", "USD", "EUR", "GBP", "CAD", "CHF", "JPY", "CNY", "AUD",
  "MXN", "GTQ", "HNL", "NIO", "CRC", "PAB", "BZD",
  "COP", "VES", "BRL", "ARS", "CLP", "PEN", "UYU", "PYG", "BOB",
  "JMD", "TTD", "BBD", "BSD", "KYD", "XCD", "AWG", "ANG", "HTG", "CUP", "SRD", "GYD",
] as const;

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
  /** What the section IS, rather than a name for it. `sectionKey` used to be a
   *  free string the model had to construct to a spec and the caller rewrote
   *  when it didn't; it is derived from this plus `currency` now. */
  sectionKind: z.enum(["revolving", "installments"]),
  currency: z.enum(CURRENCIES),
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
