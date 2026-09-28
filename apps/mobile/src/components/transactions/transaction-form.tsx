import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { ChevronDown } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { QuickAddData, TransactionWithRefs } from "@cigua/worker/api";
import { TRANSACTION_TYPES, type TransactionType } from "@cigua/core/transactions/schema";
import { normalizeFormValues, transactionResolver, type TransactionFormValues } from "@cigua/core/transactions/form-values";
import { defaultAccount, feeParts, orderCategories, resolveFeeDefaults } from "@cigua/core/transactions/defaults";
import { accountOptionLabel } from "@cigua/core/accounts/meta";
import { destinationAmount } from "@cigua/core/transactions/money";
import { crossRate } from "@cigua/core/fx";
import { formatMoney } from "@cigua/core/format";
import { act } from "~/lib/query";
import { callAction } from "~/lib/api";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field, FieldError, Input, Label, Textarea } from "~/components/ui/field";
import { Select } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { DateField, todayLocal } from "~/components/ui/date-field";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { CategoryRail } from "./category-rail";
import { AccountDateLine, FeeSummaryLine } from "./summary-lines";
import { useAccountOptions } from "./account-options";
import { face } from "~/theme/fonts";
import { useColors } from "~/theme/theme";

type FormValues = TransactionFormValues;

/** An existing transaction's date, read back timezone-invariant (stored as UTC midnight). */
function toDateOnly(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Add or edit one transaction. `compact` is quick-add's starting state, not a
 * reduced feature set: expanding reveals every field this form has. A row that
 * came from a statement is editable only in its category, notes and budget
 * choices; the issuer owns the rest.
 */
export function TransactionForm({
  data,
  mode = "create",
  transaction,
  defaultAccountId,
  onSuccess,
  compact = false,
}: {
  data: QuickAddData;
  mode?: "create" | "edit";
  transaction?: TransactionWithRefs;
  defaultAccountId?: string;
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const { accounts, categories, budgetGroups, baseCurrency, rates } = data;
  const t = useTranslations("TransactionForm");
  const tType = useTranslations("TransactionTypes");
  const tc = useTranslations("Common");
  const c = useColors();
  const accountOptions = useAccountOptions();
  const isEdit = mode === "edit";
  const { playSuccess, playError } = useFeedback();
  const fromStatement = isEdit && !!transaction?.statement_line_id;
  const [alwaysRule, setAlwaysRule] = useState(false);
  const [expanded, setExpanded] = useState(!compact || fromStatement);
  const [pending, setPending] = useState(false);

  const SOURCE_LABEL: Record<TransactionType, string> = {
    expense: t("sourceLabelExpense"),
    income: t("sourceLabelIncome"),
    payment: t("sourceLabelPayment"),
  };

  const railCategories = orderCategories(categories, data.categoryOrder);
  const firstAccount = defaultAccount(accounts, { preferredId: defaultAccountId, recentAccountId: data.recentAccountId });
  const [transferRateError, setTransferRateError] = useState<string | null>(null);
  const initialFees = resolveFeeDefaults({ type: "expense", src: firstAccount });

  const {
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: transactionResolver() as unknown as Resolver<FormValues, unknown, FormValues>,
    defaultValues: transaction
      ? {
          type: transaction.type as TransactionType,
          account_id: transaction.account_id,
          to_account_id: transaction.to_account_id ?? "",
          category_id: transaction.category_id ?? (transaction.type === "payment" ? "none" : ""),
          amount: String(transaction.amount),
          transfer_rate: transaction.to_amount && transaction.amount ? String(transaction.to_amount / transaction.amount) : "",
          include_tax: transaction.include_tax,
          include_commission: transaction.include_commission,
          exclude_from_budget: transaction.exclude_from_budget,
          budget_group_id: transaction.budget_group_id ?? "none",
          occurred_at: toDateOnly(transaction.occurred_at),
          description: transaction.description ?? "",
          notes: transaction.notes ?? "",
        }
      : {
          type: "expense",
          account_id: firstAccount?.id ?? "",
          to_account_id: "",
          category_id: categories[0]?.id ?? "",
          amount: "",
          transfer_rate: "",
          include_tax: initialFees.include_tax,
          include_commission: initialFees.include_commission,
          exclude_from_budget: false,
          budget_group_id: "none",
          occurred_at: todayLocal(),
          description: "",
          notes: "",
        },
  });

  const type = (useWatch({ control, name: "type" }) ?? "expense") as TransactionType;
  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const toAccountId = useWatch({ control, name: "to_account_id" }) ?? "";
  const amountRaw = useWatch({ control, name: "amount" }) ?? "";
  const transferRateRaw = useWatch({ control, name: "transfer_rate" }) ?? "";
  const categoryId = useWatch({ control, name: "category_id" }) ?? "";
  const occurredAt = useWatch({ control, name: "occurred_at" }) ?? "";

  const src = accounts.find((a) => a.id === accountId);
  const dst = accounts.find((a) => a.id === toAccountId);
  /* The amount's currency is the source account's, for every type: shown, never
     chosen. On edit the stored currency wins; it is immutable in the database. */
  const displayCurrency = (isEdit ? transaction?.currency : src?.currency) ?? baseCurrency;
  /* An edit may only move a row to an account in the same currency. */
  const selectableAccounts = isEdit ? accounts.filter((a) => a.currency === displayCurrency || a.id === accountId) : accounts;

  const crossCurrency = type === "payment" && !!src && !!dst && src.currency !== dst.currency;
  const sameBankPayment = type === "payment" && !!src?.bank_id && !!dst?.bank_id && src.bank_id === dst.bank_id;
  // Transfer tax and network fee model money leaving a bank account by wire/ACH.
  const srcIsBankAccount = src?.type === "checking" || src?.type === "savings";

  /* The budget-group override: only for someone who has groups, never for income. */
  const showGroupOverride = type !== "income" && budgetGroups.length > 0;
  const groupById = new Map(budgetGroups.map((g) => [g.id, g]));
  const inheritedGroup = groupById.get(categories.find((cat) => cat.id === categoryId)?.budget_group_id ?? "");
  const inheritLabel = inheritedGroup
    ? t("budgetGroupInheritNamed", { group: `${inheritedGroup.emoji ? `${inheritedGroup.emoji} ` : ""}${inheritedGroup.name}` })
    : t("budgetGroupInherit");

  const includeTax = useWatch({ control, name: "include_tax" }) ?? false;
  const includeCommission = useWatch({ control, name: "include_commission" }) ?? false;
  const preview = feeParts({ amount: Number(amountRaw) || 0, src, dst, include_tax: includeTax, include_commission: includeCommission });

  /* A starting point for the required rate, offered rather than prefilled: the
     person's actual rate is the fact wanted, and a filled field stops them checking. */
  const marketRate = crossCurrency && src && dst ? crossRate(src.currency, dst.currency, rates) : null;
  const landing =
    crossCurrency && Number(amountRaw) > 0 && Number(transferRateRaw) > 0
      ? destinationAmount(Number(amountRaw), Number(transferRateRaw))
      : null;

  // Smart defaults, re-derived whenever the accounts or the type change.
  useEffect(() => {
    if (isEdit || !src) return;
    const fees = resolveFeeDefaults({ type, src, dst });
    setValue("include_tax", fees.include_tax);
    setValue("include_commission", fees.include_commission);
    // A card expense is excluded because the budget counts the statement payment instead.
    setValue("exclude_from_budget", type === "expense" && src.type === "credit_card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, toAccountId, accountId]);

  // Income never carries a category; expense needs one; a fresh payment starts uncategorized.
  useEffect(() => {
    if (type === "income") setValue("budget_group_id", "none");
    if (type === "income") setValue("category_id", "");
    else if (type === "expense" && !getValues("category_id")) setValue("category_id", categories[0]?.id ?? "");
    else if (type === "payment" && !isEdit) setValue("category_id", "none");
    if (type !== "payment") setValue("to_account_id", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /* Clear the rate whenever the currency PAIR changes, not only when it stops crossing. */
  const pairKey = crossCurrency && src && dst ? `${src.currency}>${dst.currency}` : "";
  const prevPairKey = useRef(pairKey);
  useEffect(() => {
    if (prevPairKey.current === pairKey) return;
    prevPairKey.current = pairKey;
    setValue("transfer_rate", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  useEffect(() => {
    setTransferRateError(null);
  }, [transferRateRaw]);

  async function onSubmit(values: FormValues) {
    const isPayment = values.type === "payment";
    const transferRate = Number(values.transfer_rate);
    /* Required, with no default: a default of 1 once landed 100 USD as 100 DOP. */
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      setTransferRateError(t("transferRateInvalid"));
      toast.error(t("transferRateInvalid"));
      playError();
      return;
    }
    setPending(true);
    try {
      const payload = {
        ...normalizeFormValues(values),
        to_amount: isPayment && crossCurrency ? destinationAmount(Number(values.amount), transferRate) : undefined,
        to_account_id: isPayment ? values.to_account_id : "",
      };
      const result =
        isEdit && transaction
          ? await act("transactions", "updateTransaction", transaction.id, payload)
          : await act("transactions", "createTransaction", payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      if (fromStatement && alwaysRule && values.category_id && values.category_id !== "none") {
        await callAction("statements", "saveMerchantRule", transaction!.description ?? "", values.category_id);
      }
      toast.success(isEdit ? t("toastUpdated") : t("toastSaved"));
      playSuccess();
      onSuccess?.();
    } catch {
      toast.error(tc("errorGeneric"));
      playError();
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Text size="sm" tone="muted">
        {t("noAccountsHint")}
      </Text>
    );
  }

  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? accountOptionLabel(a) : "";
  };

  return (
    <View style={{ gap: 16 }}>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <View accessibilityRole="radiogroup" accessibilityLabel={t("typeLabel")} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.rule }}>
            {TRANSACTION_TYPES.map((tt) => {
              const on = field.value === tt;
              return (
                <Pressable
                  key={tt}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: fromStatement }}
                  disabled={fromStatement}
                  onPress={() => field.onChange(tt)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 10,
                    marginBottom: -1,
                    borderBottomWidth: 3,
                    borderBottomColor: on ? c.foreground : "transparent",
                    opacity: fromStatement ? 0.6 : 1,
                  }}
                >
                  <Text legend tone={on ? "default" : "muted"} style={{ fontSize: 11 }}>
                    {tType(tt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      />

      <View style={{ gap: 8 }}>
        <Label required>{t("amountLabel")}</Label>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: errors.amount ? c.destructive : c.input }}>
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                placeholder={t("amountPlaceholder")}
                placeholderTextColor={c.mutedForeground}
                autoFocus={compact && !isEdit}
                editable={!fromStatement}
                accessibilityLabel={`${t("amountLabel")} (${displayCurrency})`}
                selectionColor={c.ring}
                style={{
                  flex: 1,
                  minHeight: compact ? 48 : 36,
                  fontFamily: face(compact ? 600 : 400),
                  fontSize: compact ? 24 : 16,
                  color: c.foreground,
                  fontVariant: ["tabular-nums"],
                  opacity: fromStatement ? 0.5 : 1,
                }}
              />
              <Text size="sm" tone="muted">
                {displayCurrency}
              </Text>
            </View>
          )}
        />
        <FieldError message={errors.amount?.message} />
        {compact && !expanded ? (
          <FeeSummaryLine tax={preview.tax} fee={preview.fee} currency={displayCurrency} sameBank={sameBankPayment} onEdit={() => setExpanded(true)} />
        ) : null}
        {/* The one rate a person is asked for: a payment that genuinely crosses currencies. */}
        {crossCurrency && src && dst ? (
          <View style={{ gap: 4, paddingTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text size="xs" tone="muted">
                {t("ratePrefix", { currency: src.currency })}
              </Text>
              <Controller
                control={control}
                name="transfer_rate"
                render={({ field }) => (
                  <Input
                    value={field.value}
                    onChangeText={field.onChange}
                    keyboardType="decimal-pad"
                    placeholder={t("ratePlaceholder")}
                    invalid={!!transferRateError}
                    figure
                    style={{ width: 128, minHeight: 32 }}
                  />
                )}
              />
              <Text size="xs" tone="muted">
                {dst.currency}
              </Text>
            </View>
            <FieldError message={transferRateError} />
            {marketRate ? (
              <Pressable onPress={() => setValue("transfer_rate", String(Number(marketRate.toFixed(8))))} accessibilityRole="button" hitSlop={6}>
                <Text size="xs" tone="primary" style={{ textDecorationLine: "underline" }}>
                  {t("useMarketRate", { rate: marketRate.toLocaleString(undefined, { maximumSignificantDigits: 6 }) })}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {landing !== null && dst ? (
          <Text size="xs" tone="muted">
            {t("destinationLands", { amount: formatMoney(landing, dst.currency), account: dst.name })}
          </Text>
        ) : null}
      </View>

      {expanded ? (
        <Field label={SOURCE_LABEL[type]} required error={errors.account_id?.message}>
          <Controller
            control={control}
            name="account_id"
            render={({ field, fieldState }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={fromStatement}
                invalid={!!fieldState.error}
                title={SOURCE_LABEL[type]}
                options={accountOptions(selectableAccounts)}
              />
            )}
          />
        </Field>
      ) : null}

      {expanded && type === "payment" ? (
        <Field label={t("toLabel")} required error={errors.to_account_id?.message}>
          <Controller
            control={control}
            name="to_account_id"
            render={({ field, fieldState }) => (
              <Select
                value={field.value || null}
                onValueChange={field.onChange}
                invalid={!!fieldState.error}
                placeholder={t("toPlaceholder")}
                title={t("toLabel")}
                options={accountOptions(accounts.filter((a) => a.id !== accountId))}
              />
            )}
          />
        </Field>
      ) : null}

      {compact && !expanded && type === "expense" ? (
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => (
            <CategoryRail categories={railCategories} value={field.value} onChange={field.onChange} onMore={() => setExpanded(true)} />
          )}
        />
      ) : null}

      {expanded ? (
        <>
          {type !== "income" ? (
            <Field
              label={`${t("categoryLabel")}${type === "payment" ? t("categoryOptionalSuffix") : ""}`}
              required={type === "expense"}
              error={errors.category_id?.message}
            >
              <Controller
                control={control}
                name="category_id"
                render={({ field, fieldState }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={field.onChange}
                    invalid={!!fieldState.error}
                    title={t("categoryLabel")}
                    options={[
                      ...(type === "payment" ? [{ value: "none", label: t("noCategory") }] : []),
                      ...categories.map((cat) => ({ value: cat.id, label: `${cat.emoji ? `${cat.emoji} ` : ""}${cat.name}` })),
                    ]}
                  />
                )}
              />
            </Field>
          ) : null}

          {type !== "income" && (srcIsBankAccount || type === "expense" || showGroupOverride) ? (
            <View style={{ gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine, paddingVertical: 12 }}>
              {srcIsBankAccount ? (
                <>
                  <Controller
                    control={control}
                    name="include_tax"
                    render={({ field }) => (
                      <ToggleRow label={t("applyTaxLabel")} checked={field.value} onChange={field.onChange} disabled={fromStatement} />
                    )}
                  />
                  <Controller
                    control={control}
                    name="include_commission"
                    render={({ field }) => (
                      <ToggleRow
                        label={t("applyFeeLabel")}
                        hint={sameBankPayment ? t("freeSameBankHint") : undefined}
                        checked={field.value && !sameBankPayment}
                        onChange={field.onChange}
                        disabled={sameBankPayment || fromStatement}
                      />
                    )}
                  />
                </>
              ) : null}
              {type === "expense" ? (
                <Controller
                  control={control}
                  name="exclude_from_budget"
                  render={({ field }) => (
                    <ToggleRow label={t("excludeFromBudgetLabel")} hint={t("excludeFromBudgetHint")} checked={field.value} onChange={field.onChange} />
                  )}
                />
              ) : null}
              {showGroupOverride ? (
                <Field label={t("budgetGroupOverrideLabel")} hint={t("budgetGroupOverrideHint")}>
                  <Controller
                    control={control}
                    name="budget_group_id"
                    render={({ field }) => (
                      <Select
                        value={field.value || "none"}
                        onValueChange={field.onChange}
                        title={t("budgetGroupOverrideLabel")}
                        options={[
                          { value: "none", label: inheritLabel },
                          ...budgetGroups.map((g) => ({ value: g.id, label: `${g.emoji ? `${g.emoji} ` : ""}${g.name}` })),
                        ]}
                      />
                    )}
                  />
                </Field>
              ) : null}
            </View>
          ) : null}

          <Field label={t("dateLabel")} required error={errors.occurred_at?.message}>
            <Controller
              control={control}
              name="occurred_at"
              render={({ field }) => (
                <DateField value={field.value} onChange={field.onChange} disabled={fromStatement} invalid={!!errors.occurred_at} accessibilityLabel={t("dateLabel")} />
              )}
            />
          </Field>
          <Field label={t("descriptionLabel")}>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Input value={field.value} onChangeText={field.onChange} placeholder={t("descriptionPlaceholder")} editable={!fromStatement} />
              )}
            />
          </Field>
          {/* Never locked: on an imported row this is the only place to say what the charge was. */}
          <Field label={t("notesLabel")} error={errors.notes?.message}>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Textarea value={field.value} onChangeText={field.onChange} placeholder={t("notesPlaceholder")} invalid={!!errors.notes} numberOfLines={2} />
              )}
            />
          </Field>
        </>
      ) : null}

      {fromStatement ? (
        <>
          <Text size="xs" tone="muted">
            {t("fromStatementHint")}
          </Text>
          <ToggleRow
            label={t("alwaysCategorizeMerchant", { merchant: transaction!.description ?? "" })}
            checked={alwaysRule}
            onChange={setAlwaysRule}
          />
        </>
      ) : null}

      {compact ? (
        <>
          {expanded ? null : (
            <AccountDateLine
              accountLabel={accountLabel(accountId)}
              destinationLabel={type === "payment" ? (toAccountId ? accountLabel(toAccountId) : t("noDestination")) : undefined}
              dateLabel={occurredAt === todayLocal() ? t("today") : occurredAt}
              onEdit={() => setExpanded(true)}
            />
          )}
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
          >
            <ChevronDown size={16} color={c.mutedForeground} style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }} />
            <Text size="sm" tone="muted">
              {expanded ? t("lessDetails") : t("moreDetails")}
            </Text>
          </Pressable>
        </>
      ) : null}

      <Button block disabled={pending} isLoading={pending} onPress={handleSubmit(onSubmit, () => setExpanded(true))}>
        {pending ? tc("saving") : isEdit ? t("saveChangesButton") : t("saveButton")}
      </Button>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Text size="sm" tone="muted" style={{ flex: 1 }}>
        {label}
        {hint ? (
          <Text size="xs" color={undefined} tone="teal">
            {"  "}
            {hint}
          </Text>
        ) : null}
      </Text>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}
