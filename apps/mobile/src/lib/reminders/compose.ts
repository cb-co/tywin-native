import type { Href } from "expo-router";
import { formatDate, formatMoney } from "@cigua/core/format";
import type { Amounts, PlannedReminder } from "@cigua/core/notifications/plan";
import { maskFigure } from "~/components/money/figure-mask";

/** The translator for the Notifications namespace, as `useTranslations` returns it. */
type T = (key: string, values?: Record<string, string>) => string;

/** What rides along with a scheduled notification, read back when it is tapped. */
export type ReminderPayload = {
  href: Href;
  kind: PlannedReminder["kind"];
  /** Recurring only: which template, which occurrence, and its name for the toast. */
  subscriptionId?: string;
  date?: string;
  name?: string;
};

export type Composed = {
  id: string;
  date: string;
  title: string;
  body: string;
  /** Recurring only: the category that carries the Record button. */
  category?: string;
  payload: ReminderPayload;
};

export const RECORD_CATEGORY = "cigua-recurring";
export const RECORD_ACTION = "record";

/**
 * The words for one planned reminder, in the app's language. With figures
 * masked, the amounts are masked too: a lock screen is more public than the app.
 */
export function composeReminder(r: PlannedReminder, t: T, locale: string, masked: boolean): Composed {
  const money = (amount: number, currency: string) => {
    const s = formatMoney(amount, currency);
    return masked ? maskFigure(s) : s;
  };
  const sum = (a: Amounts) => a.map((x) => money(x.amount, x.currency)).join(" + ");
  const day = (iso: string) => formatDate(iso, locale, { weekday: "long", month: "short", day: "numeric" });
  const base = { id: r.id, date: r.date };

  switch (r.kind) {
    case "card-due":
      return {
        ...base,
        title: r.date === r.dueDate ? t("cardDueTodayTitle", { name: r.name }) : t("cardDueSoonTitle", { name: r.name, date: day(r.dueDate) }),
        body: r.hasMinimum ? t("cardMinimumBody", { amount: sum(r.toPay), balance: sum(r.statement) }) : t("cardBalanceBody", { amount: sum(r.toPay) }),
        payload: { kind: r.kind, href: `/accounts/${r.accountId}` },
      };
    case "card-missed":
      return {
        ...base,
        title: t("cardMissedTitle", { name: r.name }),
        body: t("cardMissedBody", { amount: sum(r.toPay) }),
        payload: { kind: r.kind, href: `/accounts/${r.accountId}` },
      };
    case "loan":
      return {
        ...base,
        title: t("loanTitle", { name: r.name, date: day(r.dueDate) }),
        body: t("loanBody", { amount: money(r.amount, r.currency) }),
        payload: { kind: r.kind, href: `/accounts/${r.accountId}` },
      };
    case "recurring":
      return {
        ...base,
        title: t("recurringTitle", { name: r.name }),
        body: t("recurringBody", { amount: money(r.amount, r.currency) }),
        category: RECORD_CATEGORY,
        payload: { kind: r.kind, href: "/recurring", subscriptionId: r.subscriptionId, date: r.date, name: r.name },
      };
    case "statement":
      return {
        ...base,
        title: t("statementTitle", { name: r.name }),
        body: t("statementBody"),
        payload: { kind: r.kind, href: { pathname: "/", params: { import: "1" } } },
      };
    case "bonus":
      return {
        ...base,
        title: t("bonusTitle", { name: r.name, date: day(r.dueDate) }),
        body: t("bonusBody", { amount: money(r.left, r.currency) }),
        payload: { kind: r.kind, href: `/accounts/${r.accountId}` },
      };
    case "payday":
      return {
        ...base,
        title: t("paydayTitle"),
        body: t("paydayBody", { date: formatDate(r.periodEnd, locale, { month: "long", day: "numeric" }) }),
        payload: { kind: r.kind, href: "/" },
      };
  }
}
