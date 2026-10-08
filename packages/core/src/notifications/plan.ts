/**
 * Payment reminders, planned. The Worker says what is still to pay (the
 * `reminders` screen, built on the same rules as Overview's Upcoming list and
 * the Accounts attention ledger); this decides which notifications that makes
 * and when. The app writes the words and hands them to the phone.
 *
 * Scheduled on the device, never pushed: every payment, import and recorded
 * charge happens in the app, and the app replans after each refresh, so a
 * reminder for something already logged is cancelled before it fires. No
 * financial detail goes through Apple's or Google's push servers.
 *
 * Pure, so it can be tested without a phone.
 */
import { addDays, periodFor, type PayCycle } from "../period/cycle";
import type { Unpaid } from "../overview/next-unpaid";
import type { BillingCycle } from "../subscriptions/cycle";

export const REMINDER_KINDS = ["cards", "loans", "recurring", "statements", "bonus", "payday"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Payments that cost money when missed are on; the payday note is opt-in. */
export const DEFAULT_REMINDER_KINDS: Record<ReminderKind, boolean> = {
  cards: true,
  loans: true,
  recurring: true,
  statements: true,
  bonus: true,
  payday: false,
};

export const DEFAULT_REMINDER_HOUR = 9;

/** iOS keeps at most 64 pending local notifications and drops the rest
 *  silently. Planning to a few under it keeps the soonest ones guaranteed. */
export const MAX_SCHEDULED = 60;

/** One credit-card line with its minimum still unpaid. Lines of one card (DOP,
 *  USD, cuotas) share a `groupId` and are reminded about together. */
export type CardReminder = {
  accountId: string;
  groupId: string | null;
  name: string;
  currency: string;
  dueDate: string;
  /** Null when the bank printed no minimum; the cutoff balance is then what is due. */
  minimumLeft: number | null;
  statementLeft: number;
};

export type ReminderData = {
  /** The Worker's date, for reference; planning uses the phone's own. */
  today: string;
  cards: CardReminder[];
  /** Next installment still unpaid first, then the ones after it. */
  loans: { accountId: string; name: string; currency: string; due: Unpaid[] }[];
  /** Outgoing recurring payments: next charge not yet recorded first.
   *  `recordable` when one tap can record it — nothing in another currency to
   *  ask. `lastRecorded` is the newest charge recorded from it, which is what
   *  tells a Record tap on an old reminder that the charge is already in. */
  recurring: {
    id: string;
    name: string;
    currency: string;
    cycle: BillingCycle;
    recordable: boolean;
    lastRecorded: string | null;
    due: Unpaid[];
  }[];
  /** A card's closing dates whose statement is not imported yet. */
  statements: { accountId: string; name: string; closings: string[] }[];
  /** Welcome bonuses with spend still to go. */
  bonuses: { accountId: string; name: string; currency: string; dueDate: string; left: number }[];
  payCycle: { cycle: PayCycle; anchorDay: number | null };
};

/** A sum per currency, in the order the currencies first appear. */
export type Amounts = { currency: string; amount: number }[];

type Base = {
  /** Stable across replans, so the same reminder keeps the same identity. */
  id: string;
  /** Local calendar day it fires on; the hour comes from the person's setting. */
  date: string;
};

export type PlannedReminder = Base &
  (
    | { kind: "card-due"; accountId: string; name: string; dueDate: string; toPay: Amounts; statement: Amounts; hasMinimum: boolean }
    | { kind: "card-missed"; accountId: string; name: string; dueDate: string; toPay: Amounts }
    | { kind: "loan"; accountId: string; name: string; dueDate: string; amount: number; currency: string }
    | { kind: "recurring"; subscriptionId: string; name: string; amount: number; currency: string; recordable: boolean }
    | { kind: "statement"; accountId: string; name: string; closing: string }
    | { kind: "bonus"; accountId: string; name: string; dueDate: string; left: number; currency: string }
    | { kind: "payday"; periodEnd: string }
  );

export type ReminderKindOf<K extends PlannedReminder["kind"]> = Extract<PlannedReminder, { kind: K }>;

/** Days before a card's due date the first heads-up goes out; a second one
 *  goes out on the day. */
export const CARD_LEAD_DAYS = 3;
export const LOAN_LEAD_DAYS = 2;
/** Statements are usually published a couple of days after the cutoff. */
export const STATEMENT_LAG_DAYS = 3;
export const BONUS_LEAD_DAYS = [14, 3] as const;

function add(amounts: Amounts, currency: string, amount: number): Amounts {
  const hit = amounts.find((a) => a.currency === currency);
  if (hit) hit.amount += amount;
  else amounts.push({ currency, amount });
  return amounts;
}

/** The card reminders, one per card and due date: a card's currency lines
 *  share a statement date and a payment, so they share a notification. */
function cardReminders(cards: CardReminder[]): PlannedReminder[] {
  const byCard = new Map<string, CardReminder[]>();
  for (const c of cards) {
    const key = `${c.groupId ?? c.accountId}:${c.dueDate}`;
    byCard.set(key, [...(byCard.get(key) ?? []), c]);
  }

  const out: PlannedReminder[] = [];
  for (const [key, lines] of byCard) {
    const first = lines[0];
    const toPay: Amounts = [];
    const statement: Amounts = [];
    for (const l of lines) {
      add(toPay, l.currency, l.minimumLeft ?? l.statementLeft);
      add(statement, l.currency, l.statementLeft);
    }
    const hasMinimum = lines.some((l) => l.minimumLeft != null);
    const common = { accountId: first.accountId, name: first.name, dueDate: first.dueDate };
    for (const lead of [CARD_LEAD_DAYS, 0]) {
      out.push({
        id: `card-due:${key}:${lead}`,
        date: addDays(first.dueDate, -lead),
        kind: "card-due",
        ...common,
        toPay,
        statement,
        hasMinimum,
      });
    }
    out.push({ id: `card-missed:${key}`, date: addDays(first.dueDate, 1), kind: "card-missed", ...common, toPay });
  }
  return out;
}

/** The next paydays, starting today when today is one. */
function paydays(today: string, cycle: PayCycle, anchor: number | null, count: number): string[] {
  const out: string[] = [];
  let start = periodFor(today, cycle, anchor).start;
  if (start < today) start = addDays(periodFor(today, cycle, anchor).end, 1);
  while (out.length < count) {
    out.push(start);
    start = addDays(periodFor(start, cycle, anchor).end, 1);
  }
  return out;
}

/**
 * Every reminder to schedule, soonest first, capped at {@link MAX_SCHEDULED}.
 *
 * `today` and `hourNow` are the phone's: a reminder whose moment has passed is
 * dropped, including one due today at an hour already gone.
 */
export function planReminders(
  data: ReminderData,
  {
    kinds,
    hour,
    today,
    hourNow,
  }: { kinds: Record<ReminderKind, boolean>; hour: number; today: string; hourNow: number },
): PlannedReminder[] {
  const all: PlannedReminder[] = [];

  if (kinds.cards) all.push(...cardReminders(data.cards));

  if (kinds.loans) {
    for (const l of data.loans) {
      for (const d of l.due) {
        all.push({
          id: `loan:${l.accountId}:${d.date}`,
          date: addDays(d.date, -LOAN_LEAD_DAYS),
          kind: "loan",
          accountId: l.accountId,
          name: l.name,
          dueDate: d.date,
          amount: d.amount,
          currency: l.currency,
        });
      }
    }
  }

  if (kinds.recurring) {
    for (const r of data.recurring) {
      for (const d of r.due) {
        all.push({
          id: `recurring:${r.id}:${d.date}`,
          date: d.date,
          kind: "recurring",
          subscriptionId: r.id,
          name: r.name,
          amount: d.amount,
          currency: r.currency,
          recordable: r.recordable,
        });
      }
    }
  }

  if (kinds.statements) {
    for (const s of data.statements) {
      for (const closing of s.closings) {
        all.push({
          id: `statement:${s.accountId}:${closing}`,
          date: addDays(closing, STATEMENT_LAG_DAYS),
          kind: "statement",
          accountId: s.accountId,
          name: s.name,
          closing,
        });
      }
    }
  }

  if (kinds.bonus) {
    for (const b of data.bonuses) {
      for (const lead of BONUS_LEAD_DAYS) {
        all.push({
          id: `bonus:${b.accountId}:${b.dueDate}:${lead}`,
          date: addDays(b.dueDate, -lead),
          kind: "bonus",
          accountId: b.accountId,
          name: b.name,
          dueDate: b.dueDate,
          left: b.left,
          currency: b.currency,
        });
      }
    }
  }

  if (kinds.payday) {
    const { cycle, anchorDay } = data.payCycle;
    for (const day of paydays(today, cycle, anchorDay, 2)) {
      all.push({ id: `payday:${day}`, date: day, kind: "payday", periodEnd: periodFor(day, cycle, anchorDay).end });
    }
  }

  return all
    .filter((r) => r.date > today || (r.date === today && hour > hourNow))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .slice(0, MAX_SCHEDULED);
}
