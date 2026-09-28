import { useState } from "react";
import { View } from "react-native";
import { Banknote } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { SEMIMONTHLY_MAX_ANCHOR, semimonthlyStarts } from "@cigua/core/period/cycle";
import { SWATCHES } from "@cigua/core/palette";
import { act } from "~/lib/query";
import { Field, Input } from "~/components/ui/field";
import { FieldRow, Half } from "~/components/ui/form";
import { Select } from "~/components/ui/select";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { MoneyDisplay } from "~/components/money/money-display";
import { useColors } from "~/theme/theme";
import { AccountSelect, ChoiceCard, SavedRow, StepFooter, StepHeading, refreshWelcome } from "./parts";
import { isMainAccount, type StepProps } from "./types";

const CHOICES = ["semimonthly", "monthly", "weekly", "irregular"] as const;
type Choice = (typeof CHOICES)[number];

const CHOICE_KEYS = {
  semimonthly: ["incomeSemimonthly", "incomeSemimonthlyHint"],
  monthly: ["incomeMonthly", "incomeMonthlyHint"],
  weekly: ["incomeWeekly", "incomeWeeklyHint"],
  irregular: ["incomeIrregular", "incomeIrregularHint"],
} as const;

/* Monday first, valued in the subscriptions table's Sunday=1..Saturday=7 scheme
   (the one nextChargeDate reads); the pay-cycle sync converts it to ISO. */
const WEEKDAYS = [
  { value: 2, key: "weekdayMonday" },
  { value: 3, key: "weekdayTuesday" },
  { value: 4, key: "weekdayWednesday" },
  { value: 5, key: "weekdayThursday" },
  { value: 6, key: "weekdayFriday" },
  { value: 7, key: "weekdaySaturday" },
  { value: 1, key: "weekdaySunday" },
] as const;

/**
 * "When are you paid?", answered with a recurring income template: the income
 * baseline and, through the pay-cycle sync, the budget period. Irregular earners
 * get calendar-month budgets and no template.
 */
export function StepIncome({ data, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const tSettings = useTranslations("Settings");
  const c = useColors();
  const [pending, setPending] = useState(false);
  const accounts = data.accounts.filter(isMainAccount);
  const [choice, setChoice] = useState<Choice>("semimonthly");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [day, setDay] = useState("30");
  const [weekday, setWeekday] = useState(6);
  // The 15th and the 30th: how most quincenas are paid here.
  const [firstPayday, setFirstPayday] = useState(String(SEMIMONTHLY_MAX_ANCHOR));
  const firstPaydayValid = Number.isInteger(Number(firstPayday)) && Number(firstPayday) >= 1 && Number(firstPayday) <= SEMIMONTHLY_MAX_ANCHOR;

  const cycleLabel = (cycle: string) =>
    cycle === "semimonthly" ? t("incomeSemimonthly") : cycle === "monthly" ? t("incomeMonthly") : cycle === "weekly" ? t("incomeWeekly") : undefined;

  const account = accounts.find((a) => a.id === accountId);
  const existing = data.income;
  const valid =
    choice === "irregular" ||
    (Number(amount) > 0 &&
      !!account &&
      (choice !== "monthly" || (Number(day) >= 1 && Number(day) <= 31)) &&
      (choice !== "semimonthly" || firstPaydayValid));

  async function submit() {
    if (existing) return onNext();
    if (!valid || pending) return;
    setPending(true);
    try {
      const r =
        choice === "irregular"
          ? await act("settings", "setPayCycle", { cycle: "monthly", anchorDay: 1 })
          : await act("recurring", "createSubscription", {
              kind: "income",
              name: t("incomeDefaultName"),
              amount: Number(amount),
              currency: account!.currency,
              billing_cycle: choice,
              anchor_day: choice === "monthly" ? Number(day) : choice === "weekly" ? weekday : Number(firstPayday),
              account_id: account!.id,
              is_active: true,
            });
      if (r.error) return void toast.error(r.error);
      await refreshWelcome();
      onNext();
    } finally {
      setPending(false);
    }
  }

  if (existing) {
    return (
      <>
        <View style={{ gap: 20 }}>
          <StepHeading title={t("incomeTitle")} body={t("incomeBody")} />
          <SavedRow
            icon={Banknote}
            color={SWATCHES[0]}
            title={existing.name}
            subtitle={cycleLabel(existing.billing_cycle)}
            trailing={<MoneyDisplay amount={existing.amount} currency={existing.currency} size="inline" />}
          />
        </View>
        <StepFooter onBack={onBack} primary={{ label: t("continueButton"), onPress: onNext }} />
      </>
    );
  }

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("incomeTitle")} body={t("incomeBody")} />
        <View accessibilityRole="radiogroup" accessibilityLabel={t("incomeTitle")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CHOICES.map((k) => (
            <ChoiceCard key={k} on={choice === k} title={t(CHOICE_KEYS[k][0])} hint={t(CHOICE_KEYS[k][1])} onPress={() => setChoice(k)} />
          ))}
        </View>

        {choice === "irregular" ? (
          <View style={{ borderRadius: 6, backgroundColor: c.muted, padding: 12 }}>
            <Text size="xs" tone="muted">
              {t("incomeIrregularNote")}
            </Text>
          </View>
        ) : (
          <>
            <Field label={t("incomeAmountLabel")} hint={t("incomeAmountHint")}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Input value={amount} placeholder="0.00" keyboardType="decimal-pad" figure onChangeText={setAmount} style={{ flex: 1 }} />
                {/* The deposit account decides the currency: shown, not picked. */}
                <Text size="sm" weight={500} tone="muted">
                  {account?.currency}
                </Text>
              </View>
            </Field>
            <FieldRow>
              <Half>
                <Field label={t("incomeAccountLabel")}>
                  <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} label={t("incomeAccountLabel")} />
                </Field>
              </Half>
              <Half>
                {choice === "monthly" ? (
                  <Field label={t("incomeDayLabel")}>
                    <Input value={day} keyboardType="number-pad" figure onChangeText={setDay} />
                  </Field>
                ) : choice === "semimonthly" ? (
                  <Field
                    label={t("incomePaydaysLabel")}
                    hint={firstPaydayValid ? t("incomeSecondPayday", { second: semimonthlyStarts(Number(firstPayday))[1] }) : tSettings("payCycleSemimonthlyRange")}
                  >
                    <Input value={firstPayday} keyboardType="number-pad" figure onChangeText={setFirstPayday} />
                  </Field>
                ) : (
                  <Field label={t("incomeWeekdayLabel")}>
                    <Select
                      value={String(weekday)}
                      onValueChange={(v) => setWeekday(Number(v))}
                      title={t("incomeWeekdayLabel")}
                      options={WEEKDAYS.map((w) => ({ value: String(w.value), label: tSettings(w.key) }))}
                    />
                  </Field>
                )}
              </Half>
            </FieldRow>
          </>
        )}
      </View>
      <StepFooter
        onBack={onBack}
        skip={{ label: t("skipButton"), onPress: onNext }}
        primary={{ label: t("continueButton"), onPress: () => void submit(), disabled: !valid, pending }}
      />
    </>
  );
}
