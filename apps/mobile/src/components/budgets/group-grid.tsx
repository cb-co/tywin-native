import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { budgetLabelParts } from "@cigua/core/budgets/label";
import { normalizeMonth } from "@cigua/core/budgets/month";
import { isWholeMonth, type PayCycle } from "@cigua/core/period/cycle";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { SectionLegend } from "~/components/papel/ledger";
import { useMaskedFormatMoney } from "~/components/money/figure-mask";
import { BudgetLine } from "./budget-line";
import { GroupSheet } from "./group-sheet";
import { usePeriodLabel } from "./period-picker";

type GroupOverview = ScreenData<"budgets">["groupOverview"];
type Group = GroupOverview["rows"][number];

/**
 * The planning band above the categories. Nothing at all until the first group
 * exists, so a person who never made one sees the screen as it always was. It
 * draws money exactly as the category band does, with no totals row (a group
 * plan and a category plan answer different questions) and no picker of its own.
 */
export function GroupGrid({ overview, payCycle }: { overview: GroupOverview; payCycle: PayCycle }) {
  const t = useTranslations("BudgetGroups");
  const tb = useTranslations("Budgets");
  const maskedFormatMoney = useMaskedFormatMoney();
  const labelFor = usePeriodLabel();
  const { playDelete, playError } = useFeedback();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Group | null>(null);
  const { rows, baseCurrency, period } = overview;
  // Group budgets are stored by month, like category budgets.
  const month = normalizeMonth(period.start);

  async function onSaveBudget(groupId: string, raw: string, current: number) {
    const amount = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(amount) || amount === current) return;
    const result = await act("budgetGroups", "setGroupBudget", { budget_group_id: groupId, month, amount });
    if (result.error) {
      toast.error(result.error);
      playError();
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const result = await act("budgetGroups", "deleteBudgetGroup", id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("groupDeleted"));
      playDelete();
    } finally {
      setDeletingId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <View style={{ gap: 16 }}>
      <SectionLegend
        aside={
          <Text size="xs" tone="muted">
            {labelFor(period, isWholeMonth(period) ? "month" : "native")}
          </Text>
        }
      >
        {t("sectionTitle")}
      </SectionLegend>
      <Card flush>
        {rows.map((row, i) => {
          const parts = budgetLabelParts(period, row.budget_monthly, row.budget);
          return (
            <BudgetLine
              key={row.budget_group_id}
              rule={i < rows.length - 1}
              name={row.name}
              color={row.color}
              emoji={row.emoji}
              used={row.used}
              budget={row.budget}
              status={row.status}
              currency={baseCurrency}
              subtitle={t("amountOfBudget", {
                used: maskedFormatMoney(row.used, baseCurrency),
                budget: maskedFormatMoney(row.budget, baseCurrency),
              })}
              prorated={
                parts.prorated !== null
                  ? tb(payCycle === "weekly" ? "budgetProratedWeekly" : "budgetProrated", {
                      monthly: maskedFormatMoney(parts.monthly, baseCurrency),
                      prorated: maskedFormatMoney(parts.prorated, baseCurrency),
                    })
                  : null
              }
              inputKey={`${row.budget_group_id}-${row.budget_monthly}`}
              defaultAmount={row.budget_monthly}
              placeholder={t("amountPlaceholder")}
              budgetAria={t("budgetForAria", { name: row.name })}
              onSave={(raw) => void onSaveBudget(row.budget_group_id, raw, row.budget_monthly)}
              editAria={t("editAria", { name: row.name })}
              onEdit={() => setEditing(row)}
              deleteAria={t("deleteAria", { name: row.name })}
              onDelete={() => void onDelete(row.budget_group_id)}
              deleting={deletingId === row.budget_group_id}
            />
          );
        })}
      </Card>
      <GroupSheet mode="edit" group={editing ?? undefined} open={editing !== null} onClose={() => setEditing(null)} />
    </View>
  );
}
