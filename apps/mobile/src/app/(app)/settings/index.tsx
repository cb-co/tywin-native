import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Check, CircleHelp, LogOut, Moon, Sun, Tag, Trash2 } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { LOCALES, LOCALE_LABEL } from "@cigua/core/i18n/locale";
import { PAY_CYCLE_VALUES, SEMIMONTHLY_MAX_ANCHOR, semimonthlyStarts, type PayCycle } from "@cigua/core/period/cycle";
import { act, useScreen } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { useAppLocale } from "~/lib/i18n";
import { auth } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/field";
import { Dialog } from "~/components/ui/overlay";
import { Screen, ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { Segmented } from "~/components/ui/segmented";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { makeStyles, useTheme } from "~/theme/theme";

const PAY_CYCLE_LABEL_KEY = { monthly: "payCycleMonthly", semimonthly: "payCycleSemimonthly", weekly: "payCycleWeekly" } as const;
const PAY_CYCLE_HELP_KEY = { monthly: "payCycleHelpMonthly", semimonthly: "payCycleHelpSemimonthly", weekly: "payCycleHelpWeekly" } as const;
/** ISO weekday order (Monday = 1), matching `isoWeekday` in core period/cycle. */
const WEEKDAY_KEYS = {
  1: "weekdayMonday",
  2: "weekdayTuesday",
  3: "weekdayWednesday",
  4: "weekdayThursday",
  5: "weekdayFriday",
  6: "weekdaySaturday",
  7: "weekdaySunday",
} as const;
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function Row({ title, description, children, last }: { title: string; description: string; children: React.ReactNode; last?: boolean }) {
  const s = useStyles();
  return (
    <View style={[s.row, last ? null : s.rowRule]}>
      <View style={{ gap: 2 }}>
        <Text size="sm" weight={500}>
          {title}
        </Text>
        <Text size="sm" tone="muted">
          {description}
        </Text>
      </View>
      <View>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { data, refetch, isError } = useScreen("settings");
  if (!data) return isError ? <ScreenError onRetry={() => void refetch()} /> : <ScreenSkeleton />;
  return <SettingsPanel data={data} onRefresh={refetch} />;
}

function SettingsPanel({ data, onRefresh }: { data: ScreenData<"settings">; onRefresh: () => Promise<unknown> }) {
  const t = useTranslations("Settings");
  const tc = useTranslations("Common");
  const tTheme = useTranslations("Theme");
  const s = useStyles();
  const { scheme, toggle } = useTheme();
  const { locale, setLocale } = useAppLocale();
  const { enabled, setEnabled, playSuccess, playError } = useFeedback();
  const { payCycle, payAnchorDay, baseCurrency } = data;

  const [name, setName] = useState(data.displayName ?? "");
  const [savedName, setSavedName] = useState(data.displayName ?? "");
  const [namePending, setNamePending] = useState(false);
  const [currency, setCurrency] = useState(baseCurrency);
  const [currencyPending, setCurrencyPending] = useState(false);
  const [cycle, setCycle] = useState<PayCycle>(payCycle);
  // Each cycle remembers its own anchor, so switching away and back restores it.
  const savedAnchor = (k: PayCycle) => (payCycle === k && payAnchorDay ? payAnchorDay : 1);
  const [monthlyAnchor, setMonthlyAnchor] = useState(savedAnchor("monthly"));
  const [weeklyAnchor, setWeeklyAnchor] = useState(savedAnchor("weekly"));
  const [semimonthlyAnchor, setSemimonthlyAnchor] = useState(savedAnchor("semimonthly"));
  // What is typed, apart from the saved anchor, so a half-typed "1" on the way to "15" is not saved.
  const [semimonthlyDraft, setSemimonthlyDraft] = useState(String(savedAnchor("semimonthly")));
  const [cyclePending, setCyclePending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const nameDirty = name.trim() !== savedName.trim();
  const [semiFirst, semiSecond] = semimonthlyStarts(semimonthlyAnchor);
  const anchors: Record<PayCycle, number> = { monthly: monthlyAnchor, weekly: weeklyAnchor, semimonthly: semimonthlyAnchor };

  async function savePayCycle(nextCycle: PayCycle, next: Record<PayCycle, number>) {
    setCyclePending(true);
    try {
      const result = await act("settings", "setPayCycle", { cycle: nextCycle, anchorDay: next[nextCycle] });
      if (result.error) {
        toast.error(result.error);
        playError();
        // Back to what the server holds.
        setCycle(payCycle);
        setMonthlyAnchor(savedAnchor("monthly"));
        setWeeklyAnchor(savedAnchor("weekly"));
        setSemimonthlyAnchor(savedAnchor("semimonthly"));
        setSemimonthlyDraft(String(savedAnchor("semimonthly")));
        return;
      }
      toast.success(t("toastPayCycleUpdated"));
      playSuccess();
    } finally {
      setCyclePending(false);
    }
  }

  function commitSemimonthlyDraft() {
    const day = Number(semimonthlyDraft);
    if (!Number.isInteger(day) || day < 1 || day > SEMIMONTHLY_MAX_ANCHOR) {
      setSemimonthlyDraft(String(semimonthlyAnchor));
      return;
    }
    if (day === semimonthlyAnchor) return;
    setSemimonthlyAnchor(day);
    void savePayCycle(cycle, { ...anchors, semimonthly: day });
  }

  async function onSaveName() {
    if (!nameDirty) return;
    const next = name.trim();
    setNamePending(true);
    try {
      const result = await act("settings", "updateDisplayName", next);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      setSavedName(next);
      setName(next);
      toast.success(t("toastDisplayNameUpdated"));
      playSuccess();
    } finally {
      setNamePending(false);
    }
  }

  async function onCurrency(code: string) {
    setCurrency(code);
    setCurrencyPending(true);
    try {
      const result = await act("settings", "updateBaseCurrency", code);
      if (result.error) {
        toast.error(result.error);
        playError();
        setCurrency(baseCurrency);
        return;
      }
      toast.success(t("toastCurrencyUpdated"));
      playSuccess();
    } finally {
      setCurrencyPending(false);
    }
  }

  async function onDeleteAccount() {
    setDeletePending(true);
    try {
      const result = await act("settings", "deleteAccount");
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      // The account and its session are gone: signing out clears every saved screen.
      await auth.signOut({ scope: "local" });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <Screen onRefresh={onRefresh} gap={24}>
      <Text size="sm" tone="muted">
        {t("pageDescription")}
      </Text>
      <View style={s.table}>
        <Row title={t("displayNameTitle")} description={t("displayNameDescription")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Input
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoComplete="name"
              textContentType="name"
              editable={!namePending}
              placeholder={t("displayNamePlaceholder")}
              accessibilityLabel={t("displayNameTitle")}
              returnKeyType="done"
              onSubmitEditing={() => void onSaveName()}
              style={{ flex: 1 }}
            />
            {/* The save button only exists once there is something to save. */}
            {nameDirty ? (
              <Button size="sm" icon={Check} onPress={() => void onSaveName()} disabled={namePending} isLoading={namePending}>
                {t("saveButton")}
              </Button>
            ) : null}
          </View>
        </Row>

        <Row title={t("signedInAsTitle")} description={t("signedInAsDescription")}>
          <Text size="sm" tone="muted">
            {data.email || "—"}
          </Text>
        </Row>

        <Row title={t("baseCurrencyTitle")} description={t("baseCurrencyDescription")}>
          <Select
            value={currency}
            onValueChange={(v) => void onCurrency(v)}
            disabled={currencyPending}
            title={t("baseCurrencyTitle")}
            options={data.currencies.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` }))}
          />
        </Row>

        <Row title={t("payCycleTitle")} description={t("payCycleDescription")}>
          <View style={{ gap: 12 }}>
            <Segmented
              stretch
              size="sm"
              value={cycle}
              disabled={cyclePending}
              onChange={(next) => {
                setCycle(next);
                void savePayCycle(next, anchors);
              }}
              items={PAY_CYCLE_VALUES.map((k) => ({ value: k, label: t(PAY_CYCLE_LABEL_KEY[k]) }))}
            />
            {cycle === "monthly" ? (
              <Select
                value={String(monthlyAnchor)}
                disabled={cyclePending}
                title={t("payCycleAnchorDayLabel")}
                accessibilityLabel={t("payCycleAnchorDayLabel")}
                onValueChange={(v) => {
                  const day = Number(v);
                  setMonthlyAnchor(day);
                  void savePayCycle(cycle, { ...anchors, monthly: day });
                }}
                options={MONTH_DAYS.map((day) => ({ value: String(day), label: t("payCycleDayOption", { day }) }))}
              />
            ) : cycle === "semimonthly" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text size="xs" tone="muted">
                  {t("payCycleSemimonthlyAnchorLabel")}
                </Text>
                <Input
                  value={semimonthlyDraft}
                  onChangeText={setSemimonthlyDraft}
                  onEndEditing={commitSemimonthlyDraft}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  editable={!cyclePending}
                  accessibilityLabel={t("payCycleSemimonthlyAnchorLabel")}
                  figure
                  style={{ width: 64, height: 36 }}
                />
              </View>
            ) : (
              <Select
                value={String(weeklyAnchor)}
                disabled={cyclePending}
                title={t("payCycleAnchorWeekdayLabel")}
                accessibilityLabel={t("payCycleAnchorWeekdayLabel")}
                onValueChange={(v) => {
                  const day = Number(v);
                  setWeeklyAnchor(day);
                  void savePayCycle(cycle, { ...anchors, weekly: day });
                }}
                options={WEEKDAYS.map((day) => ({ value: String(day), label: t(WEEKDAY_KEYS[day]) }))}
              />
            )}
            <Text size="xs" tone="muted">
              {t(PAY_CYCLE_HELP_KEY[cycle], { first: semiFirst, second: semiSecond })}
            </Text>
          </View>
        </Row>

        <Row title={t("themeTitle")} description={t("themeDescription")}>
          <Button variant="outline" size="icon" icon={scheme === "dark" ? Moon : Sun} accessibilityLabel={tTheme("toggle")} onPress={toggle} />
        </Row>

        <Row title={t("languageTitle")} description={t("languageDescription")}>
          <Segmented stretch size="sm" value={locale} onChange={setLocale} items={LOCALES.map((l) => ({ value: l, label: LOCALE_LABEL[l] }))} />
        </Row>

        <Row title={t("soundEffectsTitle")} description={t("soundEffectsDescription")}>
          <Switch checked={enabled} onCheckedChange={setEnabled} accessibilityLabel={t("soundEffectsTitle")} />
        </Row>

        <Row title={t("helpTitle")} description={t("helpDescription")}>
          <Button variant="outline" size="sm" icon={CircleHelp} onPress={() => router.push("/help")} style={{ alignSelf: "flex-start" }}>
            {t("helpButton")}
          </Button>
        </Row>

        <Row title={t("rulesTitle")} description={t("rulesDescription")}>
          <Button variant="outline" size="sm" icon={Tag} onPress={() => router.push("/settings/rules")} style={{ alignSelf: "flex-start" }}>
            {t("rulesLink")}
          </Button>
        </Row>

        <Row title={t("sessionTitle")} description={t("sessionDescription")} last>
          <Button variant="outline" size="sm" icon={LogOut} onPress={() => void auth.signOut()} style={{ alignSelf: "flex-start" }}>
            {t("signOutButton")}
          </Button>
        </Row>
      </View>

      <View style={s.danger}>
        <View style={{ gap: 2 }}>
          <Text legend tone="destructive" style={{ fontSize: 11 }}>
            {t("dangerZoneTitle")}
          </Text>
          <Text size="sm" tone="muted">
            {t("deleteAccountDescription")}
          </Text>
        </View>
        <Button variant="destructive" size="sm" icon={Trash2} onPress={() => setDeleteOpen(true)} style={{ alignSelf: "flex-start" }}>
          {t("deleteAccountButton")}
        </Button>
      </View>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        footer={
          <>
            <Button variant="outline" onPress={() => setDeleteOpen(false)} disabled={deletePending}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onPress={() => void onDeleteAccount()} disabled={deletePending} isLoading={deletePending}>
              {deletePending ? t("deleting") : t("deleteAccountButton")}
            </Button>
          </>
        }
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  table: { borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.rule },
  row: { gap: 12, paddingVertical: 20 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  danger: {
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.destructive,
    paddingVertical: 20,
  },
}));
