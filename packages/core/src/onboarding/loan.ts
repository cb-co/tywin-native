import type { AccountInput } from "../accounts/schema";

/** What onboarding's short loan form collects, as typed. */
export type OnboardingLoan = {
  name: string;
  currency: string;
  owedToday: string;
  installment: string;
  /** Optional when the rate is given: typed, it overrides the estimate. */
  remainingInstallments: string;
  dueDay: string;
  /** A percent as typed ("18.5"), not the stored fraction. */
  annualRatePercent: string;
};

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/**
 * Installments left on an amortizing loan, from what is owed, the installment
 * and the annual rate — the standard annuity formula solved for n:
 *
 *   n = −ln(1 − r·owed / installment) / ln(1 + r),  r = annual rate / 12
 *
 * Rounded up: a final partial installment is still an installment. Returns
 * `"never"` when a month's interest eats the whole installment, and null until
 * all three figures are there.
 *
 * Accepted: an installment that bundles insurance (common on local car loans)
 * reads as more principal paid each month, so this lands a few short. The form
 * shows the estimate and takes an override for exactly that reason.
 */
export function estimateRemainingInstallments(
  owed: number,
  installment: number,
  annualRatePercent: number,
): number | "never" | null {
  if (!(owed > 0) || !(installment > 0) || !(annualRatePercent >= 0)) return null;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return Math.ceil(owed / installment);
  if (r * owed >= installment) return "never";
  const n = -Math.log(1 - (r * owed) / installment) / Math.log(1 + r);
  // The epsilon keeps float noise on an exact payoff (36.0000000001) from
  // adding an installment that does not exist.
  return Math.ceil(n - 1e-9);
}

/** The installments left: what the person typed, else the estimate from the
 *  rate. Undefined when neither gives a count. */
export function remainingInstallmentsOf(loan: OnboardingLoan): number | undefined {
  const typed = num(loan.remainingInstallments);
  if (typed !== undefined) return typed;
  const rate = num(loan.annualRatePercent);
  if (rate === undefined) return undefined;
  const estimate = estimateRemainingInstallments(
    Number(loan.owedToday),
    Number(loan.installment),
    rate,
  );
  return typeof estimate === "number" ? estimate : undefined;
}

/**
 * Describes a loan as it stands today rather than as it was originated.
 *
 * `loan_status` amortizes from `principal` using only the payments recorded
 * against the account, with `term_months` as the count that clears it. So what
 * is owed today, the installments left and a start date of today give the same
 * outstanding balance as the full history would — without asking a new user
 * for figures from years ago. The result is still validated by `accountInput`
 * on the server; blanks stay undefined so a missing field fails there.
 */
export function loanAccountFromOnboarding(loan: OnboardingLoan, today: string): AccountInput {
  const rate = num(loan.annualRatePercent);
  return {
    name: loan.name.trim(),
    type: "loan",
    currency: loan.currency,
    starting_balance: 0,
    transfer_tax_rate: 0.002,
    network_fee_amount: 0,
    network_fee_optional: true,
    current_balance: 0,
    principal: num(loan.owedToday),
    installment_amount: num(loan.installment),
    term_months: remainingInstallmentsOf(loan),
    payment_due_day: num(loan.dueDay),
    interest_rate: rate === undefined ? undefined : rate / 100,
    start_date: today,
  };
}
