import { useState } from "react";
import { View } from "react-native";
import { ChevronDown, HandCoins, Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { ACCOUNT_TYPE_META } from "@cigua/core/accounts/meta";
import { estimateRemainingInstallments, loanAccountFromOnboarding, remainingInstallmentsOf, type OnboardingLoan } from "@cigua/core/onboarding/loan";
import { act } from "~/lib/query";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/field";
import { FieldRow, Half } from "~/components/ui/form";
import { todayLocal } from "~/components/ui/date-field";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { MoneyDisplay } from "~/components/money/money-display";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";
import { CurrencySelect, SavedRow, StepFooter, StepHeading, refreshWelcome } from "./parts";
import type { StepProps } from "./types";

const blank = (currency: string): OnboardingLoan => ({
  name: "",
  currency,
  owedToday: "",
  installment: "",
  remainingInstallments: "",
  dueDay: "",
  annualRatePercent: "",
});

/**
 * Loans as real accounts, from what a borrower knows without the contract: what
 * is owed today, the installment, the rate and the due day. Installments left
 * are derived from the rate, and can be typed instead under "more details".
 */
export function StepLoans({ data, currencies, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const c = useColors();
  const [pending, setPending] = useState(false);
  const loans = data.accounts.filter((a) => a.type === "loan");
  const [adding, setAdding] = useState(loans.length === 0);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<OnboardingLoan>(() => blank(baseCurrency));
  const meta = ACCOUNT_TYPE_META.loan;

  const set = (k: keyof OnboardingLoan) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const estimate =
    form.annualRatePercent.trim() === ""
      ? null
      : estimateRemainingInstallments(Number(form.owedToday), Number(form.installment), Number(form.annualRatePercent));
  const overridden = form.remainingInstallments.trim() !== "";
  const valid = !!form.name.trim() && Number(form.owedToday) > 0 && Number(form.installment) > 0 && (remainingInstallmentsOf(form) ?? 0) >= 1;

  async function add() {
    if (!valid || pending) return;
    setPending(true);
    try {
      const r = await act("accounts", "createAccount", loanAccountFromOnboarding(form, todayLocal()));
      if (r.error) return void toast.error(r.error);
      setForm(blank(baseCurrency));
      setMore(false);
      setAdding(false);
      await refreshWelcome();
    } finally {
      setPending(false);
    }
  }

  const numeric = (id: keyof OnboardingLoan, label: string, integer = false, placeholder?: string) => (
    <Field label={label}>
      <Input value={form[id]} onChangeText={set(id)} keyboardType={integer ? "number-pad" : "decimal-pad"} figure placeholder={placeholder} />
    </Field>
  );

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("loansTitle")} body={t("loansBody")} />
        {loans.length ? (
          <View style={{ gap: 8 }}>
            {loans.map((l) => (
              <SavedRow
                key={l.id}
                icon={HandCoins}
                color={meta.color}
                title={l.name}
                subtitle={l.remaining ? t("loanSummary", { count: l.remaining }) : undefined}
                trailing={l.installment ? <MoneyDisplay amount={l.installment} currency={l.currency} size="inline" /> : null}
              />
            ))}
          </View>
        ) : null}

        {adding ? (
          <View style={{ gap: 16, borderRadius: radius.sheet + 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={t("loanNameLabel")}>
                  <Input autoFocus maxLength={80} value={form.name} placeholder={t("loanNamePlaceholder")} onChangeText={set("name")} />
                </Field>
              </View>
              <View style={{ width: 104 }}>
                <Field label={t("loanCurrencyLabel")}>
                  <CurrencySelect value={form.currency} onChange={set("currency")} currencies={currencies} compact label={t("loanCurrencyLabel")} />
                </Field>
              </View>
            </View>
            <FieldRow>
              <Half>{numeric("owedToday", t("loanOwedLabel"))}</Half>
              <Half>{numeric("installment", t("loanInstallmentLabel"))}</Half>
            </FieldRow>
            <FieldRow>
              <Half>{numeric("annualRatePercent", t("loanRateLabel"))}</Half>
              <Half>{numeric("dueDay", t("loanDueDayLabel"), true)}</Half>
            </FieldRow>

            {/* What the rate implies, as it is typed; hidden once a count is typed by hand. */}
            {overridden ? null : estimate === "never" ? (
              <Text size="xs" tone="destructive">
                {t("loanNeverPaysOff")}
              </Text>
            ) : typeof estimate === "number" ? (
              <Text size="xs" tone="muted">
                {t("loanRemainingEstimate", { count: estimate })}
              </Text>
            ) : (
              <Text size="xs" tone="muted">
                {t("loanRateHint")}
              </Text>
            )}

            {more ? (
              <View style={{ gap: 8 }}>
                {numeric("remainingInstallments", t("loanRemainingLabel"), true, typeof estimate === "number" ? String(estimate) : undefined)}
                <Text size="xs" tone="muted">
                  {t("loanRemainingHint")}
                </Text>
              </View>
            ) : (
              <Button variant="ghost" size="sm" icon={ChevronDown} onPress={() => setMore(true)} textColor={c.mutedForeground} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}>
                {t("loanMoreDetails")}
              </Button>
            )}

            <Button onPress={() => void add()} disabled={!valid} isLoading={pending} style={{ alignSelf: "flex-start" }}>
              {t("loanAdd")}
            </Button>
          </View>
        ) : (
          <Button variant="outline" icon={Plus} onPress={() => setAdding(true)} style={{ alignSelf: "flex-start" }}>
            {t("loanAddAnother")}
          </Button>
        )}
      </View>
      <StepFooter
        onBack={onBack}
        primary={loans.length ? { label: t("continueButton"), onPress: onNext } : undefined}
        skip={loans.length ? undefined : { label: t("skipButton"), onPress: onNext }}
      />
    </>
  );
}
