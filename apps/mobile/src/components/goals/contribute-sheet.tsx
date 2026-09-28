import { useEffect, useState } from "react";
import { View } from "react-native";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "use-intl";
import type { ContributableAccount } from "@cigua/worker/api";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { FormDate, FormSelect, FormText, SwitchRow } from "~/components/ui/form";
import { Sheet } from "~/components/ui/overlay";
import { Text } from "~/components/ui/text";
import { todayLocal } from "~/components/ui/date-field";
import { toast } from "~/components/ui/toast";
import { makeStyles } from "~/theme/theme";
import { radius } from "~/theme/tokens";

function contributionFormSchema(messages: { pickAccount: string; amountRequired: string; pickDate: string }) {
  return z.object({
    account_id: z.string().uuid(messages.pickAccount),
    amount: z.coerce.number().refine((n) => n !== 0, messages.amountRequired),
    occurred_at: z.string().min(1, messages.pickDate),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  });
}

type Values = { account_id: string; amount: string; occurred_at: string; note: string; exchange_rate: string };

/**
 * Put money into a goal, or take it back out. The goal's target is in base
 * currency, so a contribution from a foreign account asks for the rate.
 */
export function ContributeSheet({
  goal,
  accounts,
  baseCurrency,
  open,
  onClose,
}: {
  goal: { id: string; name: string };
  accounts: ContributableAccount[];
  baseCurrency: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("ContributeDialog");
  const tc = useTranslations("Common");
  const s = useStyles();
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const defaults = (): Values => ({ account_id: accounts[0]?.id ?? "", amount: "", occurred_at: todayLocal(), note: "", exchange_rate: "" });

  const { control, handleSubmit, reset, setValue } = useForm<Values>({
    // Raw, so `exchange_rate` (checked by hand below) survives and `amount` stays a string.
    resolver: zodResolver(
      contributionFormSchema({ pickAccount: t("pickAccount"), amountRequired: t("amountRequired"), pickDate: t("pickDate") }),
      undefined,
      { raw: true },
    ) as unknown as Resolver<Values, unknown, Values>,
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (!open) return;
    reset(defaults());
    setWithdraw(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const account = accounts.find((a) => a.id === accountId);
  const crossCurrency = !!account && account.currency !== baseCurrency;

  // A rate typed for one account means nothing for another.
  const [lastAccount, setLastAccount] = useState(accountId);
  if (accountId !== lastAccount) {
    setLastAccount(accountId);
    setValue("exchange_rate", "");
  }

  async function onSubmit(values: Values) {
    const magnitude = Math.abs(Number(values.amount));
    if (crossCurrency && !(Number(values.exchange_rate) > 0)) {
      toast.error(tc("crossCurrencyRateRequired"));
      playError();
      return;
    }
    setPending(true);
    try {
      const result = await act("goals", "addContribution", {
        goal_id: goal.id,
        account_id: values.account_id,
        amount: withdraw ? -magnitude : magnitude,
        exchange_rate: crossCurrency ? values.exchange_rate || 1 : 1,
        occurred_at: values.occurred_at,
        note: values.note,
      });
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(withdraw ? t("toastWithdrawn") : t("toastContributed"));
      playSuccess();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title", { name: goal.name })}
      footer={
        accounts.length > 0 ? (
          <Button disabled={pending} isLoading={pending} onPress={handleSubmit(onSubmit)}>
            {pending ? tc("saving") : withdraw ? t("withdrawButton") : t("contributeButton")}
          </Button>
        ) : undefined
      }
    >
      {accounts.length === 0 ? (
        <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 24 }}>
          {t("noAccounts")}
        </Text>
      ) : (
        <>
          <View style={s.withdraw}>
            <SwitchRow label={t("withdrawLabel")} hint={t("withdrawHint")} checked={withdraw} onChange={setWithdraw} muted={false} />
          </View>
          <FormSelect
            control={control}
            name="account_id"
            label={t("accountLabel")}
            required
            placeholder={t("accountPlaceholder")}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
          />
          <FormText control={control} name="amount" label={t("amountLabel", { currency: account?.currency ?? baseCurrency })} required numeric />
          {crossCurrency ? (
            <FormText control={control} name="exchange_rate" label={t("rateLabel", { from: account.currency, to: baseCurrency })} required numeric />
          ) : null}
          <FormDate control={control} name="occurred_at" label={t("dateLabel")} required />
          <FormText control={control} name="note" label={t("noteLabel")} placeholder={t("notePlaceholder")} />
        </>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  withdraw: { borderRadius: radius.sheet + 4, borderWidth: 1, borderColor: c.border, padding: 12 },
}));
