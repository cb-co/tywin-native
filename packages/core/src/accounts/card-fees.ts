/**
 * What a credit card charges you to HOLD it, read off the fee lines of imported
 * statements.
 *
 * The data was already there. `card_statement_lines.kind` has carried a 'fee'
 * value since the import shipped, because the extraction prompt classifies any
 * line opening with a fee word — cargo, fee, comisión, interés, seguro — as one
 * (lib/statements/llm/system-prompt.ts). Nothing downstream ever read it. This
 * module is the reader, which is why the feature ships with history rather than
 * starting from the next import.
 *
 * INTEREST IS SEPARATED BY CONSTRUCTION, and that is the whole reason this file
 * classifies rather than sums. The prompt puts `interés` in the same bucket as
 * `cargo` and `seguro`, so a naive sum over kind='fee' would fold a finance
 * charge into the cost of owning the card. Interest gets its own bucket instead
 * — what the card report shows as interest paid this year, a realized charge
 * that sits beside Cost of carry's projection and is never added to it. The
 * interest test runs FIRST, so "interés por mora" is interest too — a misfire
 * in that direction can only under-report ownership cost, never inflate it.
 *
 * RECURRING IS THE DEFAULT, and the live data is the argument. `AHORRO MUJER
 * WHITE` was tagged a fee by the model despite matching none of the prompt's
 * keywords: it is a bundled insurance product with a pure brand name. Incident
 * vocabulary (sobregiro, mora, late…) is a bounded, enumerable list; ownership
 * charges are unbounded product names. So the enumerable case gets the explicit
 * list and the unbounded case gets the default.
 *
 * Classification happens HERE, at read time, rather than as a field the model
 * fills in. A `feeKind` in the extraction schema would need a migration, a
 * prompt change and a null-fallback for every existing row — and it could never
 * fix history, because the statements bucket was dropped in
 * 20260722170000_drop_statements_bucket.sql and the source PDFs are gone.
 */

/** One statement line, already coerced out of Supabase's numeric-as-string. */
export type FeeLineRow = {
  description: string;
  amount: number;
  kind: "fee" | "credit";
  posted_on: string;
};

export type FeeBucket = "recurring" | "incidents" | "interest";

export type CardFeeTotals = {
  recurring: number;
  incidents: number;
  /** Finance charges: interest billed on a carried balance, net of reversals. */
  interest: number;
  /** How many rows actually contributed. This is what lets a caller tell "no
   *  fee lines at all" from "fees that happened to net to zero": the surfaces
   *  omit a card entirely for the former rather than printing a 0.00 the data
   *  cannot vouch for. Same convention as hasReportedCashback in cashback.ts. */
  counted: number;
};

/** Lowercased and stripped of diacritics, so one keyword list matches `INTERÉS`,
 *  `Interes` and `interés` alike. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Whole-word match. A bare `includes` would file CHOCOLATERIA as an incident on
 *  the strength of "late", and MEMORABLE on "mora". Multi-word keywords such as
 *  "cash advance" work unchanged — \b sits at the outer edges. */
const has = (text: string, words: readonly string[]) =>
  words.some((w) => new RegExp(`\\b${w}\\b`).test(text));

// Plurals spelled out: matching is whole-word, so "interes" alone missed AMEX's
// INTERESES POR FINANCIAMIENTO and filed it as an ownership charge.
const INTEREST = ["interes", "intereses", "interest", "financiamiento"] as const;

const INCIDENT = [
  "sobregiro", "overdraft", "mora", "late", "atraso", "tardio",
  "penalidad", "penalty", "reposicion", "replacement",
  "avance", "cash advance", "exceso",
] as const;

const REVERSAL = ["reverso", "reversa", "reversal", "anulacion"] as const;

const FEE_WORDS = [
  "cargo", "seguro", "comision", "cobertura", "membresia", "anualidad", "fee",
] as const;

/** Which bucket a `kind = 'fee'` line belongs to. Order is load-bearing: see
 *  the interest note in this file's header. */
export function classifyFee(description: string): FeeBucket {
  const text = norm(description);
  if (has(text, INTEREST)) return "interest";
  if (has(text, INCIDENT)) return "incidents";
  return "recurring";
}

/**
 * The bucket a `kind = 'credit'` line reverses, or null if it reverses nothing
 * this module cares about.
 *
 * Issuers post a reversal as a credit rather than as a negative fee, which puts
 * it in the same bucket as cashback and merchant refunds. Both tests are needed:
 * the prefix alone would pull `REVERSO COMPRA` — an ordinary purchase refund —
 * into a card about fees.
 */
export function reversalTarget(description: string): FeeBucket | null {
  const text = norm(description);
  const prefix = new RegExp(`^(${REVERSAL.join("|")})\\b`);
  if (!prefix.test(text)) return null;
  const rest = text.replace(prefix, "").trim();
  if (!has(rest, FEE_WORDS) && !has(rest, INTEREST)) return null;
  return classifyFee(rest);
}

/** Every subtotal for one card over one calendar year, reversals netted.
 *  Credits already carry a negative sign (the extraction schema encodes the
 *  sign on the number), so netting is plain addition. */
export function summarizeCardFees(rows: FeeLineRow[], year: number): CardFeeTotals {
  const prefix = `${year}-`;
  const totals: CardFeeTotals = { recurring: 0, incidents: 0, interest: 0, counted: 0 };
  for (const r of rows) {
    if (!r.posted_on.startsWith(prefix)) continue;
    const bucket = r.kind === "fee" ? classifyFee(r.description) : reversalTarget(r.description);
    if (bucket === null) continue;
    totals[bucket] += r.amount;
    totals.counted += 1;
  }
  return totals;
}
