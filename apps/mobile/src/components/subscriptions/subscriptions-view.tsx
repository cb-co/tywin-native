import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Pencil, Receipt, Repeat, Trash2 } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import type { QuickAddData, SubscriptionWithRefs } from "@cigua/worker/api";
import { monthlyEquivalent, nextChargeDate, type BillingCycle } from "@cigua/core/subscriptions/cycle";
import { recurringTotals } from "@cigua/core/subscriptions/totals";
import { chargeCrossesCurrency } from "@cigua/core/subscriptions/charge";
import { orderByNext } from "@cigua/core/subscriptions/order";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/screen";
import { Switch } from "~/components/ui/switch";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { DoubleRule, LedgerBlock, LedgerRow, SectionLegend } from "~/components/papel/ledger";
import { MaskedMoney, MoneyDisplay } from "~/components/money/money-display";
import { makeStyles, useColors } from "~/theme/theme";
import { BrandMark } from "./brand-mark";
import { RecordChargeSheet, type RecordAmounts } from "./record-charge-sheet";
import { SubscriptionFormSheet } from "./subscription-form-sheet";

/** "Popular Checking", or "Popular Checking → Visa Gold" for a payment. */
function accountLine(sub: SubscriptionWithRefs): string {
  if (sub.kind === "payment" && sub.account && sub.to_account) return `${sub.account.name} → ${sub.to_account.name}`;
  return sub.account?.name ?? "";
}

/** Recording only asks when currencies differ; everything else records on one tap. */
function chargeLegs(sub: SubscriptionWithRefs) {
  const accountCurrency = sub.account?.currency;
  const dstCurrency = sub.kind === "payment" ? sub.to_account?.currency : null;
  const crossLeg = !!accountCurrency && !!dstCurrency && dstCurrency !== accountCurrency;
  const asks = chargeCrossesCurrency(sub.currency, accountCurrency) || crossLeg;
  return { asks, accountCurrency: accountCurrency!, destinationCurrency: crossLeg ? dstCurrency! : null };
}

/**
 * Two ruled totals (money out and money in, at one size), then the templates,
 * next charge first. Income and the rest print as two bands only when both exist.
 */
export function SubscriptionsView({ subscriptions, data }: { subscriptions: SubscriptionWithRefs[]; data: QuickAddData }) {
  const t = useTranslations("Subscriptions");
  const tType = useTranslations("TransactionTypes");
  const tCycle = useTranslations("BillingCycles");
  const locale = useLocale();
  const c = useColors();
  const s = useStyles();
  const { playSuccess, playDelete, playError } = useFeedback();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SubscriptionWithRefs | null>(null);
  const [recording, setRecording] = useState<SubscriptionWithRefs | null>(null);

  const totals = useMemo(() => recurringTotals(subscriptions, data.baseCurrency, data.rates), [subscriptions, data.baseCurrency, data.rates]);
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const nextLabel = useCallback(
    (sub: SubscriptionWithRefs) => {
      const d = nextChargeDate({ cycle: sub.billing_cycle as BillingCycle, anchorDay: sub.anchor_day, anchorDate: sub.anchor_date });
      return d ? dateFmt.format(d) : "—";
    },
    [dateFmt],
  );

  const incomeSubs = orderByNext(subscriptions.filter((x) => x.kind === "income"));
  const otherSubs = orderByNext(subscriptions.filter((x) => x.kind !== "income"));
  const showBands = incomeSubs.length > 0 && otherSubs.length > 0;

  /** Resolves to whether the charge saved, so the record sheet stays open on failure. */
  async function onAddCharge(id: string, amounts?: RecordAmounts): Promise<boolean> {
    setBusyId(id);
    try {
      const result = await act("recurring", "addCharge", id, amounts);
      if (result.error) {
        toast.error(result.error);
        playError();
        return false;
      }
      toast.success(t("toastChargeLogged"));
      playSuccess();
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      const result = await act("recurring", "deleteSubscription", id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("toastDeleted"));
      playDelete();
    } finally {
      setBusyId(null);
    }
  }

  async function onToggle(id: string, active: boolean) {
    const result = await act("recurring", "setSubscriptionActive", id, active);
    if (result.error) {
      toast.error(result.error);
      playError();
    }
  }

  const renderBlock = (sub: SubscriptionWithRefs, i: number, list: SubscriptionWithRefs[]) => {
    const monthly = monthlyEquivalent(sub.amount, sub.billing_cycle as BillingCycle);
    const busy = busyId === sub.id;
    const line = accountLine(sub);
    return (
      <View key={sub.id} style={sub.is_active ? null : { opacity: 0.6 }}>
        <LedgerBlock
          rule={i < list.length - 1}
          head={
            <LedgerRow
              rule={false}
              lead={<BrandMark name={sub.name} color={sub.color} logoPath={sub.logoPath} />}
              title={sub.name}
              subtitle={`${sub.kind !== "expense" ? `${tType(sub.kind)} · ` : ""}${tCycle(sub.billing_cycle as BillingCycle)}`}
              amount={<MoneyDisplay amount={sub.amount} currency={sub.currency} size="inline" />}
              meta={t("nextPrefix", { date: nextLabel(sub) })}
            />
          }
        >
          {monthly !== sub.amount ? (
            <Text size="xs" tone="muted" figure>
              {t.rich("monthlyEquivalent", { amount: () => <MaskedMoney amount={monthly} currency={sub.currency} /> })}
            </Text>
          ) : null}
          {line ? (
            <Text size="xs" tone="muted" numberOfLines={1}>
              {line}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ marginRight: 4 }}>
                <Switch checked={sub.is_active} onCheckedChange={(v) => void onToggle(sub.id, v)} accessibilityLabel={t("activeAria")} />
              </View>
              <Button variant="ghost" size="icon" icon={Pencil} textColor={c.mutedForeground} accessibilityLabel={t("editAria")} onPress={() => setEditing(sub)} />
              <Button
                variant="ghost"
                size="icon"
                icon={Trash2}
                textColor={c.mutedForeground}
                accessibilityLabel={t("deleteAria")}
                onPress={() => void onDelete(sub.id)}
                disabled={busyId !== null}
              />
            </View>
            {/* Secondary, not primary: a column of solid buttons would drown out "add recurring". */}
            <Button
              size="sm"
              variant="secondary"
              icon={Receipt}
              disabled={busyId !== null}
              isLoading={busy}
              onPress={() => (chargeLegs(sub).asks ? setRecording(sub) : void onAddCharge(sub.id))}
            >
              {t("addCharge")}
            </Button>
          </View>
        </LedgerBlock>
      </View>
    );
  };

  const legs = recording ? chargeLegs(recording) : null;

  return (
    <View style={{ gap: 24 }}>
      {/* Plain ruled totals, no note: this screen is read and edited over and over. */}
      <View style={s.totals}>
        <View style={{ gap: 4 }}>
          <Text legend tone="muted" style={{ fontSize: 11 }}>
            {t("monthlyRecurring")}
          </Text>
          <MoneyDisplay amount={totals.outgoing} currency={data.baseCurrency} size="feature" />
        </View>
        {incomeSubs.length > 0 ? (
          <View style={{ gap: 4 }}>
            <Text legend tone="muted" style={{ fontSize: 11 }}>
              {t("monthlyIncome")}
            </Text>
            <MoneyDisplay amount={totals.income} currency={data.baseCurrency} size="feature" color={c.teal} />
          </View>
        ) : null}
      </View>

      {subscriptions.length === 0 ? (
        <EmptyState icon={<Repeat size={24} color={c.foreground} />} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <View style={{ gap: 24 }}>
          {showBands ? (
            <View style={{ gap: 12 }}>
              <SectionLegend>{t("sectionIncome")}</SectionLegend>
              <Card flush>{incomeSubs.map(renderBlock)}</Card>
            </View>
          ) : null}
          {showBands ? <DoubleRule /> : null}
          <View style={{ gap: 12 }}>
            {showBands ? <SectionLegend>{t("sectionOther")}</SectionLegend> : null}
            <Card flush>{(showBands ? otherSubs : orderByNext(subscriptions)).map(renderBlock)}</Card>
          </View>
        </View>
      )}

      <SubscriptionFormSheet mode="edit" subscription={editing ?? undefined} data={data} open={editing !== null} onClose={() => setEditing(null)} />
      {recording && legs ? (
        <RecordChargeSheet
          subscription={recording}
          accountCurrency={legs.accountCurrency}
          destinationCurrency={legs.destinationCurrency}
          rates={data.rates}
          open
          onClose={() => setRecording(null)}
          onConfirm={(amounts) => onAddCharge(recording.id, amounts)}
          pending={busyId === recording.id}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  totals: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 40,
    rowGap: 16,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: c.rule,
    paddingVertical: 16,
  },
}));
