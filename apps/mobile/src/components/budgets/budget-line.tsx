import { memo } from "react";
import { View } from "react-native";
import { Pencil, Trash2 } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { barPct, meterArgs } from "@cigua/core/budgets/bar";
import { formatPercent } from "@cigua/core/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { LedgerBlock, LedgerRow } from "~/components/papel/ledger";
import { RuleMeter } from "~/components/papel/rule-meter";
import { Stamp } from "~/components/papel/stamp";
import { MoneyDisplay } from "~/components/money/money-display";
import { useColors } from "~/theme/theme";
import { BudgetStatusMark } from "./budget-status-mark";

export type BudgetLineProps = {
  name: string;
  color: string | null;
  emoji: string | null;
  used: number;
  budget: number;
  status: "within" | "approaching" | "over";
  currency: string;
  subtitle: string;
  prorated: string | null;
  inputKey: string;
  defaultAmount: number;
  placeholder: string;
  budgetAria: string;
  onSave: (raw: string) => void;
  editAria: string;
  onEdit: () => void;
  deleteAria: string;
  onDelete: () => void;
  deleting: boolean;
  rule?: boolean;
};

/**
 * One budget, drawn the same for categories and groups (the same money sliced
 * two ways): a ledger head, the ruled meter with its status mark, then the
 * monthly amount (saved when the field is left) and edit and delete.
 */
export const BudgetLine = memo(function BudgetLine(p: BudgetLineProps) {
  const t = useTranslations("Budgets");
  const c = useColors();
  const { used, total } = meterArgs(p.used, p.budget, p.status === "over");
  return (
    <LedgerBlock
      rule={p.rule}
      head={
        <LedgerRow
          rule={false}
          lead={<Stamp color={p.color} emoji={p.emoji} name={p.name} size="md" />}
          title={p.name}
          subtitle={p.subtitle}
          amount={<MoneyDisplay amount={p.used} currency={p.currency} size="inline" />}
          meta={formatPercent(barPct(p.used, p.budget))}
        />
      }
    >
      {p.prorated ? (
        <Text size="xs" tone="muted" figure>
          {p.prorated}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <RuleMeter
          style={{ flex: 1 }}
          used={used}
          total={total}
          near={p.status === "approaching"}
          pct={p.budget > 0 ? (p.used / p.budget) * 100 : undefined}
          label={t("meterLabel", { name: p.name })}
          overLabel={t("statusOver")}
        />
        <BudgetStatusMark status={p.status} overLabel={t("statusOver")} nearLabel={t("statusApproaching")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Input
          key={p.inputKey}
          defaultValue={p.defaultAmount ? String(p.defaultAmount) : ""}
          placeholder={p.placeholder}
          accessibilityLabel={p.budgetAria}
          keyboardType="decimal-pad"
          returnKeyType="done"
          figure
          style={{ flex: 1, height: 36 }}
          onEndEditing={(e) => p.onSave(e.nativeEvent.text)}
        />
        <Button variant="ghost" size="icon" icon={Pencil} textColor={c.mutedForeground} accessibilityLabel={p.editAria} onPress={p.onEdit} />
        <Button
          variant="ghost"
          size="icon"
          icon={Trash2}
          textColor={c.mutedForeground}
          accessibilityLabel={p.deleteAria}
          onPress={p.onDelete}
          disabled={p.deleting}
          isLoading={p.deleting}
        />
      </View>
    </LedgerBlock>
  );
});
