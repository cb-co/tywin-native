import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { formatPercent } from "@cigua/core/format";
import { LedgerBlock, LedgerRow } from "~/components/papel/ledger";
import { ProofMark } from "~/components/papel/proof-mark";
import { RuleMeter } from "~/components/papel/rule-meter";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

type Insights = ScreenData<"insights">["insights"];

/** Card utilisation (near at half, flagged from 80%) and how far each loan is paid off. */
export function DebtHealth({ utilization, loans }: { utilization: Insights["utilization"]; loans: Insights["loans"] }) {
  const t = useTranslations("Insights");
  const s = useStyles();
  if (utilization.length === 0 && loans.length === 0) {
    return (
      <Text size="sm" tone="muted" align="center" style={{ paddingVertical: 32 }}>
        {t("debtHealthEmpty")}
      </Text>
    );
  }
  return (
    <View style={{ marginHorizontal: -16, marginBottom: -16, gap: 20, paddingBottom: 8 }}>
      {utilization.length > 0 ? (
        <View>
          <Text legend tone="muted" style={s.legend}>
            {t("cardUtilizationLabel")}
          </Text>
          <View style={s.list}>
            {utilization.map((c, i) => (
              <LedgerBlock
                key={c.id}
                rule={i < utilization.length - 1}
                head={<LedgerRow rule={false} title={`${c.name} · ${c.currency}`} meta={formatPercent(c.pct)} />}
              >
                <RuleMeter used={c.pct} total={100} label={c.name} near={c.pct >= 50} />
                {c.pct >= 80 ? <ProofMark tone="flag">{t("utilizationHigh")}</ProofMark> : null}
              </LedgerBlock>
            ))}
          </View>
        </View>
      ) : null}
      {loans.length > 0 ? (
        <View>
          <Text legend tone="muted" style={s.legend}>
            {t("loanPayoffLabel")}
          </Text>
          <View style={s.list}>
            {loans.map((l, i) => (
              <LedgerBlock
                key={l.id}
                rule={i < loans.length - 1}
                head={<LedgerRow rule={false} title={`${l.name} · ${l.currency}`} meta={formatPercent(l.paidPct)} />}
              >
                <RuleMeter used={l.paidPct} total={100} label={l.name} />
              </LedgerBlock>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  legend: { fontSize: 11, paddingHorizontal: 16, paddingBottom: 8 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.paperLine },
}));
