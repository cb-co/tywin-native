import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { prefs } from "../storage";
import { RECORD_ACTION, RECORD_CATEGORY, type Composed } from "./compose";

/** Android files every reminder under one channel the person can tune in system settings. */
const CHANNEL = "reminders";
/** What was last handed to the phone, so an unchanged plan is not rescheduled on every refresh. */
const SCHEDULED_KEY = "cigua:reminders:scheduled";

// A reminder that fires while the app is open still shows: it may be about a
// screen other than the one in front of the person.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/* One change to the schedule at a time: two refreshes landing together must not
   interleave one's cancel with the other's scheduling. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

export type Permission = "granted" | "denied" | "undetermined";

function toPermission(p: Notifications.NotificationPermissionsStatus): Permission {
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

export async function getPermission(): Promise<Permission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Asks the system once; after a refusal only the phone's settings can turn them back on. */
export async function requestPermission(): Promise<Permission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return toPermission(current);
  return toPermission(await Notifications.requestPermissionsAsync());
}

/** Drops every scheduled reminder: on sign-out, when switched off, before a replan. */
export function cancelReminders(): Promise<void> {
  return serial(async () => {
    prefs.remove(SCHEDULED_KEY);
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  });
}

/**
 * Replaces the phone's schedule with `reminders`, firing at `hour` local time.
 * A plan identical to the last one scheduled is left alone.
 *
 * The Record button opens the app (`opensAppToForeground`): on iOS a button
 * that runs in the background is dropped once the app has been closed, and a
 * charge recorded half the time is worse than one that takes a tap. Unlocking
 * is required first — it records money.
 */
export function scheduleReminders(
  reminders: Composed[],
  hour: number,
  labels: { channel: string; record: string },
): Promise<void> {
  return serial(() => schedule(reminders, hour, labels));
}

async function schedule(reminders: Composed[], hour: number, labels: { channel: string; record: string }): Promise<void> {
  const signature = JSON.stringify({ hour, labels, reminders });
  if (prefs.get(SCHEDULED_KEY) === signature) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: labels.channel,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(RECORD_CATEGORY, [
    {
      identifier: RECORD_ACTION,
      buttonTitle: labels.record,
      options: { opensAppToForeground: true, isAuthenticationRequired: true },
    },
  ]);

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of reminders) {
    const [y, m, d] = r.date.split("-").map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        data: r.payload,
        ...(r.category ? { categoryIdentifier: r.category } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(y, m - 1, d, hour, 0, 0),
        channelId: CHANNEL,
      },
    });
  }
  prefs.set(SCHEDULED_KEY, signature);
}
