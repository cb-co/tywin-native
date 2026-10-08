import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { Bell } from "~/components/ui/icons";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { enableReminders, usePermission } from "~/components/settings/reminder-rows";
import { setReminderPrefs, useReminderPrefs } from "~/lib/reminders/prefs";
import { useColors } from "~/theme/theme";

/**
 * The one-time ask for payment reminders, shown only once there is something
 * to be reminded about, and never again after either answer: Settings keeps
 * the switch for a change of mind. Asking at launch, before the person has a
 * card or a loan in the app, is how a permission gets refused for good.
 */
export function RemindersCallout({ hasSomethingDue }: { hasSomethingDue: boolean }) {
  const t = useTranslations("Overview");
  const c = useColors();
  const p = useReminderPrefs();
  const permission = usePermission();
  const [pending, setPending] = useState(false);

  if (!hasSomethingDue || p.asked || p.enabled || permission === null || permission === "denied") return null;

  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: c.ink, paddingLeft: 16 }}>
      <Text size="base" weight={500}>
        {t("remindersAskTitle")}
      </Text>
      <Text size="sm" tone="muted" style={{ marginTop: 4, maxWidth: 448 }}>
        {t("remindersAskBody")}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Button
          icon={Bell}
          isLoading={pending}
          disabled={pending}
          onPress={() => {
            setPending(true);
            void enableReminders().finally(() => setPending(false));
          }}
        >
          {t("remindersAskEnable")}
        </Button>
        <Button variant="ghost" disabled={pending} onPress={() => setReminderPrefs({ asked: true })}>
          {t("remindersAskLater")}
        </Button>
      </View>
    </View>
  );
}
