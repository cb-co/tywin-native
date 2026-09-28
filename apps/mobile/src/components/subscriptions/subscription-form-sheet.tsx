import { useEffect, useState } from "react";
import { View } from "react-native";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import type { QuickAddData, SubscriptionWithRefs } from "@cigua/worker/api";
import { BILLING_CYCLES, BILLING_CYCLE_CHOICES, usesAnchorDate, type BillingCycle } from "@cigua/core/subscriptions/cycle";
import { SEMIMONTHLY_MAX_ANCHOR, semimonthlyStarts } from "@cigua/core/period/cycle";
import { subscriptionInput } from "@cigua/core/subscriptions/schema";
import { RECURRING_KINDS, templateAllowsFees, type RecurringKind } from "@cigua/core/subscriptions/template";
import { resolveFeeDefaults } from "@cigua/core/transactions/defaults";
import { callAction } from "~/lib/api";
import { act, invalidateAfter } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field } from "~/components/ui/field";
import { FormDate, FormSelect, FormSwitch, FormText } from "~/components/ui/form";
import { Sheet } from "~/components/ui/overlay";
import { Select } from "~/components/ui/select";
import { Segmented } from "~/components/ui/segmented";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { useAccountOptions } from "~/components/transactions/account-options";
import { makeStyles } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/** The height of a field's label plus its gap, so a bare control lines up with a labelled one. */
const LABEL_OFFSET = 28;

type Values = {
  kind: RecurringKind;
  name: string;
  amount: string;
  currency: string;
  billing_cycle: BillingCycle;
  anchor_day: string;
  anchor_date: string;
  account_id: string;
  to_account_id: string;
  category_id: string;
  include_tax: boolean;
  include_commission: boolean;
  is_active: boolean;
};

function defaults(sub: SubscriptionWithRefs | undefined, baseCurrency: string): Values {
  return {
    kind: (sub?.kind as RecurringKind) ?? "expense",
    name: sub?.name ?? "",
    amount: sub ? String(sub.amount) : "",
    currency: sub?.currency ?? baseCurrency,
    billing_cycle: (sub?.billing_cycle as BillingCycle) ?? "monthly",
    anchor_day: sub?.anchor_day ? String(sub.anchor_day) : "",
    anchor_date: sub?.anchor_date ?? "",
    account_id: sub?.account_id ?? "none",
    to_account_id: sub?.to_account_id ?? "none",
    category_id: sub?.category_id ?? "none",
    include_tax: sub?.include_tax ?? false,
    include_commission: sub?.include_commission ?? false,
    is_active: sub?.is_active ?? true,
  };
}

/** The "none" sentinel and a blank anchor day both mean unset; the schema needs them as such. */
function clean(values: Values) {
  return {
    ...values,
    account_id: values.account_id === "none" ? "" : values.account_id,
    to_account_id: values.to_account_id === "none" ? "" : values.to_account_id,
    category_id: values.category_id === "none" ? "" : values.category_id,
    anchor_day: values.anchor_day === "" ? undefined : values.anchor_day,
  };
}

/** Add or edit a recurring template: an expense, a payment between accounts, or income. */
export function SubscriptionFormSheet({
  mode,
  subscription,
  data,
  open,
  onClose,
}: {
  mode: "create" | "edit";
  subscription?: SubscriptionWithRefs;
  data: QuickAddData;
  open: boolean;
  onClose: () => void;
}) {
  const { accounts, categories, currencies, baseCurrency } = data;
  const t = useTranslations("SubscriptionForm");
  const tType = useTranslations("TransactionTypes");
  const tCycle = useTranslations("BillingCycles");
  const tTxn = useTranslations("TransactionForm");
  const tc = useTranslations("Common");
  const s = useStyles();
  const accountOptions = useAccountOptions();
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);

  const { control, handleSubmit, reset, setValue, getValues } = useForm<Values>({
    // Validated against cleaned values; `raw` hands onSubmit the form's own shape back.
    resolver: ((values, context, options) =>
      zodResolver(subscriptionInput, undefined, { raw: true })(clean(values) as never, context, options as never)) as Resolver<
      Values,
      unknown,
      Values
    >,
    defaultValues: defaults(subscription, baseCurrency),
  });

  useEffect(() => {
    if (open) reset(defaults(subscription, baseCurrency));
    // Seeded on open only: a background refetch must not wipe a half-typed edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const kind = useWatch({ control, name: "kind" });
  const cycle = useWatch({ control, name: "billing_cycle" });
  const anchorDay = Number(useWatch({ control, name: "anchor_day" }));
  const accountId = useWatch({ control, name: "account_id" });
  const firstPaydayValid = Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= SEMIMONTHLY_MAX_ANCHOR;
  const byId = (id: string) => accounts.find((a) => a.id === id) ?? null;
  const payment = kind === "payment";
  const income = kind === "income";
  // Bank debits only: a card or cash template records fee-free.
  const showFees = templateAllowsFees(kind, byId(accountId)?.type);

  /** Where the fee toggles start, re-derived on a person's own change (never on open). */
  function refreshFees(next: Partial<Pick<Values, "kind" | "account_id" | "to_account_id">>) {
    const v = { ...getValues(), ...next };
    const fees = resolveFeeDefaults({ type: v.kind, src: byId(v.account_id), dst: v.kind === "payment" ? byId(v.to_account_id) : null });
    setValue("include_tax", fees.include_tax);
    setValue("include_commission", fees.include_commission);
  }

  const cycleOptions = (subscription?.billing_cycle === "biweekly" ? BILLING_CYCLES : BILLING_CYCLE_CHOICES).map((c) => ({
    value: c,
    label: tCycle(c),
  }));
  const none = { value: "none", label: tc("none") };
  const categoryOptions = [none, ...categories.map((c) => ({ value: c.id, label: `${c.emoji ? `${c.emoji} ` : ""}${c.name}` }))];

  async function onSubmit(values: Values) {
    setPending(true);
    try {
      const payload = clean(values);
      const result =
        mode === "create"
          ? await act("recurring", "createSubscription", payload)
          : await act("recurring", "updateSubscription", subscription!.id, payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAdded") : t("toastUpdated"));
      playSuccess();
      onClose();
      // Brand colour and logo resolve after the save, never awaited: a cold model
      // call can take a minute, and the template is already listed.
      if (result.id)
        void callAction("recurring", "resolveSubscriptionBrand", result.id)
          .then(({ resolved }) => {
            if (resolved) void invalidateAfter("recurring.resolveSubscriptionBrand");
          })
          .catch(() => undefined);
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? t("addTitle") : t("editTitle")}
      footer={
        <Button disabled={pending} isLoading={pending} onPress={handleSubmit(onSubmit)}>
          {pending ? tc("saving") : mode === "create" ? t("addButton") : t("saveChangesButton")}
        </Button>
      }
    >
      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <Segmented
            stretch
            size="sm"
            value={field.value}
            onChange={(k) => {
              field.onChange(k);
              refreshFees({ kind: k });
            }}
            items={RECURRING_KINDS.map((k) => ({ value: k, label: tType(k) }))}
          />
        )}
      />

      {/* A salary has two honest answers; what the template records is the deposit. */}
      {income ? (
        <Text size="xs" tone="muted">
          {t("amountHintIncome")}
        </Text>
      ) : null}

      <FormText
        control={control}
        name="name"
        label={t("nameLabel")}
        required
        placeholder={payment ? t("namePlaceholderPayment") : income ? t("namePlaceholderIncome") : t("namePlaceholder")}
      />

      <Controller
        control={control}
        name="currency"
        render={({ field: currency, fieldState: currencyState }) => (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <FormText control={control} name="amount" label={t("amountLabel")} required numeric />
            </View>
            {/* Level with the amount's input, under its label. */}
            <View style={{ width: 96, marginTop: LABEL_OFFSET }}>
              <Select
                value={currency.value}
                onValueChange={currency.onChange}
                title={t("amountLabel")}
                invalid={!!currencyState.error}
                options={currencies.map((c) => ({ value: c.code, label: c.code }))}
              />
            </View>
          </View>
        )}
      />

      <FormSelect control={control} name="billing_cycle" label={t("billingCycleLabel")} required options={cycleOptions} />

      {usesAnchorDate(cycle) ? (
        <FormDate control={control} name="anchor_date" label={t("startDateLabel")} required hint={t("startDateHint")} />
      ) : cycle === "semimonthly" ? (
        <FormText
          control={control}
          name="anchor_day"
          label={t("semimonthlyDayLabel")}
          integer
          placeholder="1"
          hint={firstPaydayValid ? t("semimonthlyDayHint", { second: semimonthlyStarts(anchorDay)[1] }) : t("semimonthlyDayRange")}
        />
      ) : (
        <FormText control={control} name="anchor_day" label={t("chargeDayLabel")} integer placeholder={t("chargeDayPlaceholder")} />
      )}

      {/* Required wherever the account is a destination: where a payment comes from, where income lands. */}
      <Controller
        control={control}
        name="account_id"
        render={({ field, fieldState }) => (
          <Field
            label={payment ? t("fromAccountLabel") : income ? t("depositAccountLabel") : t("chargeAccountLabel")}
            required={payment || income}
            error={fieldState.error?.message}
          >
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                refreshFees({ account_id: v });
              }}
              title={payment ? t("fromAccountLabel") : income ? t("depositAccountLabel") : t("chargeAccountLabel")}
              invalid={!!fieldState.error}
              options={[none, ...accountOptions(accounts)]}
            />
          </Field>
        )}
      />

      {payment ? (
        <Controller
          control={control}
          name="to_account_id"
          render={({ field, fieldState }) => (
            <Field label={t("toAccountLabel")} required error={fieldState.error?.message}>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  refreshFees({ to_account_id: v });
                }}
                title={t("toAccountLabel")}
                invalid={!!fieldState.error}
                // Paying an account into itself is not a payment.
                options={[none, ...accountOptions(accounts.filter((a) => a.id !== accountId))]}
              />
            </Field>
          )}
        />
      ) : null}

      {income ? null : (
        <FormSelect
          control={control}
          name="category_id"
          label={`${t("categoryLabel")}${payment ? tTxn("categoryOptionalSuffix") : ""}`}
          options={categoryOptions}
        />
      )}

      {showFees ? (
        <View style={s.box}>
          <FormSwitch control={control} name="include_tax" label={tTxn("applyTaxLabel")} muted={false} />
          <FormSwitch control={control} name="include_commission" label={tTxn("applyFeeLabel")} muted={false} />
        </View>
      ) : null}

      <View style={s.box}>
        <FormSwitch control={control} name="is_active" label={t("activeLabel")} muted={false} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  box: { gap: 12, borderRadius: radius.sheet + 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.paper2, padding: 12 },
}));
