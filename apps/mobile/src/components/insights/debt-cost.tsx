import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { formatDate, formatMoney } from "@cigua/core/format";
import { DoubleRule, LedgerRow } from "~/components/papel/ledger";
import { ImportButton } from "~/components/statements/import-button";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

type DebtCost = ScreenData<"insights">["debtCost"];
type Row = DebtCost["cards"][number];

function Rows({ rows }: { rows: Row[] }) {
  const t = useTranslations("Insights");
  const locale = useLocale();
  const s = useStyles();
  return (
    <View style={s.list}>
      {rows.map((r, i) => (
        <LedgerRow
          key={r.accountId}
          rule={i < rows.length - 1}
          onPress={() => router.push({ pathname: "/accounts/[id]", params: { id: r.accountId } })}
          accessibilityLabel={r.name}
          title={r.name}
          subtitle={`${r.currency} · ${r.apr !== null ? `${t("costOfCarryApr", { rate: r.apr })} · ` : ""}${t("costOfCarryAsOf", { date: formatDate(r.asOf, locale) })}`}
          amount={
            <Text size="sm" figure>
              {formatMoney(r.amount, r.currency)}
            </Text>
          }
        />
      ))}
    </View>
  );
}

function Subtotal({ label, amount, muted }: { label: string; amount: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 16 }}>
      <Text size="sm" weight={500} tone={muted ? "muted" : "default"} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text size="sm" weight={500} figure tone={muted ? "muted" : "default"}>
        {amount}
      </Text>
    </View>
  );
}

/**
 * Two groups, never one total: card carry is what financing would cost, loan
 * interest is what was paid. Every row opens its account.
 */
export function DebtCostList({ data }: { data: DebtCost }) {
  const t = useTranslations("Insights");
  const s = useStyles();
  const cur = data.baseCurrency;

  if (data.cards.length === 0 && data.loans.length === 0) {
    return (
      <View style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
        <Text size="sm" tone="muted" align="center">
          {t("debtCostEmpty")}
        </Text>
        <ImportButton size="sm" />
      </View>
    );
  }

  return (
    <View style={{ marginHorizontal: -16, marginBottom: -16, gap: 24, paddingBottom: 16 }}>
      {data.cards.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Text legend tone="muted" style={s.legend}>
            {t("debtCostCards")}
          </Text>
          <Rows rows={data.cards} />
          <View style={{ gap: 12 }}>
            <DoubleRule style={{ marginHorizontal: 16 }} />
            <Subtotal label={t("debtCostCardsMonthly", { currency: cur })} amount={formatMoney(data.cardsMonthlyBase, cur)} />
          </View>
        </View>
      ) : null}
      {data.loans.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Text legend tone="muted" style={s.legend}>
            {t("debtCostLoans")}
          </Text>
          <Rows rows={data.loans} />
          {/* "Recorded in", not "paid in": payments before the loan was added were never transactions. */}
          <View style={{ gap: 6 }}>
            <DoubleRule style={{ marginHorizontal: 16, marginBottom: 6 }} />
            <Subtotal label={t("loanInterestMonthly", { currency: cur })} amount={formatMoney(data.loansMonthlyBase, cur)} />
            <Subtotal muted label={t("loanInterestRecorded", { year: String(data.year), currency: cur })} amount={formatMoney(data.loansYearBase, cur)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  legend: { fontSize: 11, paddingHorizontal: 16 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.paperLine },
}));
