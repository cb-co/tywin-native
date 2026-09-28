export type AmortizationRow = {
  n: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Standard fixed-rate monthly amortization schedule.
 * If `installment` is given it is used as the monthly payment; otherwise the
 * level payment is computed from principal, annual rate, and term. The final
 * row is trimmed so the balance lands exactly on zero.
 */
export function buildSchedule({
  principal,
  annualRate,
  termMonths,
  installment,
}: {
  principal: number;
  annualRate: number;
  termMonths: number;
  installment?: number | null;
}): AmortizationRow[] {
  if (principal <= 0 || termMonths <= 0) return [];

  const r = annualRate > 0 ? annualRate / 12 : 0;
  const computed =
    r === 0
      ? principal / termMonths
      : (principal * r) / (1 - Math.pow(1 + r, -termMonths));
  const payment = installment && installment > 0 ? installment : computed;

  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let n = 1; n <= termMonths && balance > 0.005; n++) {
    const interest = round2(balance * r);
    let principalPaid = round2(payment - interest);
    // Final scheduled month (or an overpayment) clears the remaining balance so
    // per-cent rounding never leaves a residual.
    if (principalPaid > balance || n === termMonths) principalPaid = balance;
    const rowPayment = round2(principalPaid + interest);
    balance = round2(balance - principalPaid);
    rows.push({ n, payment: rowPayment, interest, principal: principalPaid, balance });
  }

  return rows;
}

export type LoanPayment = { amount: number; date: string };

export type PaymentSplit = {
  date: string;
  interest: number;
  principal: number;
  balance: number;
};

/**
 * The same interest-first split as buildSchedule, applied to the payments that
 * were actually made rather than to a projected schedule — so it answers what
 * a loan has cost so far, not what it is due to cost.
 *
 * This is the arithmetic of the recursive CTE in `loan_status`
 * (20260727120000_loan_outstanding_amortized.sql), and the `balance` it returns
 * is the figure that view reports and the account page's schedule prints.
 * `payments` must already be ordered the way the view orders them
 * (occurred_at, created_at, id) — every split depends on the balance the
 * payments before it left behind.
 *
 * Interest is capped at the payment: a payment too small to cover the month's
 * interest was *entirely* interest, and reporting the full accrual would state
 * a charge larger than the money that moved. The unpaid remainder is not
 * capitalized — the balance holds, exactly as the view leaves it.
 */
export function splitPayments({
  principal,
  annualRate,
  termMonths,
  payments,
}: {
  principal: number;
  annualRate: number | null;
  termMonths: number | null;
  payments: LoanPayment[];
}): PaymentSplit[] {
  const monthlyRate = Number(annualRate ?? 0) / 12;
  let balance = Number(principal ?? 0);

  return payments.map((p, i) => {
    const before = balance;
    let interest = 0;
    if (termMonths !== null && i + 1 >= termMonths) {
      // The last scheduled installment clears the loan; anything past the term
      // is charged nothing because there is nothing left to charge on.
      balance = 0;
    } else {
      const accrued = round2(before * monthlyRate);
      interest = Math.min(accrued, p.amount);
      balance = before - Math.min(Math.max(p.amount - accrued, 0), before);
    }
    return { date: p.date, interest, principal: round2(before - balance), balance };
  });
}
