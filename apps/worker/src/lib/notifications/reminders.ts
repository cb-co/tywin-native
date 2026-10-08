/**
 * What the phone should remind about: everything still to pay, in structured
 * form, for `planReminders` (packages/core/src/notifications/plan.ts) to turn
 * into a schedule. The words are written on the phone, in its language and
 * with its figure masking, so none are written here.
 *
 * Built on the same rules as Overview's Upcoming list and the Accounts
 * attention ledger — cardDue, nextUnpaid, isOutgoing — so a reminder can never
 * ask for something those screens already show as paid.
 */
import { createClient } from "#/lib/supabase/server";
import { statementPaymentsByCard } from "#/lib/accounts/card-payments";
import { resolveEffectiveBonus, getWelcomeBonusSpend, type CardGroupSibling } from "#/lib/accounts/welcome-bonus";
import { recentPayments } from "#/lib/overview/queries";
import { isOutgoing } from "#/lib/overview/outgoing";
import { cardDue } from "@cigua/core/overview/card-due";
import { nextUnpaid, occurrencesAfter, type Unpaid } from "@cigua/core/overview/next-unpaid";
import { chargeCrossesCurrency } from "@cigua/core/subscriptions/charge";
import type { BillingCycle, ChargeSchedule } from "@cigua/core/subscriptions/cycle";
import { localDate } from "@cigua/core/period/cycle";
import { payAnchorOf, payCycleOf } from "@cigua/core/period/profile";
import { pendingClosings } from "@cigua/core/notifications/statements";
import type { CardReminder, ReminderData } from "@cigua/core/notifications/plan";

/** How many occurrences of a loan or recurring payment to remind about: the
 *  next unpaid one and the two after it, for a person who does not open the
 *  app every month. Each refresh replans from scratch. */
const OCCURRENCES = 3;

function schedule(next: Unpaid | null, s: ChargeSchedule, amount: number): Unpaid[] {
  return next ? [next, ...occurrencesAfter(s, next.date, amount, OCCURRENCES - 1)] : [];
}

export async function getReminders(): Promise<ReminderData> {
  const supabase = await createClient();
  const today = localDate();

  const [{ data: profile }, { data: accounts }, { data: groups }, { data: cards }, { data: loans }, { data: subs }] =
    await Promise.all([
      supabase.from("profiles").select("pay_cycle,pay_anchor_day").maybeSingle(),
      supabase
        .from("accounts")
        .select(
          "id,name,type,currency,card_group_id,welcome_bonus_goal_amount,welcome_bonus_goal_currency,welcome_bonus_due_date,updated_at",
        )
        .eq("is_archived", false),
      supabase.from("card_groups").select("id,name"),
      supabase
        .from("card_status")
        .select(
          "account_id,currency,owed,latest_statement_balance,latest_due_date,latest_period_end,latest_minimum_payment,statement_closing_day",
        ),
      supabase.from("loan_status").select("account_id,currency,installment_amount,payment_due_day"),
      supabase
        .from("subscriptions")
        .select("id,name,amount,currency,billing_cycle,anchor_day,anchor_date,kind,account_id,to_account_id")
        .eq("is_active", true)
        .in("kind", ["expense", "payment"]),
    ]);

  const acctById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));
  /** A card line is reminded about under its card's name: the group is the physical card. */
  const cardName = (a: { name: string; card_group_id: string | null }) =>
    (a.card_group_id && groupName.get(a.card_group_id)) || a.name;

  const liveCards = (cards ?? []).filter((c) => c.account_id && acctById.has(c.account_id));
  const liveLoans = (loans ?? []).filter((l) => l.account_id && acctById.has(l.account_id));
  const outgoing = (subs ?? []).filter((s) => isOutgoing(s, (id) => acctById.get(id)?.type));

  const [cardPaid, paid] = await Promise.all([
    statementPaymentsByCard(supabase, liveCards),
    recentPayments(
      supabase,
      liveLoans.map((l) => l.account_id!),
      outgoing.map((s) => s.id),
      today,
    ),
  ]);

  /* Cards: every line with a statement whose minimum (or, with none printed,
     whose cutoff balance) is still unpaid. A due date already gone stays in:
     the planner turns it into the missed-payment note. */
  const cardReminders: CardReminder[] = [];
  for (const c of liveCards) {
    const acct = acctById.get(c.account_id!)!;
    if (!c.latest_due_date || c.latest_statement_balance == null) continue;
    const due = cardDue(c.latest_statement_balance, c.owed, cardPaid.get(acct.id) ?? 0, c.latest_minimum_payment);
    if (!due || (due.minimum ?? due.balance) < 0.01) continue;
    cardReminders.push({
      accountId: acct.id,
      groupId: acct.card_group_id,
      name: cardName(acct),
      currency: c.currency ?? acct.currency,
      dueDate: c.latest_due_date,
      minimumLeft: due.minimum,
      statementLeft: due.balance,
    });
  }

  /* Statements: one per physical card. A card with no closing day set uses the
     day its last statement closed on. */
  const statements: ReminderData["statements"] = [];
  const byCard = new Map<string, typeof liveCards>();
  for (const c of liveCards) {
    const acct = acctById.get(c.account_id!)!;
    const key = acct.card_group_id ?? acct.id;
    byCard.set(key, [...(byCard.get(key) ?? []), c]);
  }
  for (const lines of byCard.values()) {
    const latest = lines.map((l) => l.latest_period_end).filter((d): d is string => !!d).sort().at(-1) ?? null;
    const day = lines.find((l) => l.statement_closing_day)?.statement_closing_day ?? (latest ? Number(latest.slice(8, 10)) : null);
    if (!day) continue;
    const acct = acctById.get(lines[0].account_id!)!;
    const closings = pendingClosings(today, day, latest);
    if (closings.length) statements.push({ accountId: acct.id, name: cardName(acct), closings });
  }

  const loanReminders: ReminderData["loans"] = liveLoans.map((l) => {
    const acct = acctById.get(l.account_id!)!;
    const s: ChargeSchedule = { cycle: "monthly", anchorDay: l.payment_due_day };
    const amount = Number(l.installment_amount ?? 0);
    const next = nextUnpaid({ schedule: s, amount, payments: paid.loans.get(acct.id) ?? [], today });
    return { accountId: acct.id, name: acct.name, currency: l.currency ?? acct.currency, due: amount > 0 ? schedule(next, s, amount) : [] };
  });

  const recurring: ReminderData["recurring"] = outgoing.map((sub) => {
    const s: ChargeSchedule = { cycle: sub.billing_cycle as BillingCycle, anchorDay: sub.anchor_day, anchorDate: sub.anchor_date };
    const amount = Number(sub.amount);
    const next = nextUnpaid({
      schedule: s,
      amount,
      payments: (paid.subs.get(sub.id) ?? []).map((date) => ({ date, amount })),
      today,
    });
    const src = sub.account_id ? acctById.get(sub.account_id) : undefined;
    const dst = sub.to_account_id ? acctById.get(sub.to_account_id) : undefined;
    /* One tap records it only when there is nothing to ask: no settled amount
       in another currency, no destination leg in another currency — the same
       test the Recurring screen uses to decide whether to open its sheet. */
    const recordable =
      !!src &&
      !chargeCrossesCurrency(sub.currency, src.currency) &&
      (sub.kind !== "payment" || (!!dst && dst.currency === src.currency));
    const recorded = paid.subs.get(sub.id) ?? [];
    return {
      id: sub.id,
      name: sub.name,
      currency: sub.currency,
      cycle: s.cycle,
      recordable,
      lastRecorded: recorded.length ? recorded.reduce((a, b) => (a > b ? a : b)) : null,
      due: schedule(next, s, amount),
    };
  });

  /* Welcome bonuses: one per card, from the line that carries the goal, with
     the spend still to go. Rare, so the per-card spend query is affordable. */
  const cardAccounts = (accounts ?? []).filter((a) => a.type === "credit_card");
  const bonusCards = new Map<string, CardGroupSibling[]>();
  for (const a of cardAccounts) {
    const key = a.card_group_id ?? a.id;
    bonusCards.set(key, [...(bonusCards.get(key) ?? []), a]);
  }
  const bonuses = (
    await Promise.all(
      [...bonusCards.values()].map(async (lines) => {
        const bonus = resolveEffectiveBonus(lines[0].id, lines);
        if (!bonus || bonus.welcome_bonus_due_date! < today) return null;
        const goalCurrency = bonus.welcome_bonus_goal_currency!;
        const spent = await getWelcomeBonusSpend(supabase, lines, goalCurrency, bonus.welcome_bonus_due_date!);
        const left = Number(bonus.welcome_bonus_goal_amount) - spent;
        const acct = acctById.get(bonus.id)!;
        return left >= 0.01
          ? { accountId: acct.id, name: cardName(acct), currency: goalCurrency, dueDate: bonus.welcome_bonus_due_date!, left }
          : null;
      }),
    )
  ).filter((b) => b !== null);

  return {
    today,
    cards: cardReminders,
    loans: loanReminders,
    recurring,
    statements,
    bonuses,
    payCycle: { cycle: payCycleOf(profile), anchorDay: payAnchorOf(profile) },
  };
}
