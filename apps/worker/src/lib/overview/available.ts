/**
 * "Disponible hasta el <payday>" — the figure that answers the question people
 * actually ask ten times a day, which is not "what am I worth" but "can I
 * spend this?".
 *
 * Pure, and kept out of queries.ts so it can be tested without a Supabase
 * client — same split as card-due.ts. Every input here is a row getOverview
 * already fetches; this file composes, it does not query.
 */
import { cardAmountDue } from "@cigua/core/overview/card-due";

/** Cash-like accounts only. An investment position and a car are net worth,
 *  not money you can spend before payday — the audit's "it includes a car". */
export const LIQUID_ACCOUNT_TYPES = ["checking", "savings", "cash"] as const;

export type LiquidAccount = {
  accountId: string;
  type: string;
  balance: number;
  /** computeFunding's clamped commitment for this account — money that is
   *  present but spoken for by a goal. Carried as its own figure rather than
   *  netted into the balance, so the breakdown can show the user why the hero
   *  is smaller than the balance their bank app shows them. */
  committed: number;
  currency: string;
};

export type CardInput = {
  accountId: string;
  name: string;
  currency: string;
  statementBalance: number | null;
  owed: number | null;
  paidSinceStatement: number;
  /** Null when the bank printed no minimum. Never inferred from a percentage:
   *  no issuer in this market publishes one rule, and a guessed minimum would
   *  make the headline figure a fiction. */
  minimumPayment: number | null;
};

export type DueInput = { amount: number; currency: string; date: string | null };

export type CardBasis = { accountId: string; name: string; basis: "minimum" | "full" };

export type AvailableInput = {
  /** Inclusive last day of the period; "YYYY-MM-DD". */
  periodEnd: string;
  toBase: (amount: number, currency: string) => number;
  accounts: LiquidAccount[];
  cards: CardInput[];
  loans: DueInput[];
  subscriptions: DueInput[];
  fxUnconverted: string[];
};

export type Available = {
  periodEnd: string;
  liquid: number;
  committed: number;
  cardsMinimum: number;
  cardsFull: number;
  loans: number;
  subscriptions: number;
  /** The hero. Minimum basis. */
  available: number;
  /** The line beneath it. Full basis. */
  availableIfCardsCleared: number;
  cardBasis: CardBasis[];
  fxUnconverted: string[];
};

/** Only charges with a known date on or before the period end. An undated row
 *  is skipped rather than assumed to fall inside — refuse rather than guess. */
function dueBy(rows: DueInput[], periodEnd: string, toBase: AvailableInput["toBase"]): number {
  return rows.reduce(
    (sum, r) => (r.date && r.date.slice(0, 10) <= periodEnd ? sum + toBase(r.amount, r.currency) : sum),
    0,
  );
}

export function computeAvailable(input: AvailableInput): Available {
  const { periodEnd, toBase } = input;

  let liquid = 0;
  let committed = 0;
  for (const a of input.accounts) {
    if (!(LIQUID_ACCOUNT_TYPES as readonly string[]).includes(a.type)) continue;
    liquid += toBase(a.balance, a.currency);
    committed += toBase(a.committed, a.currency);
  }

  let cardsMinimum = 0;
  let cardsFull = 0;
  const cardBasis: CardBasis[] = [];

  for (const c of input.cards) {
    // Null once settled — a paid-off card contributes nothing and is not
    // listed, exactly as it drops off the Upcoming list.
    const due = cardAmountDue(c.statementBalance, c.owed, c.paidSinceStatement);
    if (due == null) continue;

    // Clamp to what is still owed: a user who has already paid below the
    // printed minimum owes the remainder, not the printed figure.
    const hasMinimum = c.minimumPayment != null;
    const minimum = hasMinimum ? Math.min(Number(c.minimumPayment), due) : due;

    cardsFull += toBase(due, c.currency);
    cardsMinimum += toBase(minimum, c.currency);
    cardBasis.push({
      accountId: c.accountId,
      name: c.name,
      basis: hasMinimum ? "minimum" : "full",
    });
  }

  const loans = dueBy(input.loans, periodEnd, toBase);
  const subscriptions = dueBy(input.subscriptions, periodEnd, toBase);
  const fixed = loans + subscriptions;

  return {
    periodEnd,
    liquid,
    committed,
    cardsMinimum,
    cardsFull,
    loans,
    subscriptions,
    // Deliberately not clamped at zero. A negative number is information: it
    // says the period is already over-committed, which is the whole point.
    available: liquid - committed - cardsMinimum - fixed,
    availableIfCardsCleared: liquid - committed - cardsFull - fixed,
    cardBasis,
    fxUnconverted: input.fxUnconverted,
  };
}
