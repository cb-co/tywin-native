import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "use-intl";
import type { AccountWithStatus, BankRow, CardGroupSibling, CurrencyRow } from "@cigua/worker/api";
import { formatDate } from "@cigua/core/format";
import { accountResolver, blankToUndefined, normalizeFormValues, type AccountFormValues } from "@cigua/core/accounts/form-values";
import { isCard, isLoan, hasTransferFees, type AccountType } from "@cigua/core/accounts/meta";
import { cardLineName, cardLineSpecs } from "@cigua/core/accounts/card-lines";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input, Label } from "~/components/ui/field";
import { FieldRow, FormDate, FormSelect, FormSwitch, FormText, Half } from "~/components/ui/form";
import { Sheet } from "~/components/ui/overlay";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { makeStyles } from "~/theme/theme";

type FormValues = AccountFormValues;

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function defaultsFor(
  account: AccountWithStatus | undefined,
  baseCurrency: string,
  effectiveBonus: CardGroupSibling | null | undefined,
  initialType: AccountType | undefined,
  anchored: boolean,
): FormValues {
  const bonus =
    effectiveBonus ??
    (account
      ? {
          welcome_bonus_goal_amount: account.welcome_bonus_goal_amount,
          welcome_bonus_goal_currency: account.welcome_bonus_goal_currency,
          welcome_bonus_due_date: account.welcome_bonus_due_date,
        }
      : null);
  return {
    name: account?.name ?? "",
    type: (account?.type as AccountType) ?? initialType ?? "checking",
    currency: account?.currency ?? baseCurrency,
    bank_id: account?.bank_id ?? "none",
    starting_balance: str(account?.starting_balance) || "0",
    transfer_tax_rate: str(account?.transfer_tax_rate) || "0.002",
    network_fee_amount: str(account?.network_fee_amount) || "0",
    network_fee_optional: account?.network_fee_optional ?? true,
    credit_limit: str(account?.credit_limit),
    last4: account?.last4 ?? "",
    statement_closing_day: str(account?.statement_closing_day),
    payment_due_day: str(account?.payment_due_day),
    current_balance: str(account?.current_balance) || "0",
    // Carried, never shown: keeps an already-grouped card pointed at its group through an edit.
    card_group_id: account?.card_group_id ?? "",
    // Structure is a create-time question: an existing card's lines already exist.
    is_multi_currency: false,
    has_installments: false,
    usd_credit_limit: "",
    usd_current_balance: "0",
    installments_credit_limit: "",
    installments_current_balance: "0",
    welcome_bonus_goal_amount: str(bonus?.welcome_bonus_goal_amount),
    // Blank, not guessed: an offer is denominated in whatever the issuer wrote it in.
    welcome_bonus_goal_currency: bonus?.welcome_bonus_goal_currency ?? "",
    welcome_bonus_due_date: bonus?.welcome_bonus_due_date ?? "",
    has_welcome_bonus_goal: bonus?.welcome_bonus_goal_amount != null,
    balance_is_anchored: anchored,
    principal: str(account?.principal),
    interest_rate: str(account?.interest_rate),
    term_months: str(account?.term_months),
    original_term_months: str(account?.original_term_months),
    start_date: account?.start_date ?? "",
    installment_amount: str(account?.installment_amount),
  };
}

/**
 * Add or edit an account. On create the type is chosen before this opens and is
 * never asked again; a card answers two questions (installments, multi-currency)
 * and its group, lines and currencies follow. A card with a statement has no
 * editable balance: the statement owns it.
 */
export function AccountFormSheet({
  mode,
  account,
  currencies,
  banks,
  baseCurrency = "USD",
  effectiveBonus,
  anchoredTo,
  initialType,
  open,
  onClose,
}: {
  mode: "create" | "edit";
  account?: AccountWithStatus;
  currencies: CurrencyRow[];
  banks: BankRow[];
  baseCurrency?: string;
  effectiveBonus?: CardGroupSibling | null;
  anchoredTo?: string | null;
  initialType?: AccountType;
  open: boolean;
  onClose: () => void;
}) {
  const s = useStyles();
  const [pending, setPending] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const anchored = mode === "edit" && !!anchoredTo && account?.type === "credit_card";
  const t = useTranslations("AccountForm");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const { playSuccess, playError } = useFeedback();

  const { handleSubmit, control, reset } = useForm<FormValues>({
    resolver: accountResolver(),
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus, initialType, anchored),
  });

  const type = (useWatch({ control, name: "type" }) ?? "checking") as AccountType;
  const bankSel = useWatch({ control, name: "bank_id" }) ?? "none";
  const hasBonusGoal = useWatch({ control, name: "has_welcome_bonus_goal" }) ?? false;
  const multiCurrency = useWatch({ control, name: "is_multi_currency" }) ?? false;
  const installments = useWatch({ control, name: "has_installments" }) ?? false;
  const currencySel = useWatch({ control, name: "currency" }) ?? baseCurrency;
  const nameSel = useWatch({ control, name: "name" }) ?? "";
  const card = isCard(type);
  const loan = isLoan(type);

  const lineSpecs = card && mode === "create" ? cardLineSpecs({ multiCurrency, installments, currency: currencySel }) : [];
  const grouped = lineSpecs.length > 0;

  const currencyOptions = currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
  const bankOptions = [
    { value: "none", label: t("noBank") },
    ...banks.map((b) => ({ value: b.id, label: b.name })),
    { value: "new", label: t("newBank") },
  ];

  // Every open starts from the account as it is now.
  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(account, baseCurrency, effectiveBonus, initialType, anchored));
    setNewBankName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      let bankId = values.bank_id;
      if (bankId === "new") {
        if (!newBankName.trim()) {
          toast.error(t("toastNameBankOrNone"));
          playError();
          return;
        }
        const created = await act("accounts", "createBank", newBankName.trim());
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        bankId = created.id!;
      }
      const normalizedBank = bankId === "none" || bankId === "new" ? "" : bankId;
      const clean = blankToUndefined({ ...normalizeFormValues(values), bank_id: normalizedBank });
      const field = (name: keyof FormValues) => (clean as Record<string, unknown>)[name];

      const specs =
        mode === "create" && values.type === "credit_card"
          ? cardLineSpecs({ multiCurrency: values.is_multi_currency, installments: values.has_installments, currency: values.currency })
          : [];

      if (specs.length > 0) {
        const cardName = values.name.trim();
        // One physical card: everything but the money is shared across its lines.
        const lines = specs.map((spec) => ({
          ...clean,
          name: cardLineName(cardName, spec, t("lineInstallments")),
          currency: spec.currency,
          credit_limit: field(spec.limitField),
          current_balance: field(spec.balanceField) ?? 0,
          card_group_id: "",
        }));
        const created = await act("accounts", "createCardWithLines", cardName, lines as never);
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        toast.success(t("toastCardAdded"));
        playSuccess();
        onClose();
        return;
      }

      const result =
        mode === "create"
          ? await act("accounts", "createAccount", clean as never)
          : await act("accounts", "updateAccount", account!.id, clean as never);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAccountAdded") : t("toastAccountUpdated"));
      playSuccess();
      onClose();
    } catch {
      toast.error(tc("errorGeneric"));
      playError();
    } finally {
      setPending(false);
    }
  }

  /* One field, two homes: a loan wants the currency beside the principal ("10,000 what?"). */
  const currencyField = (
    <FormSelect
      control={control}
      name="currency"
      label={t("currencyLabel")}
      required
      options={currencyOptions}
      disabled={mode === "edit"}
      hint={mode === "edit" ? t("currencyLockedHint") : undefined}
    />
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("addTitleForType", { type }) : t("editTitle")}
      description={card ? t("descriptionCard") : loan ? t("descriptionLoan") : t("descriptionOther")}
      footer={
        <Button disabled={pending} isLoading={pending} onPress={handleSubmit(onSubmit)}>
          {pending ? tc("saving") : mode === "create" ? t("addAccountButton") : t("saveChangesButton")}
        </Button>
      }
    >
      <FormText control={control} name="name" label={t("nameLabel")} required placeholder={t("namePlaceholderForType", { type })} />

      {type !== "cash" ? (
        <View style={{ gap: 8 }}>
          <FormSelect control={control} name="bank_id" label={t("bankLabel")} options={bankOptions} hint={t("bankHint")} />
          {bankSel === "new" ? <Input placeholder={t("bankNamePlaceholder")} value={newBankName} onChangeText={setNewBankName} /> : null}
        </View>
      ) : null}

      {card ? (
        // Digits that identify rather than count: leading zeroes matter.
        <FormText
          control={control}
          name="last4"
          label={t("last4Label")}
          placeholder={t("last4Placeholder")}
          keyboardType="number-pad"
          maxLength={4}
          transform={(v) => v.replace(/\D/g, "").slice(0, 4)}
        />
      ) : null}

      {/* A multi-currency card's lines are the fixed DOP + USD pair: no currency to ask. */}
      {loan || (grouped && multiCurrency) ? null : currencyField}

      {!card && !loan ? <FormText control={control} name="starting_balance" label={t("startingBalanceLabel")} numeric keyboardType="numbers-and-punctuation" /> : null}

      {card ? (
        <>
          {/* A grouped card's limit and balance live on each line, or the same debt would count twice. */}
          {grouped ? null : (
            <>
              {anchored ? (
                <Field label={t("currentBalanceOwedLabel")}>
                  <Text size="xs" tone="muted" style={s.muted}>
                    {t("balanceAnchoredHint", { date: formatDate(anchoredTo!, locale) })}
                  </Text>
                </Field>
              ) : (
                <FormText control={control} name="current_balance" label={t("currentBalanceOwedLabel")} numeric />
              )}
              <FormText control={control} name="credit_limit" label={t("creditLimitLabel")} required numeric />
            </>
          )}
          <FieldRow>
            <Half>
              <FormText control={control} name="statement_closing_day" label={t("statementClosingDayLabel")} required integer maxLength={2} />
            </Half>
            <Half>
              <FormText control={control} name="payment_due_day" label={t("paymentDueDayLabel")} required integer maxLength={2} />
            </Half>
          </FieldRow>

          {mode === "create" ? (
            <View style={s.panel}>
              <FormSwitch control={control} name="has_installments" label={t("installmentsToggleLabel")} muted={false} />
              <FormSwitch control={control} name="is_multi_currency" label={t("multiCurrencyToggleLabel")} muted={false} />
              {grouped ? (
                <View style={s.lines}>
                  <Text size="sm" weight={500}>
                    {t("cardLinesHeading")}
                  </Text>
                  {lineSpecs.map((spec) => {
                    const suffix = spec.key === "installments" ? t("lineInstallments") : spec.currency;
                    return (
                      <View key={spec.key} style={s.line}>
                        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                          {/* The name this line will be saved under, live. */}
                          <Text size="sm" weight={500} numberOfLines={1} style={{ flex: 1 }}>
                            {nameSel.trim() ? cardLineName(nameSel.trim(), spec, suffix) : suffix}
                          </Text>
                          {spec.key === "installments" ? (
                            <Text size="xs" weight={500} tone="muted">
                              {spec.currency}
                            </Text>
                          ) : null}
                        </View>
                        <FieldRow>
                          <Half>
                            <FormText control={control} name={spec.limitField} label={t("creditLimitLabel")} required numeric />
                          </Half>
                          <Half>
                            <FormText control={control} name={spec.balanceField} label={t("currentBalanceOwedLabel")} numeric />
                          </Half>
                        </FieldRow>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              <Text size="xs" tone="muted">
                {grouped ? t("cardStructureGroupedHint") : t("cardStructureHint")}
              </Text>
            </View>
          ) : null}

          <View style={s.panel}>
            <FormSwitch control={control} name="has_welcome_bonus_goal" label={t("welcomeBonusToggleLabel")} muted={false} />
            {hasBonusGoal ? (
              <>
                <FormText control={control} name="welcome_bonus_goal_amount" label={t("welcomeBonusGoalAmountLabel")} required numeric />
                <FormSelect
                  control={control}
                  name="welcome_bonus_goal_currency"
                  label={t("welcomeBonusGoalCurrencyLabel")}
                  required
                  options={currencyOptions}
                  placeholder={t("welcomeBonusGoalCurrencyPlaceholder")}
                />
                <FormDate control={control} name="welcome_bonus_due_date" label={t("welcomeBonusDueDateLabel")} required />
              </>
            ) : null}
            <Text size="xs" tone="muted">
              {t("welcomeBonusHint")}
            </Text>
          </View>
        </>
      ) : null}

      {loan ? (
        <>
          <Text size="xs" tone="muted" style={s.muted}>
            {t("loanHint")}
          </Text>
          {currencyField}
          <FormText control={control} name="principal" label={t("principalLabel")} required numeric />
          <FormText control={control} name="interest_rate" label={t("interestRateLabel")} numeric placeholder={t("interestRatePlaceholder")} />
          <FieldRow>
            <Half>
              <FormText control={control} name="term_months" label={t("termMonthsLabel")} required integer />
            </Half>
            <Half>
              <FormText control={control} name="original_term_months" label={t("originalTermMonthsLabel")} integer placeholder={t("originalTermPlaceholder")} />
            </Half>
          </FieldRow>
          <FormText control={control} name="installment_amount" label={t("installmentAmountLabel")} required numeric />
          <FieldRow>
            <Half>
              <FormText control={control} name="payment_due_day" label={t("paymentDueDayLabel")} integer maxLength={2} />
            </Half>
            <Half>
              <FormDate control={control} name="start_date" label={t("startDateLabel")} />
            </Half>
          </FieldRow>
        </>
      ) : null}

      {/* Only bank and investment accounts move money by wire/ACH, which can carry a tax or fee. */}
      {hasTransferFees(type) ? (
        <View style={s.panel}>
          <Label>{t("transferFeesHeading")}</Label>
          <FieldRow>
            <Half>
              <FormText control={control} name="transfer_tax_rate" label={t("taxRateLabel")} numeric placeholder={t("taxRatePlaceholder")} />
            </Half>
            <Half>
              <FormText control={control} name="network_fee_amount" label={t("networkFeeLabel")} numeric />
            </Half>
          </FieldRow>
          <FormSwitch control={control} name="network_fee_optional" label={t("networkFeeOptionalLabel")} />
        </View>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  panel: {
    gap: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.muted,
    padding: 16,
  },
  lines: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 12 },
  line: { gap: 8, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.background, padding: 12 },
  muted: { borderRadius: 6, backgroundColor: c.muted, padding: 12 },
}));
