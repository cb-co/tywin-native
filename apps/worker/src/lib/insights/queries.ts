import type { CostOfCarry, CostOfCarryLine, LoanInterest, LoanInterestLine } from "@cigua/core/insights/types";
export type { CostOfCarry, CostOfCarryLine, LoanInterest, LoanInterestLine };
import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { baseCurrencyOf } from "@cigua/core/profile";
import { shortMonth, monthEnd } from "@cigua/core/budgets/month";
import { getExchangeRates, convertToBase } from "#/lib/fx";
import { CHART_FALLBACK } from "@cigua/core/chart-series";
import { splitPayments } from "@cigua/core/accounts/amortization";
import { loanPaymentAmounts } from "#/lib/insights/net-worth-history";
import { currentPeriod } from "@cigua/core/period/profile";
import { addDays, isWholeMonth, type Period } from "@cigua/core/period/cycle";
import { getTransactions, type TransactionWithRefs } from "#/lib/transactions/queries";
import { isInsightsSpend } from "#/lib/insights/spend-rule";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A pace point past the end of its month comes back null, and the chart needs
 *  that null to stop drawing rather than flatten the line to zero.
 *
 *  Typed `number | null` rather than reading types.ts's shape directly on
 *  purpose: Postgres does not record whether a set-returning function's output
 *  columns are nullable, so `npm run db:types` will regenerate these as plain
 *  `number` even though they are not. Narrowing here keeps the null check legal
 *  under either generated shape instead of turning into a "no overlap" error
 *  the next time somebody regenerates. */
const paceValue = (v: number | null): number | null => (v === null ? null : Number(v));

/** The `"{group} — {name}"` label for a card's cost-of-carry row, so a card
 *  group's multiple currency lines are told apart. Takes an already-resolved
 *  group name (null/undefined for an ungrouped card), read off the view. */
function cardLabel(groupName: string | null | undefined, accountName: string): string {
  return groupName ? `${groupName} — ${accountName}` : accountName;
}

export type Insights = {
  baseCurrency: string;
  distribution: { name: string; value: number; color: string; emoji?: string | null; categoryId: string | null }[];
  trend: { month: string; income: number; expense: number; net: number }[];
  utilization: { id: string; name: string; pct: number; currency: string }[];
  loans: { id: string; name: string; paidPct: number; currency: string }[];
  totalSpend: number;
  /** `date` is THIS period's calendar date at that point — even for the
   *  `lastMonth`/`lastPeriod` series, which is plotted against it by
   *  day-offset, not by its own date. That is what makes the x-axis print a
   *  real date instead of a bare "day 12", which used to silently mean "the
   *  12th of the pay-cycle period" rather than the 12th of the calendar
   *  month a reader would assume from the section's month picker. */
  pace: { date: string; thisMonth: number | null; lastMonth: number | null }[];
};

/**
 * Cumulative spend by day into the period, this period against the one
 * before it — the only Insights card that follows the profile's pay-cycle
 * period rather than the calendar month (the other month-band cards stay
 * calendar-monthly on purpose).
 *
 * Which RPC gets called is not a free choice. `spending_pace(p_month)` and
 * `spending_pace_range(p_start, p_end)` answer different questions —
 * `spending_pace` compares against the TRUE previous calendar month, while
 * `spending_pace_range` compares against an equal-length lookback so a
 * 13-16 day quincena is paced against a same-length quincena. Those two
 * "previous periods" only agree when the current and prior months happen to
 * share a length (they disagree every September, for instance). So a
 * `monthly` profile's whole-month period keeps calling `spending_pace`
 * exactly as before — which is what makes Step 3's invariant (identical
 * chart for a monthly profile) hold — and everything else calls
 * `spending_pace_range`. See 20260908120000_pay_cycle.sql's comment on
 * `spending_pace_range` for this same rule spelled out on the SQL side.
 */
async function fetchPace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  month: string,
  period: Period,
): Promise<Insights["pace"]> {
  if (isWholeMonth(period)) {
    const { data } = await supabase.rpc("spending_pace", { p_month: month });
    // `r.day` is 1-indexed day-of-month; period.start is that month's 1st.
    return (data ?? []).map((r) => ({
      date: addDays(period.start, r.day - 1),
      thisMonth: paceValue(r.this_month),
      lastMonth: paceValue(r.last_month),
    }));
  }
  const { data } = await supabase.rpc("spending_pace_range", {
    p_start: period.start,
    p_end: period.end,
  });
  return (data ?? []).map((r) => ({
    date: addDays(period.start, r.day_offset),
    thisMonth: paceValue(r.this_period),
    lastMonth: paceValue(r.last_period),
  }));
}

export async function getInsights(month: string): Promise<Insights> {
  const supabase = await createClient();

  // The pace RPC's args (and which RPC to call at all) depend on the
  // profile's pay-cycle period, so the profile is read on its own before the
  // batch below — same pattern as lib/overview/queries.ts. `month` here is
  // the page's navigated reference date (first-of-month), not literal
  // "today": passing it through to currentPeriod is what keeps the pace
  // chart scoped to whichever month is on screen instead of snapping back to
  // the current period when a monthly profile navigates away from it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency,pay_cycle,pay_anchor_day")
    .maybeSingle();

  const period = currentPeriod(profile, month);

  const [
    { data: dist },
    { data: cashflow },
    { data: cards },
    { data: loans },
    { data: cats },
    { data: accounts },
    pace,
  ] = await Promise.all([
    supabase.rpc("spend_distribution", { p_month: month }),
    supabase.from("monthly_cashflow").select("*").order("month"),
    supabase.from("card_status").select("account_id,currency,utilization_pct"),
    supabase
      .from("loan_status")
      .select(
        "account_id,currency,principal,outstanding_balance,progress_installments_paid,progress_term_months",
      ),
    supabase.from("categories").select("id,name,color,emoji"),
    supabase.from("accounts").select("id,name"),
    fetchPace(supabase, month, period),
  ]);

  const tCommon = await getTranslations("Common");

  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  const acctById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  /* A null category is money the importer could not identify, not a category
     whose row went missing — so it gets a deliberate muted grey rather than the
     next colour off the fallback rotation, and reads as absence. `spend_distribution`
     stopped filtering these out so the ledger would stop quietly under-reporting
     the month; see the null_category_triage migration. */
  const distribution = (dist ?? []).map((d, i) => {
    const cat = d.category_id ? catById.get(d.category_id) : undefined;
    return {
      name: cat?.name ?? tCommon("uncategorized"),
      emoji: cat?.emoji ?? null,
      value: Number(d.total ?? 0),
      color: d.category_id
        ? (cat?.color ?? CHART_FALLBACK[i % CHART_FALLBACK.length])
        : "var(--muted-foreground)",
      categoryId: d.category_id ?? null,
    };
  });

  const trend = (cashflow ?? []).slice(-8).map((c) => ({
    month: shortMonth(c.month ?? month),
    income: Number(c.income ?? 0),
    expense: Number(c.expense ?? 0),
    net: Number(c.net ?? 0),
  }));

  const baseCurrency = baseCurrencyOf(profile);

  const utilization = (cards ?? [])
    .filter((c) => c.utilization_pct != null)
    .map((c) => ({
      id: c.account_id ?? "",
      name: acctById.get(c.account_id ?? "") ?? "Card",
      pct: Number(c.utilization_pct),
      currency: c.currency ?? baseCurrency,
    }));

  const loanRows = (loans ?? []).map((l) => {
    const principal = Number(l.principal ?? 0);
    const outstanding = Number(l.outstanding_balance ?? 0);
    const paidPct =
      l.progress_term_months && l.progress_term_months > 0
        ? (Number(l.progress_installments_paid ?? 0) / l.progress_term_months) * 100
        : principal > 0
          ? ((principal - outstanding) / principal) * 100
          : 0;
    return {
      id: l.account_id ?? "",
      name: acctById.get(l.account_id ?? "") ?? "Loan",
      paidPct: Math.max(0, Math.min(paidPct, 100)),
      currency: l.currency ?? baseCurrency,
    };
  });

  return {
    baseCurrency,
    distribution,
    trend,
    utilization,
    loans: loanRows,
    totalSpend: distribution.reduce((s, d) => s + d.value, 0),
    pace,
  };
}

/** Generously above what a single category+month realistically holds, so the
 *  category drawer never silently truncates without the caller knowing to
 *  add paging — see the comment on getInsightsSpendTransactions. */
const SPEND_DRILLDOWN_LIMIT = 300;

/**
 * Every transaction behind one `distribution` row — what "tap a spend-ledger
 * row" drills into. `categoryIds` is a list, not a single id, because the
 * folded "everything else" row stands in for every category past the top
 * seven (see shareRows) — querying only the category it's named after would
 * silently drop the rest of what it represents.
 *
 * Applies `spend_distribution`'s own inclusion rule (`isInsightsSpend`)
 * client-side rather than trusting the DB-level `type` filter alone, because
 * that rule also depends on the destination account's type, which PostgREST
 * cannot express as an OR across the base table and an embedded one.
 *
 * Not paginated: a category's charges in one month are a small, bounded set
 * in practice, and the calling UI renders them as one scrollable list rather
 * than a "load more" ledger.
 */
export async function getInsightsSpendTransactions(
  month: string,
  categoryIds: (string | null)[],
): Promise<TransactionWithRefs[]> {
  const { rows } = await getTransactions(
    { categoryIds, types: ["expense", "payment"], from: month, to: monthEnd(month) },
    null,
    SPEND_DRILLDOWN_LIMIT,
  );
  return rows.filter((r) => isInsightsSpend({ type: r.type, toAccountType: r.to_account?.type ?? null }));
}



export async function getCostOfCarry(): Promise<CostOfCarry> {
  const supabase = await createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("card_cost_of_carry")
      .select(
        "account_id,name,currency,group_name,period_end,interest_rate_annual,avg_daily_balance,cost_of_carry",
      ),
  ]);
  const baseCurrency = baseCurrencyOf(profile);
  const rates = await getExchangeRates(baseCurrency);

  const lines: CostOfCarryLine[] = (rows ?? []).map((r) => {
    const carry = r.cost_of_carry === null ? null : Number(r.cost_of_carry);
    const currency = r.currency ?? baseCurrency;
    return {
      accountId: r.account_id ?? "",
      name: cardLabel(r.group_name, r.name ?? "Card"),
      currency,
      periodEnd: r.period_end ?? "",
      apr: r.interest_rate_annual === null ? null : Number(r.interest_rate_annual),
      avgDailyBalance: r.avg_daily_balance === null ? null : Number(r.avg_daily_balance),
      costOfCarry: carry,
      costOfCarryBase: carry === null ? null : convertToBase(carry, currency, baseCurrency, rates),
    };
  });
  return {
    baseCurrency,
    lines,
    totalBase: lines.reduce((s, l) => s + (l.costOfCarryBase ?? 0), 0),
  };
}



export type LoanInterestInput = {
  year: number;
  baseCurrency: string;
  rates: Record<string, number>;
  loans: {
    id: string;
    name: string;
    currency: string;
    principal: number;
    interest_rate: number | null;
    term_months: number | null;
  }[];
  /** Every payment into every loan, ever, ordered (occurred_at, created_at, id). */
  payments: { to_account_id: string | null; amount: number; to_amount: number | null; occurred_at: string }[];
};

/**
 * Pure core of getLoanInterest: what each active loan's interest costs, from
 * the payments actually logged against it.
 *
 * Two figures per loan, because they answer different questions. `lastInterest`
 * is the interest inside that loan's most recent payment — one month of carry,
 * which is why summing it across loans gives a monthly run-rate rather than a
 * period total (the same shape getCostOfCarry builds from each card's newest
 * statement). `yearInterest` is a period total: every payment dated in `year`.
 *
 * The split always runs from the loan's first payment, not from the start of
 * the year, because each payment's interest depends on the balance the earlier
 * ones left. Filtering the payments first would charge January's payment
 * interest on the full principal.
 *
 * A loan only appears once it has a payment to report and while it still owes
 * something. A paid-off loan costs nothing to carry, and a loan with no logged
 * payment has no interest this app can vouch for — the same reason the card
 * report omits a cashback row no statement ever reported.
 *
 * Caveat this cannot fix: payments made before the loan was added to the app
 * are not transactions, so `yearInterest` covers the tracked part of the year
 * only. The card labels it as such rather than implying a full year.
 */
export function buildLoanInterest(input: LoanInterestInput): LoanInterest {
  const { year, baseCurrency, rates } = input;
  const toBase = (amount: number, currency: string) =>
    convertToBase(amount, currency || baseCurrency, baseCurrency, rates);

  const lines: LoanInterestLine[] = [];
  for (const loan of input.loans) {
    const split = splitPayments({
      principal: Number(loan.principal ?? 0),
      annualRate: loan.interest_rate,
      termMonths: loan.term_months,
      payments: loanPaymentAmounts(input.payments.filter((p) => p.to_account_id === loan.id)),
    });
    const last = split.at(-1);
    if (!last || last.balance <= 0) continue;

    lines.push({
      accountId: loan.id,
      name: loan.name,
      currency: loan.currency || baseCurrency,
      apr: loan.interest_rate === null ? null : round2(Number(loan.interest_rate) * 100),
      lastPaymentDate: last.date,
      lastInterest: last.interest,
      yearInterest: round2(
        split
          .filter((s) => s.date.startsWith(`${year}-`))
          .reduce((sum, s) => sum + s.interest, 0),
      ),
    });
  }

  lines.sort((a, b) => toBase(b.lastInterest, b.currency) - toBase(a.lastInterest, a.currency));

  return {
    year,
    baseCurrency,
    lines,
    monthlyBase: round2(lines.reduce((s, l) => s + toBase(l.lastInterest, l.currency), 0)),
    yearBase: round2(lines.reduce((s, l) => s + toBase(l.yearInterest, l.currency), 0)),
  };
}

/** What each active loan's interest costs — see buildLoanInterest for the rules. */
export async function getLoanInterest(): Promise<LoanInterest> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: profile }, { data: loans }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("accounts")
      .select("id,name,currency,principal,interest_rate,term_months")
      .eq("type", "loan")
      .eq("is_archived", false),
  ]);

  const baseCurrency = baseCurrencyOf(profile);
  const loanIds = (loans ?? []).map((l) => l.id);
  if (loanIds.length === 0) {
    return { year, baseCurrency, lines: [], monthlyBase: 0, yearBase: 0 };
  }

  const [rates, payments] = await Promise.all([
    getExchangeRates(baseCurrency),
    fetchAllLoanPayments(supabase, loanIds),
  ]);

  return buildLoanInterest({
    year,
    baseCurrency,
    rates,
    loans: (loans ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      currency: l.currency,
      principal: Number(l.principal ?? 0),
      interest_rate: l.interest_rate === null ? null : Number(l.interest_rate),
      term_months: l.term_months,
    })),
    payments,
  });
}

/**
 * Every payment into these loans, oldest first, ordered the way `loan_status`
 * orders them so the interest split lands on the same balances that view does.
 *
 * Paged rather than fetched in one request, and for a stronger reason than a
 * plain total would have: a total merely under-reports when PostgREST silently
 * truncates at `max_rows`. Here a missing early payment shifts the balance
 * every later payment is charged on, so a truncated fetch would report wrong
 * interest for the payments it *did* read.
 */
async function fetchAllLoanPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loanIds: string[],
): Promise<LoanInterestInput["payments"]> {
  const PAGE_SIZE = 1000;
  const rows: LoanInterestInput["payments"] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("to_account_id,amount,to_amount,occurred_at")
      .eq("type", "payment")
      .in("to_account_id", loanIds)
      .order("occurred_at")
      .order("created_at")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}
