/**
 * Net worth over the last six months, reconstructed from what's already stored
 * rather than from a snapshots table.
 *
 * There is no snapshot to read because there is nothing to snapshot *from*: net
 * worth has never been a stored number. It is assembled per request in
 * TypeScript (lib/overview/queries.ts) out of three own-currency parts, each
 * converted with live FX — the SQL view that tried to do it was dropped for
 * getting exactly that wrong (20260728120000_drop_net_worth_view.sql). A
 * snapshot table would therefore need a scheduled job re-running that same
 * assembly, and it would still show a flat line until it had been running for
 * six months. Every input needed to derive the history is already in the
 * database today, so this derives it:
 *
 *   assets  — `account_balances.balance` is current. Rewind it by the
 *             transactions dated after the month end, using the same
 *             own-currency arithmetic the view uses.
 *   cards   — `accounts.current_balance` is anchored to the newest statement
 *             minus later payments (recompute_card_balance). Applying that same
 *             formula as of an older date, against the newest statement that
 *             had closed by then, gives the balance owed that month.
 *   loans   — `loan_status.outstanding_balance` amortizes every payment in
 *             order; stopping the walk at a month end gives that month's
 *             balance.
 *
 * Two things it does not attempt, both deliberate for a reference chart:
 *
 *   * One FX rate — today's — is applied to every month, so a past point is
 *     "what those balances are worth now", not what they were worth then.
 *     Otherwise the line would move when the user held nothing but currency.
 *   * A card whose newest statement predates a month end has no anchor for that
 *     month, and falls back to rewinding today's balance by later payments.
 *     That ignores charges made since (a card's balance only moves on
 *     statements and payments), so early months on a card with no statement
 *     history read a little high.
 */

import { createClient } from "#/lib/supabase/server";
import { baseCurrencyOf } from "@cigua/core/profile";
import { addMonths, monthStart, monthEnd, shortMonth } from "@cigua/core/budgets/month";
import { getExchangeRates, convertToBase, unconvertedCurrencies } from "#/lib/fx";
import { splitPayments, type LoanPayment } from "@cigua/core/accounts/amortization";

export const MONTHS = 6;

export type NetWorthPoint = {
  month: string; // first-of-month, e.g. "2026-07-01"
  label: string; // "Jul"
  netWorth: number; // base currency, as of the month's last day
};

export type NetWorthHistory = {
  baseCurrency: string;
  points: NetWorthPoint[];
  /** Currencies folded into the series at 1:1 because the FX table was
   *  unavailable. Empty for single-currency users and on every healthy fetch. */
  fxUnconverted: string[];
};

type TxRow = {
  type: string;
  account_id: string;
  to_account_id: string | null;
  amount: number;
  to_amount: number | null;
  total_amount: number;
  occurred_at: string;
};

type PaymentRow = {
  to_account_id: string | null;
  amount: number;
  to_amount: number | null;
  occurred_at: string;
};

export type NetWorthInput = {
  months: string[]; // first-of-month strings, ascending
  baseCurrency: string;
  rates: Record<string, number>;
  balances: { account_id: string; currency: string; balance: number }[];
  cards: { account_id: string; currency: string; owed: number }[];
  loans: {
    id: string;
    currency: string;
    principal: number;
    interest_rate: number | null;
    term_months: number | null;
  }[];
  statements: { account_id: string; period_end: string; total_balance: number }[];
  /** Every transaction dated from the start of `months[1]` onward. */
  transactions: TxRow[];
  /** Every payment into a credit card, from the oldest anchor still in play. */
  cardPayments: PaymentRow[];
  /** Every payment into a loan, ever, oldest first. */
  loanPayments: PaymentRow[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** UTC calendar date of a transaction, to compare against a month boundary.
 *  Matches `date_trunc('month', occurred_at)` in monthly_cashflow and the
 *  `occurred_at::date` cut-off in recompute_card_balance. */
const dateOf = (occurredAt: string) => occurredAt.slice(0, 10);

/**
 * What `tx` did to `accountId`'s own-currency balance — the case expression in
 * `account_balances` (20260720093500_payment_destination_amount.sql), one
 * account at a time. The destination leg of a payment is credited in the
 * destination's currency (`to_amount`), which is why it can't just be `amount`.
 */
export function accountMovement(tx: TxRow, accountId: string): number {
  if (tx.account_id === accountId) {
    if (tx.type === "income") return Number(tx.amount);
    if (tx.type === "expense" || tx.type === "payment") return -Number(tx.total_amount);
    return 0;
  }
  if (tx.type === "payment" && tx.to_account_id === accountId) {
    return Number(tx.to_amount ?? tx.amount);
  }
  return 0;
}

/**
 * Balance owed on a card at the close of `asOf` (a "YYYY-MM-DD" date).
 *
 * Mirrors `recompute_card_balance`: the newest statement that had closed by
 * `asOf` is the anchor, less the payments made between that close and `asOf`.
 * With no anchor there is nothing to rewind to but today's figure, so today's
 * later payments are added back.
 */
export function cardOwedAt(
  cardId: string,
  owedNow: number,
  statements: NetWorthInput["statements"],
  payments: PaymentRow[],
  asOf: string,
): number {
  const paid = (from: string | null, to: string | null) =>
    payments.reduce((sum, p) => {
      if (p.to_account_id !== cardId) return sum;
      const d = dateOf(p.occurred_at);
      if (from !== null && d <= from) return sum;
      if (to !== null && d > to) return sum;
      return sum + Number(p.to_amount ?? p.amount);
    }, 0);

  const anchor = statements
    .filter((s) => s.account_id === cardId && s.period_end <= asOf)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];

  if (anchor) return Number(anchor.total_balance) - paid(anchor.period_end, asOf);
  return owedNow + paid(asOf, null);
}

/** A loan's payments as splitPayments wants them: own-currency amount (the
 *  destination leg, so a cross-currency payment is worth what landed on the
 *  loan) against a plain calendar date. */
export function loanPaymentAmounts(payments: PaymentRow[]): LoanPayment[] {
  return payments.map((p) => ({
    amount: Number(p.to_amount ?? p.amount),
    date: dateOf(p.occurred_at),
  }));
}

/**
 * Outstanding balance after each payment into a loan, oldest first, so a
 * balance can be read off as of any date. The interest-first split itself is
 * splitPayments(); this only discards the interest half of it, which the
 * loan-interest card in lib/insights/queries.ts keeps.
 *
 * `payments` must already be ordered the way `loan_status` orders them
 * (occurred_at, created_at, id) — the split depends on the sequence.
 */
export function loanBalanceTimeline(
  loan: NetWorthInput["loans"][number],
  payments: PaymentRow[],
): { date: string; balance: number }[] {
  return splitPayments({
    principal: Number(loan.principal ?? 0),
    annualRate: loan.interest_rate,
    termMonths: loan.term_months,
    payments: loanPaymentAmounts(payments),
  }).map(({ date, balance }) => ({ date, balance }));
}

/** The six month-starts ending at `through` (inclusive), ascending. */
export function historyMonths(through = monthStart()): string[] {
  return Array.from({ length: MONTHS }, (_, i) => addMonths(through, i - (MONTHS - 1)));
}

/** Pure core: everything above assembled into one point per month. Exported
 *  separately from the fetching so it can be tested without a database. */
export function buildNetWorthSeries(input: NetWorthInput): NetWorthPoint[] {
  const { baseCurrency, rates } = input;
  const toBase = (amount: number, currency: string) =>
    convertToBase(amount, currency || baseCurrency, baseCurrency, rates);

  const loanTimelines = new Map(
    input.loans.map((l) => [
      l.id,
      loanBalanceTimeline(
        l,
        input.loanPayments.filter((p) => p.to_account_id === l.id),
      ),
    ]),
  );

  return input.months.map((month) => {
    const asOf = monthEnd(month);
    const after = input.transactions.filter((t) => dateOf(t.occurred_at) > asOf);

    const assets = input.balances.reduce((sum, b) => {
      const moved = after.reduce((s, t) => s + accountMovement(t, b.account_id), 0);
      return sum + toBase(Number(b.balance) - moved, b.currency);
    }, 0);

    const owed = input.cards.reduce(
      (sum, c) =>
        sum +
        toBase(
          cardOwedAt(c.account_id, Number(c.owed ?? 0), input.statements, input.cardPayments, asOf),
          c.currency,
        ),
      0,
    );

    const debt = input.loans.reduce((sum, l) => {
      const timeline = loanTimelines.get(l.id) ?? [];
      const last = timeline.filter((e) => e.date <= asOf).at(-1);
      return sum + toBase(round2(last?.balance ?? Number(l.principal ?? 0)), l.currency);
    }, 0);

    return {
      month,
      label: shortMonth(month),
      netWorth: round2(assets - owed - debt),
    };
  });
}

export async function getNetWorthHistory(): Promise<NetWorthHistory> {
  const supabase = await createClient();
  const months = historyMonths();

  const [{ data: profile }, { data: balances }, { data: cards }, { data: loanAccounts }, { data: statements }] =
    await Promise.all([
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase.from("account_balances").select("account_id,currency,balance"),
      supabase.from("card_status").select("account_id,currency,owed"),
      supabase
        .from("accounts")
        .select("id,currency,principal,interest_rate,term_months")
        .eq("type", "loan"),
      supabase
        .from("card_statements")
        .select("account_id,period_end,total_balance")
        .lte("period_end", monthEnd(months[MONTHS - 1])),
    ]);

  const baseCurrency = baseCurrencyOf(profile);
  const cardIds = (cards ?? []).map((c) => c.account_id).filter((id): id is string => !!id);
  const loanIds = (loanAccounts ?? []).map((l) => l.id);

  // Card payments reach back to the oldest anchor still in play, which can
  // predate the six-month window when a card hasn't had a statement in a while.
  const oldestAnchor = (statements ?? []).reduce<string | null>(
    (min, s) => (min === null || s.period_end < min ? s.period_end : min),
    null,
  );
  const cardPaymentsFrom =
    oldestAnchor !== null && oldestAnchor < months[1] ? oldestAnchor : months[1];

  const [{ data: transactions }, { data: cardPayments }, { data: loanPayments }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type,account_id,to_account_id,amount,to_amount,total_amount,occurred_at")
      .gte("occurred_at", months[1]),
    cardIds.length
      ? supabase
          .from("transactions")
          .select("to_account_id,amount,to_amount,occurred_at")
          .eq("type", "payment")
          .in("to_account_id", cardIds)
          .gte("occurred_at", cardPaymentsFrom)
      : { data: [] },
    loanIds.length
      ? supabase
          .from("transactions")
          .select("to_account_id,amount,to_amount,occurred_at,created_at,id")
          .eq("type", "payment")
          .in("to_account_id", loanIds)
          // The amortization split depends on payment order, so match the
          // ordering loan_status walks them in.
          .order("occurred_at")
          .order("created_at")
          .order("id")
      : { data: [] },
  ]);

  const rates = await getExchangeRates(baseCurrency);

  return {
    baseCurrency,
    // Same caveat the Overview hero carries: without a rate table a foreign
    // holding lands in the series at 1:1, so the chart needs to say so.
    fxUnconverted: unconvertedCurrencies(
      [
        ...(balances ?? []).map((b) => b.currency),
        ...(cards ?? []).map((c) => c.currency),
        ...(loanAccounts ?? []).map((l) => l.currency),
      ],
      baseCurrency,
      rates,
    ),
    points: buildNetWorthSeries({
      months,
      baseCurrency,
      rates,
      balances: (balances ?? []).map((b) => ({
        account_id: b.account_id ?? "",
        currency: b.currency ?? baseCurrency,
        balance: Number(b.balance ?? 0),
      })),
      cards: (cards ?? []).map((c) => ({
        account_id: c.account_id ?? "",
        currency: c.currency ?? baseCurrency,
        owed: Number(c.owed ?? 0),
      })),
      loans: (loanAccounts ?? []).map((l) => ({
        id: l.id,
        currency: l.currency ?? baseCurrency,
        principal: Number(l.principal ?? 0),
        interest_rate: l.interest_rate === null ? null : Number(l.interest_rate),
        term_months: l.term_months,
      })),
      statements: (statements ?? []).map((s) => ({
        account_id: s.account_id ?? "",
        period_end: s.period_end ?? "",
        total_balance: Number(s.total_balance ?? 0),
      })),
      transactions: (transactions ?? []) as TxRow[],
      cardPayments: (cardPayments ?? []) as PaymentRow[],
      loanPayments: (loanPayments ?? []) as PaymentRow[],
    }),
  };
}
