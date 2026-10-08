import { getTranslations } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { baseCurrencyOf } from "@cigua/core/profile";
import { netWorthTotal } from "#/lib/accounts/net-worth";
import { nextChargeDate, monthlyEquivalent, type BillingCycle } from "@cigua/core/subscriptions/cycle";
import { getExchangeRates, convertToBase, unconvertedCurrencies } from "#/lib/fx";
import { cardDue } from "@cigua/core/overview/card-due";
import { nextUnpaid, type LoggedPayment, type Unpaid } from "@cigua/core/overview/next-unpaid";
import { statementPaymentsByCard } from "#/lib/accounts/card-payments";
import { importPromptState, type ImportPrompt } from "./import-prompt";
import { isOutgoing } from "./outgoing";
import { currentPeriod } from "@cigua/core/period/profile";
import { wholeBudgetMonth } from "#/lib/budgets/queries";
import { addDays, localDate, type Period } from "@cigua/core/period/cycle";
import { computeAvailable, type Available } from "./available";
import { computeFunding, type ContributionRow } from "#/lib/goals/funding";

export type UpcomingItem = {
  key: string;
  /** `YYYY-MM-DD`. A date, not an instant: format it in UTC (`formatDate`) or
   *  a phone west of Greenwich shows the day before. */
  date: string;
  title: string;
  subtitle: string;
  /** What to pay by `date`. For a card with a statement behind it, see `card`. */
  amount: number;
  currency: string;
  /** Credit cards with a statement. `amount` is then what keeps the card
   *  current: the minimum still left while there is one, the rest of the cutoff
   *  balance once it is met (or when the bank printed no minimum). */
  card?: { basis: "minimum" | "statement"; statementLeft: number; minimumPaid: boolean };
};

export type Overview = {
  hasAccounts: boolean;
  baseCurrency: string;
  displayName: string | null;
  netWorth: number;
  monthIncome: number;
  monthExpense: number;
  totalBudget: number;
  totalUsed: number;
  /** Monthly-equivalent totals of the active recurring templates, base currency,
   *  split by what they are. Expenses (rent, streaming, utilities) and card
   *  payments are different things to coach on, and income is what they are
   *  weighed against. Transfers and loan payments are in none of them. */
  monthlyRecurringExpenses: number;
  monthlyRecurringCardPayments: number;
  monthlyRecurringIncome: number;
  upcoming: UpcomingItem[];
  importPrompt: ImportPrompt;
  /** Currencies that went into the totals above at a 1:1 fallback rate because
   *  the FX table was unavailable. Empty on every single-currency account set,
   *  which is why the page can render the warning unconditionally on it. */
  fxUnconverted: string[];
  /** The pay-cycle period `today` falls in. A monthly profile's period is
   *  exactly the calendar month, which is what keeps this build byte-for-byte
   *  identical to today's app for every profile that hasn't opted into a
   *  quincena. */
  period: Period;
  /** "Disponible hasta el <payday>" — composed from the rows above, not
   *  queried separately. See lib/overview/available.ts. */
  available: Available;
};

/** A card's due date from its payment day, when no statement gives one. From
 *  today's midnight, not now: from now, a card due today rolls to next month. */
function nextDue(day: number | null, today: string): string | null {
  const [y, m, d] = today.split("-").map(Number);
  const next = nextChargeDate({ cycle: "monthly", anchorDay: day }, new Date(y, m - 1, d));
  return next ? localDate(next) : null;
}

/** Payments logged lately toward each loan and each recurring payment — what
 *  tells an installment already paid from one still to pay (see nextUnpaid).
 *  Loans by destination, in the loan's own currency (the same coalesce as
 *  statementPaymentsByCard); recurring payments by the template the charge was
 *  recorded from. Each window covers the longest run-up its schedules can
 *  have: a month for loans, two-thirds of a year for a yearly template. */
export async function recentPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loanIds: string[],
  subIds: string[],
  today: string,
): Promise<{ loans: Map<string, LoggedPayment[]>; subs: Map<string, string[]> }> {
  const [{ data: loanRows }, { data: subRows }] = await Promise.all([
    loanIds.length
      ? supabase
          .from("transactions")
          .select("to_account_id,amount,to_amount,occurred_at")
          .eq("type", "payment")
          .in("to_account_id", loanIds)
          .gte("occurred_at", addDays(today, -31))
      : Promise.resolve({ data: [] as { to_account_id: string | null; amount: number; to_amount: number | null; occurred_at: string }[] }),
    subIds.length
      ? supabase
          .from("transactions")
          .select("subscription_id,occurred_at")
          .in("subscription_id", subIds)
          .gte("occurred_at", addDays(today, -250))
      : Promise.resolve({ data: [] as { subscription_id: string | null; occurred_at: string }[] }),
  ]);

  const loans = new Map<string, LoggedPayment[]>();
  for (const r of loanRows ?? []) {
    if (!r.to_account_id) continue;
    const list = loans.get(r.to_account_id) ?? [];
    list.push({ date: r.occurred_at.slice(0, 10), amount: Number(r.to_amount ?? r.amount ?? 0) });
    loans.set(r.to_account_id, list);
  }
  const subs = new Map<string, string[]>();
  for (const r of subRows ?? []) {
    if (!r.subscription_id) continue;
    subs.set(r.subscription_id, [...(subs.get(r.subscription_id) ?? []), r.occurred_at.slice(0, 10)]);
  }
  return { loans, subs };
}

function dueInput(due: Unpaid | null, currency: string) {
  return { amount: due?.amount ?? 0, currency, date: due?.date ?? null };
}

export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();

  // The period must be resolved before the range RPCs below can run, so the
  // profile is read on its own first rather than folded into the Promise.all.
  // One extra round trip on the most-viewed page is worth less than a period
  // that's wrong for everyone on it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency,display_name,pay_cycle,pay_anchor_day")
    .maybeSingle();

  const today = localDate();
  const period = currentPeriod(profile, today);

  const [
    { data: cashflowRows },
    { data: usage },
    { data: accounts },
    { data: balances },
    { data: cards },
    { data: loans },
    { data: subs },
    { data: contributions },
  ] = await Promise.all([
    supabase.rpc("cashflow_range", { p_start: period.start, p_end: period.end }),
    supabase.rpc("category_usage_range", {
      p_start: period.start,
      p_end: period.end,
      p_whole: wholeBudgetMonth(period, profile),
    }),
    supabase.from("accounts").select("id,name,currency,type").eq("is_archived", false),
    supabase.from("account_balances").select("account_id,currency,balance"),
    supabase
      .from("card_status")
      .select(
        "account_id,currency,owed,latest_statement_balance,latest_due_date,latest_period_end,payment_due_day,latest_minimum_payment",
      ),
    supabase.from("loan_status").select("account_id,currency,outstanding_balance,installment_amount,payment_due_day"),
    supabase
      .from("subscriptions")
      .select(
        "id,name,amount,currency,billing_cycle,anchor_day,anchor_date,is_active,kind,account_id,to_account_id",
      )
      .eq("is_active", true)
      /* Income is read only for the monthly recurring-income total; the
         outgoing kinds are sorted out below, once the destination account's
         TYPE is known — which is not something this query can ask. See
         `outgoing`. */
      .in("kind", ["expense", "payment", "income"]),
    // The full set, never scoped to a single account — computeFunding's
    // borrow-back allocation depends on every goal sharing an account. See the
    // same comment in lib/goals/queries.ts:147.
    supabase.from("goal_contributions").select("id,goal_id,account_id,amount,base_amount,occurred_at"),
  ]);

  // cashflow_range always returns exactly one row (its sums are coalesced),
  // but a table-returning RPC is typed as an array.
  const cashflow = (cashflowRows ?? [])[0];

  const baseCurrency = baseCurrencyOf(profile);
  const acctById = new Map((accounts ?? []).map((a) => [a.id, a]));

  /* The recurring templates that are real money leaving, and the ONE list
     `upcoming`, `computeAvailable` and the monthly recurring totals all read — they
     have to agree, or the hero figure and the list under it describe different
     months. The rule itself lives in ./outgoing, where it is testable. */
  const outgoing = (subs ?? []).filter((s) =>
    isOutgoing(s, (id) => acctById.get(id)?.type),
  );

  const [rates, cardPaid, paid] = await Promise.all([
    getExchangeRates(baseCurrency),
    statementPaymentsByCard(supabase, cards ?? []),
    recentPayments(
      supabase,
      (loans ?? []).flatMap((l) => (l.account_id ? [l.account_id] : [])),
      outgoing.map((s) => s.id),
      today,
    ),
  ]);
  const toBase = (amount: number, currency: string) => convertToBase(amount, currency, baseCurrency, rates);

  // Only the rows that actually feed a base-currency total: `upcoming` shows
  // each amount in its own currency, so a missing rate costs it nothing.
  const fxUnconverted = unconvertedCurrencies(
    [
      ...(balances ?? []).map((b) => b.currency),
      ...(cards ?? []).map((c) => c.currency),
      ...(loans ?? []).map((l) => l.currency),
      ...outgoing.map((s) => s.currency),
    ],
    baseCurrency,
    rates,
  );
  const t = await getTranslations("Overview");

  const usageRows = usage ?? [];

  const netWorth = netWorthTotal(balances ?? [], cards ?? [], loans ?? [], baseCurrency, toBase);

  const monthlyTotal = (rows: NonNullable<typeof subs>) =>
    rows.reduce(
      (s, sub) => s + monthlyEquivalent(toBase(Number(sub.amount), sub.currency), sub.billing_cycle as BillingCycle),
      0,
    );

  /* The next installment and the next charge still to pay — one already
     logged has moved on to the one after. Computed once: the Upcoming rows and
     the hero's dated legs read the same figures, so they cannot disagree. */
  const loanDue = (loans ?? []).map((l) => ({
    row: l,
    due: nextUnpaid({
      schedule: { cycle: "monthly", anchorDay: l.payment_due_day },
      amount: Number(l.installment_amount ?? 0),
      payments: paid.loans.get(l.account_id ?? "") ?? [],
      today,
    }),
  }));
  const subDue = outgoing.map((s) => ({
    row: s,
    due: nextUnpaid({
      schedule: { cycle: s.billing_cycle as BillingCycle, anchorDay: s.anchor_day, anchorDate: s.anchor_date },
      amount: Number(s.amount),
      // A recorded charge settles its occurrence whatever it cost: it may have
      // settled in the account's currency, not the template's, so its amount
      // cannot be compared with the template's.
      payments: (paid.subs.get(s.id) ?? []).map((date) => ({ date, amount: Number(s.amount) })),
      today,
    }),
  }));

  const upcoming: UpcomingItem[] = [];

  for (const c of cards ?? []) {
    // Null once the statement is settled — the row then drops off until the
    // next import brings a fresh balance and due date. A card left unpaid keeps
    // showing its real, overdue date, which is the point.
    const due = cardDue(
      c.latest_statement_balance,
      c.owed,
      cardPaid.get(c.account_id ?? "") ?? 0,
      c.latest_minimum_payment,
    );
    const date = c.latest_due_date ?? nextDue(c.payment_due_day, today);
    const acct = acctById.get(c.account_id ?? "");
    if (!date || !acct || !due) continue;
    // Minimum paid and the due date gone by: what is left is not overdue, it
    // rolls into the next statement. Nothing is coming due until that import.
    if (date < today && due.minimum === 0) continue;
    const currency = c.currency ?? acct.currency;
    const owesMinimum = due.minimum != null && due.minimum > 0;
    upcoming.push({
      key: `card-${c.account_id}`,
      date,
      title: t("cardPaymentTitle", { name: acct.name }),
      subtitle: t("creditCardSubtitle", { currency }),
      amount: owesMinimum ? due.minimum! : due.balance,
      currency,
      card:
        c.latest_statement_balance != null
          ? { basis: owesMinimum ? "minimum" : "statement", statementLeft: due.balance, minimumPaid: due.minimum === 0 }
          : undefined,
    });
  }
  for (const { row: l, due } of loanDue) {
    const acct = acctById.get(l.account_id ?? "");
    if (due && acct)
      upcoming.push({
        key: `loan-${l.account_id}`,
        date: due.date,
        title: t("loanInstallmentTitle", { name: acct.name }),
        subtitle: t("loanSubtitle", { currency: l.currency ?? acct.currency }),
        amount: due.amount,
        currency: l.currency ?? acct.currency,
      });
  }
  for (const { row: s, due } of subDue) {
    if (due)
      upcoming.push({
        key: `sub-${s.id}`,
        date: due.date,
        title: s.name,
        subtitle: t("subscriptionSubtitle", { currency: s.currency }),
        amount: due.amount,
        currency: s.currency,
      });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  const contributionRows: ContributionRow[] = (contributions ?? []).map((c) => ({
    id: c.id,
    goal_id: c.goal_id,
    account_id: c.account_id,
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    occurred_at: c.occurred_at,
  }));

  // All contributions and all balances, never scoped to the accounts this
  // page happens to render — see the comment on the goal_contributions query
  // above.
  const funding = computeFunding(
    contributionRows,
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  const available = computeAvailable({
    periodEnd: period.end,
    toBase,
    accounts: (accounts ?? []).map((a) => {
      // funding.accounts is keyed off the balance rows, so every account with
      // a balance has an entry. An account with no contributions has
      // committed 0.
      const f = funding.accounts.get(a.id);
      return {
        accountId: a.id,
        type: a.type,
        balance: f?.balance ?? Number((balances ?? []).find((b) => b.account_id === a.id)?.balance ?? 0),
        committed: f?.committed ?? 0,
        currency: a.currency,
      };
    }),
    cards: (cards ?? []).map((c) => ({
      accountId: c.account_id ?? "",
      name: acctById.get(c.account_id ?? "")?.name ?? "",
      currency: c.currency ?? baseCurrency,
      statementBalance: c.latest_statement_balance,
      owed: c.owed,
      paidSinceStatement: cardPaid.get(c.account_id ?? "") ?? 0,
      minimumPayment: c.latest_minimum_payment,
    })),
    loans: loanDue.map(({ row: l, due }) => dueInput(due, l.currency ?? baseCurrency)),
    subscriptions: subDue.map(({ row: s, due }) => dueInput(due, s.currency)),
    fxUnconverted,
  });

  return {
    hasAccounts: (accounts ?? []).length > 0,
    baseCurrency,
    displayName: profile?.display_name ?? null,
    netWorth,
    monthIncome: Number(cashflow?.income ?? 0),
    monthExpense: Number(cashflow?.expense ?? 0),
    totalBudget: usageRows.reduce((s, u) => s + Number(u.budget ?? 0), 0),
    totalUsed: usageRows.reduce((s, u) => s + Number(u.used ?? 0), 0),
    // `outgoing`, not every template: a transfer between two of your own
    // accounts costs you nothing. Same list the hero and the upcoming rail read.
    monthlyRecurringExpenses: monthlyTotal(outgoing.filter((s) => s.kind === "expense")),
    monthlyRecurringCardPayments: monthlyTotal(outgoing.filter((s) => s.kind === "payment")),
    monthlyRecurringIncome: monthlyTotal((subs ?? []).filter((s) => s.kind === "income")),
    upcoming: upcoming.slice(0, 6),
    importPrompt: importPromptState(cards ?? []),
    fxUnconverted,
    period,
    available,
  };
}
