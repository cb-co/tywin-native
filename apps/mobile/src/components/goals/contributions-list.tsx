import { useState } from "react";
import { View } from "react-native";
import { Receipt, Trash2 } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import type { ContributableAccount, ScreenData } from "@cigua/worker/api";
import { formatDate, formatMoney } from "@cigua/core/format";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Dialog } from "~/components/ui/overlay";
import { EmptyState } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { LedgerRow, SectionLegend } from "~/components/papel/ledger";
import { useColors } from "~/theme/theme";
import { ContributeSheet } from "./contribute-sheet";

type Detail = NonNullable<ScreenData<"goal">>;
type Contribution = Detail["contributions"][number];

/** Every contribution and withdrawal, newest first, each deletable after a confirmation naming it. */
export function ContributionsList({
  goal,
  contributions,
  accounts,
  baseCurrency,
}: {
  goal: Detail["goal"];
  contributions: Contribution[];
  accounts: ContributableAccount[];
  baseCurrency: string;
}) {
  const t = useTranslations("GoalDetail");
  const tc = useTranslations("Common");
  const tg = useTranslations("Goals");
  const locale = useLocale();
  const c = useColors();
  const { playDelete, playError } = useFeedback();
  const [contributing, setContributing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Contribution | null>(null);

  const describe = (x: Contribution) => ({
    amount: formatMoney(x.amount, x.currency, { signed: true }),
    date: formatDate(x.occurred_at.slice(0, 10), locale),
  });

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const result = await act("goals", "deleteContribution", id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("contributionDeleted"));
      playDelete();
      setConfirmTarget(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <SectionLegend
        aside={
          <Button size="sm" onPress={() => setContributing(true)}>
            {tg("contribute")}
          </Button>
        }
      >
        {t("contributionsTitle")}
      </SectionLegend>

      {contributions.length === 0 ? (
        <EmptyState
          icon={<Receipt size={24} color={c.foreground} />}
          title={t("contributionsEmptyTitle")}
          description={t("contributionsEmptyDescription")}
        />
      ) : (
        <Card flush>
          {contributions.map((x, i) => (
            <LedgerRow
              key={x.id}
              rule={i < contributions.length - 1}
              lead={
                <Text size="xs" tone="muted" figure style={{ width: 56 }}>
                  {formatDate(x.occurred_at.slice(0, 10), locale)}
                </Text>
              }
              title={x.account_name}
              amount={
                <Text size="sm" figure>
                  {formatMoney(x.amount, x.currency, { signed: true })}
                </Text>
              }
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  icon={Trash2}
                  textColor={c.mutedForeground}
                  accessibilityLabel={t("deleteContributionAria", describe(x))}
                  onPress={() => setConfirmTarget(x)}
                  disabled={deletingId === x.id}
                  isLoading={deletingId === x.id}
                />
              }
            />
          ))}
        </Card>
      )}

      <ContributeSheet goal={goal} accounts={accounts} baseCurrency={baseCurrency} open={contributing} onClose={() => setContributing(false)} />
      <Dialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title={t("deleteContributionConfirmTitle")}
        description={confirmTarget ? t("deleteContributionConfirmDescription", describe(confirmTarget)) : ""}
        footer={
          <>
            <Button variant="outline" onPress={() => setConfirmTarget(null)} disabled={deletingId !== null}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onPress={() => confirmTarget && void onDelete(confirmTarget.id)}
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
