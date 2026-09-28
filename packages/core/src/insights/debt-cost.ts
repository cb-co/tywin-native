import type { CostOfCarry, LoanInterest } from "./types";

export type DebtCostRow = {
  accountId: string;
  name: string;
  currency: string;
  apr: number | null;
  /** Statement period end for a card, last payment date for a loan. */
  asOf: string;
  /** Native currency. */
  amount: number;
};

export type DebtCost = {
  baseCurrency: string;
  year: number;
  cards: DebtCostRow[];
  cardsMonthlyBase: number;
  loans: DebtCostRow[];
  loansMonthlyBase: number;
  loansYearBase: number;
};

/**
 * The Insights "what is my debt costing me" card, as two groups that are never
 * summed together.
 *
 * A card's cost of carry is a projection — what the issuer WOULD charge to
 * finance the balance ("Interés si Opta Por Financiar"). A loan's interest is
 * money already paid. Both are monthly-shaped, but one total over a
 * hypothetical and a charge would be a figure that describes nothing, so each
 * group closes on its own subtotal.
 *
 * Cards whose newest statement printed no carry figure are dropped rather than
 * shown at zero — the statement was silent, not free.
 */
export function buildDebtCost(carry: CostOfCarry, loanInterest: LoanInterest): DebtCost {
  const cardLines = carry.lines
    .filter((l): l is typeof l & { costOfCarry: number } => l.costOfCarry !== null)
    .sort((a, b) => (b.costOfCarryBase ?? 0) - (a.costOfCarryBase ?? 0));

  return {
    baseCurrency: carry.baseCurrency,
    year: loanInterest.year,
    cards: cardLines.map((l) => ({
      accountId: l.accountId,
      name: l.name,
      currency: l.currency,
      apr: l.apr,
      asOf: l.periodEnd,
      amount: l.costOfCarry,
    })),
    cardsMonthlyBase: cardLines.reduce((s, l) => s + (l.costOfCarryBase ?? 0), 0),
    loans: loanInterest.lines.map((l) => ({
      accountId: l.accountId,
      name: l.name,
      currency: l.currency,
      apr: l.apr,
      asOf: l.lastPaymentDate,
      amount: l.lastInterest,
    })),
    loansMonthlyBase: loanInterest.monthlyBase,
    loansYearBase: loanInterest.yearBase,
  };
}
