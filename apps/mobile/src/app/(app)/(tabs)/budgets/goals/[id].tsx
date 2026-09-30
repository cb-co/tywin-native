import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { formatMoney } from "@cigua/core/format";
import { useScreen } from "~/lib/query";
import { Card } from "~/components/ui/card";
import { EmptyState, Screen, ScreenError, Skeleton, SkeletonPage, SkeletonText, useSettled } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { Stamp } from "~/components/papel/stamp";
import { ContributionsList } from "~/components/goals/contributions-list";
import { GoalBalanceChart } from "~/components/goals/goal-balance-chart";
import { PaceSummary } from "~/components/goals/goal-progress";
import { GoalStrip } from "~/components/goals/goal-strip";
import { makeStyles } from "~/theme/theme";

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations("GoalDetail");
  const tg = useTranslations("Goals");
  const tApp = useTranslations("App");
  const s = useStyles();
  const { data, refetch, isError, isSuccess } = useScreen("goal", { id });
  const settled = useSettled();

  if (!data) {
    if (isSuccess) {
      return (
        <View style={{ flex: 1, padding: 16 }}>
          <EmptyState title={tApp("notFoundTitle")} description={tApp("notFoundBody")} />
        </View>
      );
    }
    if (isError) return <ScreenError onRetry={() => void refetch()} />;
  }
  if (!data || !settled) return <GoalDetailSkeleton />;

  const { goal, contributions, history, baseCurrency, accounts } = data;

  return (
    <Screen onRefresh={refetch}>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Stamp color={goal.color} emoji={goal.emoji} name={goal.name} size="md" />
          <Text size="2xl" weight={600} tracking={-0.025} accessibilityRole="header" style={{ flex: 1 }}>
            {goal.name}
          </Text>
        </View>
        <Text size="lg" weight={500} figure>
          {tg("amountOfTarget", {
            saved: formatMoney(goal.saved, baseCurrency),
            target: formatMoney(goal.target_amount, baseCurrency),
          })}
        </Text>
        <GoalStrip goal={goal} />
        <PaceSummary pace={goal.pace} currency={baseCurrency} size="sm" />
      </View>

      <Card style={{ padding: 24 }}>
        <Text size="lg" weight={500} accessibilityRole="header" style={{ marginBottom: 16 }}>
          {t("balanceOverTime")}
        </Text>
        <GoalBalanceChart data={history} currency={baseCurrency} />
      </Card>

      <ContributionsList goal={goal} contributions={contributions} accounts={accounts} baseCurrency={baseCurrency} />
    </Screen>
  );
}

/** The header (stamp and name, saved of target, the strip, the pace line), the chart, the contributions. */
function GoalDetailSkeleton() {
  const s = useStyles();
  return (
    <SkeletonPage>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton height={44} width={44} style={{ borderRadius: 22 }} />
          <View style={{ flex: 1 }}>
            <SkeletonText size="2xl" width="55%" />
          </View>
        </View>
        <SkeletonText size="lg" width="50%" />
        <Skeleton height={12} />
        <SkeletonText size="sm" width="60%" />
      </View>
      <Skeleton height={256} style={{ borderRadius: 4 }} />
      <Skeleton height={192} style={{ borderRadius: 4 }} />
    </SkeletonPage>
  );
}

const useStyles = makeStyles((c) => ({
  header: { gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingBottom: 20 },
}));
