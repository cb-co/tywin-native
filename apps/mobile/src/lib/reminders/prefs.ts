import { useSyncExternalStore } from "react";
import {
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_KINDS,
  REMINDER_KINDS,
  type ReminderKind,
} from "@cigua/core/notifications/plan";
import { prefs } from "../storage";

/**
 * Payment reminders are a setting of this phone, not of the account: they are
 * scheduled here, so they are switched on here. Kept in the same on-device
 * store as the theme and the figure mask.
 */
export type ReminderPrefs = {
  enabled: boolean;
  /** Whether the person has answered the one-time ask on Overview, either way. */
  asked: boolean;
  kinds: Record<ReminderKind, boolean>;
  /** Local hour, 0–23. */
  hour: number;
};

const KEY = "cigua:reminders";

function load(): ReminderPrefs {
  const fallback: ReminderPrefs = { enabled: false, asked: false, kinds: { ...DEFAULT_REMINDER_KINDS }, hour: DEFAULT_REMINDER_HOUR };
  try {
    const raw = prefs.get(KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<ReminderPrefs>;
    // Kinds added in a later release start at their default, not off.
    const kinds = { ...DEFAULT_REMINDER_KINDS };
    for (const k of REMINDER_KINDS) if (typeof saved.kinds?.[k] === "boolean") kinds[k] = saved.kinds[k];
    return {
      enabled: saved.enabled === true,
      asked: saved.asked === true,
      kinds,
      hour: Number.isInteger(saved.hour) && saved.hour! >= 0 && saved.hour! <= 23 ? saved.hour! : DEFAULT_REMINDER_HOUR,
    };
  } catch {
    return fallback;
  }
}

let state = load();
const listeners = new Set<() => void>();

export function getReminderPrefs(): ReminderPrefs {
  return state;
}

export function setReminderPrefs(patch: Partial<ReminderPrefs>): void {
  state = { ...state, ...patch, kinds: { ...state.kinds, ...patch.kinds } };
  prefs.set(KEY, JSON.stringify(state));
  for (const l of listeners) l();
}

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
