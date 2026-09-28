import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { formatMoney } from "@cigua/core/format";
import type { SheetRow } from "@cigua/core/statements/sheet-rows";
import { Text } from "~/components/ui/text";
import { Skeleton } from "~/components/ui/screen";
import { makeStyles } from "~/theme/theme";

/** A statement read line by line: ruled paper, the bank's own text, the amount at the right, credits as a plus. */
export function StatementSheet({ rows, more, currency }: { rows: SheetRow[]; more: number; currency: string }) {
  const t = useTranslations("Statements");
  const s = useStyles();
  if (rows.length === 0) return null;
  return (
    <View>
      <View style={s.sheet} accessibilityLabel={t("sheetLabel")}>
        {rows.map((r, i) => (
          <View key={r.key} style={[s.row, i < rows.length - 1 ? s.rule : null]}>
            <Text size="xs" figure tone="muted" style={{ width: 42 }}>
              {r.date}
            </Text>
            <Text size="xs" numberOfLines={1} tracking={0.025} style={{ flex: 1, textTransform: "uppercase" }}>
              {r.text}
            </Text>
            <Text size="xs" figure weight={600} tone={r.credit ? "teal" : "default"}>
              {r.credit ? "+" : ""}
              {formatMoney(r.amount, currency)}
            </Text>
          </View>
        ))}
      </View>
      {more > 0 ? (
        <Text size="xs" tone="muted" style={{ marginTop: 4 }}>
          {t("sheetMore", { count: more })}
        </Text>
      ) : null}
    </View>
  );
}

/** Unprinted ruled paper while the file is read: empty rules, never placeholder figures. */
export function ReadingSheet({ fileName }: { fileName: string }) {
  const t = useTranslations("Statements");
  const s = useStyles();
  return (
    <View style={{ gap: 8 }} accessibilityRole="progressbar" accessibilityLabel={t("readingSheet", { fileName })}>
      <Text size="sm" weight={500} numberOfLines={1}>
        {t("readingSheet", { fileName })}
      </Text>
      <View style={s.sheet}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[{ height: 28, justifyContent: "center" }, i < 5 ? s.rule : null]}>
            <Skeleton height={10} width={`${60 + ((i * 17) % 35)}%`} />
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 4, paddingVertical: 6 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
}));
