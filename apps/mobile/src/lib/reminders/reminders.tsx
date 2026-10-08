import { useEffect } from "react";
import { router, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { useLocale, useTranslations } from "use-intl";
import { planReminders } from "@cigua/core/notifications/plan";
import { settlesOccurrence } from "@cigua/core/overview/next-unpaid";
import { localDate } from "@cigua/core/period/cycle";
import { act, keys, queryClient, useScreen } from "../query";
import { loadScreen } from "../api";
import { plainMessage } from "../i18n";
import { prefs } from "../storage";
import { useFigureMask } from "~/components/money/figure-mask";
import { toast } from "~/components/ui/toast";
import { composeReminder, RECORD_ACTION, type ReminderPayload } from "./compose";
import { cancelReminders, getPermission, scheduleReminders } from "./native";
import { useReminderPrefs } from "./prefs";

/**
 * Keeps the phone's reminders in step with the data, and answers when one is
 * tapped. Mounted once in the signed-in shell; renders nothing.
 */
export function Reminders() {
  useReminderSchedule();
  useReminderResponses();
  return null;
}

/**
 * Replans whenever what is due changes. The `reminders` screen refetches on
 * every return to the app and after every write that touches a payment (see
 * AFFECTS in lib/query), so logging a payment cancels its reminder before it
 * fires. Words follow the app's language and figure masking.
 */
function useReminderSchedule() {
  const p = useReminderPrefs();
  const { masked } = useFigureMask();
  const locale = useLocale();
  const t = useTranslations("Notifications");
  const { data } = useScreen("reminders", undefined, { enabled: p.enabled });

  useEffect(() => {
    if (!p.enabled) {
      void cancelReminders();
      return;
    }
    if (!data) return;
    void (async () => {
      if ((await getPermission()) !== "granted") return cancelReminders();
      const now = new Date();
      const plan = planReminders(data, { kinds: p.kinds, hour: p.hour, today: localDate(now), hourNow: now.getHours() });
      const tr = t as unknown as (key: string, values?: Record<string, string>) => string;
      await scheduleReminders(
        plan.map((r) => composeReminder(r, tr, locale, masked)),
        p.hour,
        { channel: t("channelName"), record: t("recordAction") },
      );
    })().catch(() => {});
  }, [data, p, masked, locale, t]);
}

/** Responses already acted on, so a remount does not open the same screen twice. */
const HANDLED_KEY = "cigua:reminders:handled";

function firstTime(key: string): boolean {
  const seen = (prefs.get(HANDLED_KEY) ?? "").split("\n").filter(Boolean);
  if (seen.includes(key)) return false;
  prefs.set(HANDLED_KEY, [...seen.slice(-19), key].join("\n"));
  return true;
}

/**
 * A tap opens the screen the reminder is about. Record, on a recurring charge,
 * records it — unless it is already in, or it settles in another currency and
 * needs the figure only the person knows, in which case the record sheet opens.
 * Works from a cold start: the last response is read once the shell mounts.
 */
function useReminderResponses() {
  const response = Notifications.useLastNotificationResponse();
  const t = useTranslations("Notifications");

  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}:${response.notification.date}`;
    if (!firstTime(key)) return;
    Notifications.clearLastNotificationResponse();

    const payload = response.notification.request.content.data as ReminderPayload | undefined;
    if (!payload?.href) return;
    if (response.actionIdentifier === RECORD_ACTION && payload.subscriptionId && payload.date) {
      void recordFromReminder(payload.subscriptionId, payload.date, (k, v) => t(k, v));
    } else if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push(payload.href);
    }
  }, [response, t]);
}

async function recordFromReminder(
  id: string,
  date: string,
  t: (key: "recorded" | "alreadyRecorded", values: { name: string }) => string,
): Promise<void> {
  const recurring: Href = "/recurring";

  // Fresh, never the saved copy: the question is whether this charge is
  // already in, and the answer may have changed since the reminder fired.
  let sub;
  try {
    const data = await queryClient.fetchQuery({
      queryKey: keys.screen("reminders"),
      queryFn: () => loadScreen("reminders"),
      staleTime: 0,
    });
    sub = data.recurring.find((r) => r.id === id);
  } catch {
    router.navigate(recurring);
    toast.error(plainMessage("App", "needsConnection"));
    return;
  }

  // Settles in another currency: only the person knows what left the account,
  // so the Recurring screen opens its record sheet for this one.
  if (sub && !sub.recordable && !settlesOccurrence(date, sub.cycle, sub.lastRecorded)) {
    router.navigate({ pathname: "/recurring", params: { record: id } });
    return;
  }
  router.navigate(recurring);
  // Deleted or paused since: the Recurring screen shows where it went.
  if (!sub) return;
  if (settlesOccurrence(date, sub.cycle, sub.lastRecorded)) {
    toast.success(t("alreadyRecorded", { name: sub.name }));
    return;
  }
  const result = await act("recurring", "addCharge", id, null);
  if (result.error) toast.error(result.error);
  else toast.success(t("recorded", { name: sub.name }));
}
