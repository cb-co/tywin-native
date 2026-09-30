import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { CopyPlus, PieChart } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { budgetLabelParts } from "@cigua/core/budgets/label";
import { normalizeMonth } from "@cigua/core/budgets/month";
import type { PayCycle, Period } from "@cigua/core/period/cycle";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState, Skeleton } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { SectionLegend } from "~/components/papel/ledger";
import { useMaskedFormatMoney } from "~/components/money/figure-mask";
import { useColors } from "~/theme/theme";
import { BudgetLine } from "./budget-line";
import { BudgetNote } from "./budget-note";
import { CategorySheet } from "./category-sheet";
import { PeriodPicker, type PeriodMode } from "./period-picker";

type Budgets = ScreenData<"budgets">;
type Category = Budgets["overview"]["rows"][number];

/**
 * The period toolbar, the peso note, the group band (handed in, so the note
 * leads), then every category as a budget line. `navPending` draws skeletons
 * while another period loads.
 */
export function BudgetGrid({
  overview,
  mode,
  payCycle,
  payAnchor,
  groups,
  groupBand,
  navPending,
  onNavigate,
}: {
  overview: Budgets["overview"];
  mode: PeriodMode;
  payCycle: PayCycle;
  payAnchor: number | null;
  groups: Budgets["groupOverview"]["rows"];
  groupBand: React.ReactNode;
  navPending: boolean;
  onNavigate: (period: Period, mode: PeriodMode) => void;
}) {
  const t = useTranslations("Budgets");
  const c = useColors();
  const maskedFormatMoney = useMaskedFormatMoney();
  const { playSuccess, playDelete, playError } = useFeedback();
  const [copying, setCopying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const { rows, totalBudget, totalUsed, baseCurrency, period } = overview;
  // Budgets are stored by month: the input and "copy last month" target the
  // month holding the period's start.
  const month = normalizeMonth(period.start);

  async function onSaveBudget(categoryId: string, raw: string, current: number) {
    const amount = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(amount) || amount === current) return;
    const result = await act("budgets", "setBudget", { category_id: categoryId, month, amount });
    if (result.error) {
      toast.error(result.error);
      playError();
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const result = await act("budgets", "deleteCategory", id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("categoryDeleted"));
      playDelete();
    } finally {
      setDeletingId(null);
    }
  }

  async function onCopy() {
    setCopying(true);
    try {
      const result = await act("budgets", "copyPreviousMonth", month);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("budgetsCopied"));
      playSuccess();
    } finally {
      setCopying(false);
    }
  }

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 12 }}>
        <PeriodPicker period={period} mode={mode} payCycle={payCycle} payAnchor={payAnchor} pending={navPending} onNavigate={onNavigate} />
        <Button
          variant="outline"
          size="sm"
          icon={CopyPlus}
          onPress={() => void onCopy()}
          disabled={copying || navPending}
          isLoading={copying}
          style={{ alignSelf: "flex-start" }}
        >
          {t("copyLastMonth")}
        </Button>
      </View>

      {navPending ? (
        <Skeleton height={176} style={{ borderRadius: 6 }} />
      ) : rows.length > 0 ? (
        <BudgetNote totalBudget={totalBudget} totalUsed={totalUsed} currency={baseCurrency} periodStart={period.start} />
      ) : null}

      {!navPending && overview.uncategorized > 0 ? (
        <Text size="sm" tone="muted">
          {t("uncategorizedLine", { amount: maskedFormatMoney(overview.uncategorized, baseCurrency) })}{" "}
          {overview.pendingTriageImportId ? (
            <Text
              size="sm"
              tone="muted"
              accessibilityRole="link"
              style={{ textDecorationLine: "underline" }}
              onPress={() => router.push({ pathname: "/accounts/imports/[id]", params: { id: overview.pendingTriageImportId! } })}
            >
              {t("uncategorizedAction")}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {groupBand}

      <View style={{ gap: 16 }}>
        <SectionLegend>{t("sectionTitle")}</SectionLegend>
        {navPending ? (
          <View style={{ gap: 1 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={96} style={{ borderRadius: 0 }} />
            ))}
          </View>
        ) : rows.length === 0 ? (
          <EmptyState icon={<PieChart size={24} color={c.foreground} />} title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <Card flush>
            {rows.map((row, i) => {
              // A null `prorated` means one figure: a whole month, or nothing budgeted.
              const parts = budgetLabelParts(period, row.budget_monthly, row.budget);
              return (
                <BudgetLine
                  key={row.category_id}
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
                      ? t(payCycle === "weekly" ? "budgetProratedWeekly" : "budgetProrated", {
                          monthly: maskedFormatMoney(parts.monthly, baseCurrency),
                          prorated: maskedFormatMoney(parts.prorated, baseCurrency),
                        })
                      : null
                  }
                  inputKey={`${row.category_id}-${row.budget_monthly}`}
                  defaultAmount={row.budget_monthly}
                  placeholder={t("amountPlaceholder")}
                  budgetAria={t("budgetForAria", { name: row.name })}
                  onSave={(raw) => void onSaveBudget(row.category_id, raw, row.budget_monthly)}
                  editAria={t("editAria", { name: row.name })}
                  onEdit={() => setEditing(row)}
                  deleteAria={t("deleteAria", { name: row.name })}
                  onDelete={() => void onDelete(row.category_id)}
                  deleting={deletingId === row.category_id}
                />
              );
            })}
          </Card>
        )}
      </View>
      <CategorySheet mode="edit" category={editing ?? undefined} groups={groups} open={editing !== null} onClose={() => setEditing(null)} />
    </View>
  );
}
