/** What Insights' debt cards are built from. Computed by the API, rendered by the app. */

export interface CostOfCarryLine {
  accountId: string;
  name: string; // "Group — Line" when grouped, else account name
  currency: string;
  periodEnd: string;
  apr: number | null;
  avgDailyBalance: number | null;
  costOfCarry: number | null; // native currency
  costOfCarryBase: number | null; // base currency
}

export interface CostOfCarry {
  baseCurrency: string;
  lines: CostOfCarryLine[];
  totalBase: number; // Σ costOfCarryBase
}

export type LoanInterestLine = {
  accountId: string;
  name: string;
  currency: string;
  apr: number | null; // percent, e.g. 12 — matches CostOfCarryLine.apr
  lastPaymentDate: string;
  lastInterest: number; // native (loan currency)
  yearInterest: number; // native
};

export type LoanInterest = {
  year: number;
  baseCurrency: string;
  lines: LoanInterestLine[];
  monthlyBase: number; // Σ lastInterest, in base
  yearBase: number; // Σ yearInterest, in base
};
