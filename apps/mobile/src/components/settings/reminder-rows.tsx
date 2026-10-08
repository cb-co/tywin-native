import { useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import { REMINDER_KINDS, type ReminderKind } from "@cigua/core/notifications/plan";
import { getPermission, requestPermission, type Permission } from "~/lib/reminders/native";
import { setReminderPrefs, useReminderPrefs } from "~/lib/reminders/prefs";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";

type RowProps = { title: string; description: string; children: React.ReactNode; inline?: boolean; last?: boolean };

const KIND_COPY = {
  cards: ["reminderCardsTitle", "reminderCardsDescription"],
  loans: ["reminderLoansTitle", "reminderLoansDescription"],
  recurring: ["reminderRecurringTitle", "reminderRecurringDescription"],
  statements: ["reminderStatementsTitle", "reminderStatementsDescription"],
  bonus: ["reminderBonusTitle", "reminderBonusDescription"],
  payday: ["reminderPaydayTitle", "reminderPaydayDescription"],
} as const satisfies Record<ReminderKind, readonly [string, string]>;

/** Morning to night; nobody wants a payment reminder at 3am. */
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

/** The permission as the phone holds it now — rechecked on every return to the
 *  app, since it can only be changed back in the phone's settings. */
export function usePermission(): Permission | null {
  const [permission, setPermission] = useState<Permission | null>(null);
  useEffect(() => {
    const check = () => void getPermission().then(setPermission).catch(() => {});
    check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => sub.remove();
  }, []);
  return permission;
}

/** Switches reminders on, asking the phone first. Resolves to whether they are on. */
export async function enableReminders(): Promise<boolean> {
  const granted = (await requestPermission()) === "granted";
  setReminderPrefs({ enabled: granted, asked: true });
  return granted;
}

/**
 * Settings' reminder rows: the main switch, then — once on — when they arrive
 * and which kinds. The settings table's own `Row` draws them, so they read as
 * part of it.
 */
export function ReminderRows({ Row }: { Row: (p: RowProps) => React.ReactNode }) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const p = useReminderPrefs();
  const permission = usePermission();
  const [pending, setPending] = useState(false);
  const denied = permission === "denied";
  const on = p.enabled && permission === "granted";
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <Row inline title={t("remindersTitle")} description={denied ? t("remindersDenied") : t("remindersDescription")}>
        {denied ? (
          <Button variant="outline" size="sm" onPress={() => void Linking.openSettings()}>
            {t("remindersOpenSettings")}
          </Button>
        ) : (
          <Switch
            checked={on}
            disabled={pending}
            accessibilityLabel={t("remindersTitle")}
            onCheckedChange={(next) => {
              if (!next) return setReminderPrefs({ enabled: false, asked: true });
              setPending(true);
              void enableReminders().finally(() => setPending(false));
            }}
          />
        )}
      </Row>
      {on ? (
        <>
          <Row inline title={t("remindersHourTitle")} description={t("remindersHourDescription")}>
            <View style={{ minWidth: 112 }}>
              <Select
                value={String(p.hour)}
                title={t("remindersHourTitle")}
                accessibilityLabel={t("remindersHourTitle")}
                onValueChange={(v) => setReminderPrefs({ hour: Number(v) })}
                options={HOURS.map((h) => ({ value: String(h), label: time.format(new Date(2026, 0, 1, h)) }))}
              />
            </View>
          </Row>
          {REMINDER_KINDS.map((kind) => {
            const [title, description] = KIND_COPY[kind];
            return (
              <Row key={kind} inline title={t(title)} description={t(description)}>
                <Switch
                  checked={p.kinds[kind]}
                  accessibilityLabel={t(title)}
                  onCheckedChange={(v) => setReminderPrefs({ kinds: { ...p.kinds, [kind]: v } })}
                />
              </Row>
            );
          })}
        </>
      ) : null}
    </>
  );
}

