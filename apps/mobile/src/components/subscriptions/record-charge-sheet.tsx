import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import type { SubscriptionWithRefs } from "@cigua/worker/api";
import { formatMoney } from "@cigua/core/format";
import { CARD_FX_SPREAD, estimateSettledAmount } from "@cigua/core/subscriptions/charge";
import { estimateDestinationAmount } from "@cigua/core/subscriptions/template";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/field";
import { Dialog } from "~/components/ui/overlay";
import { Text } from "~/components/ui/text";

export type RecordAmounts = { settledAmount?: number; toAmount?: number };

/**
 * Asked only when currencies differ: what actually left the account (a dollar
 * subscription on a peso card), and what landed (a payment between two
 * currencies). Each field opens filled with a labelled estimate, so Record is
 * always one tap away; the real figure usually is not known yet.
 */
export function RecordChargeSheet({
  subscription,
  accountCurrency,
  destinationCurrency,
  rates,
  open,
  onClose,
  onConfirm,
  pending,
}: {
  subscription: SubscriptionWithRefs;
  accountCurrency: string;
  /** Set only for a payment whose destination holds a different currency. */
  destinationCurrency: string | null;
  rates: Record<string, number>;
  open: boolean;
  onClose: () => void;
  onConfirm: (amounts: RecordAmounts) => Promise<boolean>;
  pending: boolean;
}) {
  const t = useTranslations("RecordCharge");
  const [amount, setAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  const asksSettled = subscription.currency !== accountCurrency;
  const settledEstimate = asksSettled
    ? estimateSettledAmount({ subAmount: subscription.amount, subCurrency: subscription.currency, accountCurrency, rates })
    : subscription.amount;

  // Re-seeded on every open, so a stale edit never becomes this month's charge.
  useEffect(() => {
    if (!open) return;
    setAmount(settledEstimate != null ? String(settledEstimate) : "");
    const leg =
      destinationCurrency && settledEstimate != null
        ? estimateDestinationAmount({ amount: settledEstimate, from: accountCurrency, to: destinationCurrency, rates })
        : null;
    setToAmount(leg != null ? String(leg) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    const settled = Number(amount);
    const landed = Number(toAmount);
    if (asksSettled && !(settled > 0)) return;
    if (destinationCurrency && !(landed > 0)) return;
    // Closed only on success, so a failed save keeps what was typed.
    const ok = await onConfirm({
      ...(asksSettled ? { settledAmount: settled } : {}),
      ...(destinationCurrency ? { toAmount: landed } : {}),
    });
    if (ok) onClose();
  }

  const amountText = formatMoney(subscription.amount, subscription.currency);
  const account = subscription.account?.name ?? "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("title", { name: subscription.name })}
      description={
        subscription.kind === "payment"
          ? t("paymentLine", { amount: amountText, account, to: subscription.to_account?.name ?? "" })
          : subscription.kind === "income"
            ? t("incomeLine", { amount: amountText, account, currency: accountCurrency })
            : t("billedLine", { amount: amountText, account, currency: accountCurrency })
      }
      footer={
        <Button block onPress={() => void submit()} disabled={pending} isLoading={pending}>
          {t("submitButton")}
        </Button>
      }
    >
      <View style={{ gap: 16 }}>
        {asksSettled ? (
          <Field
            label={subscription.kind === "income" ? t("receivedLabel", { account }) : t("chargedLabel")}
            hint={
              settledEstimate != null
                ? t("estimateHint", { percent: Math.round(CARD_FX_SPREAD * 100) })
                : t("noEstimateHint", { currency: accountCurrency })
            }
          >
            <CurrencyInput currency={accountCurrency} value={amount} onChange={setAmount} autoFocus />
          </Field>
        ) : null}
        {destinationCurrency ? (
          <Field label={t("receivedLabel", { account: subscription.to_account?.name ?? "" })} hint={t("receivedHint")}>
            <CurrencyInput currency={destinationCurrency} value={toAmount} onChange={setToAmount} autoFocus={!asksSettled} />
          </Field>
        ) : null}
      </View>
    </Dialog>
  );
}

function CurrencyInput({
  currency,
  value,
  onChange,
  autoFocus,
}: {
  currency: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ justifyContent: "center" }}>
      <Input
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        figure
        autoFocus={autoFocus}
        // Prefilled, and usually opened to replace the figure: select it.
        selectTextOnFocus
        style={{ paddingRight: 56 }}
      />
      <Text size="sm" tone="muted" style={{ position: "absolute", right: 12 }} pointerEvents="none">
        {currency}
      </Text>
    </View>
  );
}
