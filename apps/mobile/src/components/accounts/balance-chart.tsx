import { useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";
import type { TransactionWithRefs } from "@cigua/worker/api";
import { formatMoney } from "@cigua/core/format";
import { PlateChart, type ChartSeries } from "~/components/charts/plate-chart";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

function delta(txn: TransactionWithRefs, accountId: string): number {
  if (txn.account_id === accountId) return txn.type === "income" ? txn.amount : -txn.total_amount;
  if (txn.to_account_id === accountId && txn.type === "payment") return txn.to_amount ?? txn.amount;
  return 0;
}

/** The running balance from the starting figure through every movement, oldest first. */
export function BalanceChart({
  accountId,
  startingBalance,
  currency,
  transactions,
}: {
  accountId: string;
  startingBalance: number;
  currency: string;
  transactions: TransactionWithRefs[];
}) {
  const t = useTranslations("AccountDetail");
  const locale = useLocale();
  const c = useColors();

  const data = useMemo(() => {
    // occurred_at is UTC midnight of a calendar date: format in UTC so the label never rolls back a day.
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
    const asc = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    // Unrounded across the run, rounded for display, so fractional movements never drift.
    const points = [{ label: t("chartStartLabel"), values: { balance: startingBalance } }];
    let running = startingBalance;
    for (const txn of asc) {
      running += delta(txn, accountId);
      points.push({ label: fmt.format(new Date(txn.occurred_at)), values: { balance: Math.round(running * 100) / 100 } });
    }
    return points;
  }, [transactions, accountId, startingBalance, t, locale]);

  const series = useMemo<ChartSeries[]>(
    () => [{ key: "balance", name: t("balanceOverTime"), kind: "line", color: c.ink, strokeWidth: 1.5, format: (v) => formatMoney(v, currency) }],
    [c.ink, currency, t],
  );

  if (data.length <= 1) {
    return (
      <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 32 }}>
        {t("noMovementYet")}
      </Text>
    );
  }

  return (
    <PlateChart
      data={data}
      series={series}
      height={224}
      domain="auto"
      minTickGap={24}
      yFormat={(v) => formatMoney(v, currency, { compact: true })}
      accessibilityLabel={t("balanceOverTime")}
    />
  );
}
