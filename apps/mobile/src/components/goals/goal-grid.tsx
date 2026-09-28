import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Pencil, PiggyBank, Plus, Trash2 } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { GoalCardRow, GoalsOverview } from "@cigua/worker/api";
import { formatMoney, formatPercent } from "@cigua/core/format";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Dialog } from "~/components/ui/overlay";
import { EmptyState } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { LedgerBlock, LedgerRow, SectionLegend } from "~/components/papel/ledger";
import { Stamp } from "~/components/papel/stamp";
import { MoneyDisplay } from "~/components/money/money-display";
import { useColors } from "~/theme/theme";
import { ContributeSheet } from "./contribute-sheet";
import { GoalSheet } from "./goal-sheet";
import { PaceSummary, goalProgressPct } from "./goal-progress";
import { GoalStrip } from "./goal-strip";

/**
 * Savings goals: the totals line (saved, target, and how much is really backed),
 * then one block per goal with its strip, pace, and contribute / edit / delete.
 * Deleting takes the whole contribution history, so it asks first.
 */
export function GoalGrid({ overview }: { overview: GoalsOverview }) {
  const t = useTranslations("Goals");
  const tc = useTranslations("Common");
  const c = useColors();
  const { playDelete, playError } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<GoalCardRow | null>(null);
  const [contributing, setContributing] = useState<GoalCardRow | null>(null);
  const [confirmGoal, setConfirmGoal] = useState<GoalCardRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { goals, totalSaved, totalTarget, totalBacked, totalShortfall, baseCurrency, accounts } = overview;

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const result = await act("goals", "deleteGoal", id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("goalDeleted"));
      playDelete();
      setConfirmGoal(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <SectionLegend
        aside={
          <Button size="sm" icon={Plus} onPress={() => setAdding(true)}>
            {t("addGoal")}
          </Button>
        }
      >
        {t("sectionTitle")}
      </SectionLegend>

      {goals.length > 0 ? (
        <Text size="sm" tone="muted" figure>
          {t("totals", {
            saved: formatMoney(totalSaved, baseCurrency),
            target: formatMoney(totalTarget, baseCurrency),
            backed: formatMoney(totalBacked, baseCurrency),
          })}
          {totalShortfall > 0 ? ` · ${t("totalsBorrowed", { amount: formatMoney(totalShortfall, baseCurrency) })}` : ""}
        </Text>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState icon={<PiggyBank size={24} color={c.foreground} />} title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <Card flush>
          {goals.map((goal, i) => (
            <LedgerBlock
              key={goal.id}
              rule={i < goals.length - 1}
              head={
                <LedgerRow
                  rule={false}
                  onPress={() => router.push({ pathname: "/goals/[id]", params: { id: goal.id } })}
                  accessibilityLabel={goal.name}
                  lead={<Stamp color={goal.color} emoji={goal.emoji} name={goal.name} size="md" />}
                  title={goal.name}
                  subtitle={t("amountOfTarget", {
                    saved: formatMoney(goal.saved, baseCurrency),
                    target: formatMoney(goal.target_amount, baseCurrency),
                  })}
                  amount={<MoneyDisplay amount={goal.saved} currency={baseCurrency} size="inline" />}
                  meta={formatPercent(goalProgressPct(goal))}
                />
              }
            >
              <GoalStrip goal={goal} decorative />
              <PaceSummary pace={goal.pace} currency={baseCurrency} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Button size="sm" variant="outline" style={{ flex: 1 }} onPress={() => setContributing(goal)}>
                  {t("contribute")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Pencil}
                  textColor={c.mutedForeground}
                  accessibilityLabel={t("editAria", { name: goal.name })}
                  onPress={() => setEditing(goal)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Trash2}
                  textColor={c.mutedForeground}
                  accessibilityLabel={t("deleteAria", { name: goal.name })}
                  onPress={() => setConfirmGoal(goal)}
                  disabled={deletingId === goal.id}
                  isLoading={deletingId === goal.id}
                />
              </View>
            </LedgerBlock>
          ))}
        </Card>
      )}

      <GoalSheet mode="create" open={adding} onClose={() => setAdding(false)} />
      <GoalSheet mode="edit" goal={editing ?? undefined} open={editing !== null} onClose={() => setEditing(null)} />
      {contributing ? (
        <ContributeSheet
          goal={contributing}
          accounts={accounts}
          baseCurrency={baseCurrency}
          open
          onClose={() => setContributing(null)}
        />
      ) : null}
      <Dialog
        open={confirmGoal !== null}
        onClose={() => setConfirmGoal(null)}
        title={t("deleteConfirmTitle", { name: confirmGoal?.name ?? "" })}
        description={t("deleteConfirmDescription", { name: confirmGoal?.name ?? "" })}
        footer={
          <>
            <Button variant="outline" onPress={() => setConfirmGoal(null)} disabled={deletingId !== null}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onPress={() => confirmGoal && void onDelete(confirmGoal.id)}
              disabled={deletingId !== null}
              isLoading={deletingId !== null}
            >
              {deletingId !== null ? t("deleting") : tc("delete")}
            </Button>
          </>
        }
      />
    </View>
  );
}
