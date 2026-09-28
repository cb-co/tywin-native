import { useState } from "react";
import { View } from "react-native";
import { Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import { Button } from "~/components/ui/button";
import { PageHeader, PageHeaderSkeleton, RowsSkeleton, Screen, ScreenError, Skeleton, SkeletonPage, useSettled } from "~/components/ui/screen";
import { useColors } from "~/theme/theme";
import { SubscriptionFormSheet } from "~/components/subscriptions/subscription-form-sheet";
import { SubscriptionsView } from "~/components/subscriptions/subscriptions-view";

export default function RecurringScreen() {
  const t = useTranslations("Subscriptions");
  const recurring = useScreen("recurring");
  const quickAdd = useScreen("quickAdd");
  const [adding, setAdding] = useState(false);
  const settled = useSettled();

  if (!recurring.data || !quickAdd.data || !settled) {
    return (!recurring.data && recurring.isError) || (!quickAdd.data && quickAdd.isError) ? (
      <ScreenError onRetry={() => void Promise.all([recurring.refetch(), quickAdd.refetch()])} />
    ) : (
      <RecurringSkeleton />
    );
  }

  return (
    <Screen tab onRefresh={() => Promise.all([recurring.refetch(), quickAdd.refetch()])}>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        actions={
          <Button icon={Plus} onPress={() => setAdding(true)}>
            {t("addSubscription")}
          </Button>
        }
      />
      <SubscriptionsView subscriptions={recurring.data.subscriptions} data={quickAdd.data} />
      <SubscriptionFormSheet mode="create" data={quickAdd.data} open={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

/** The page above, unprinted: the ruled monthly total, then the subscriptions. */
function RecurringSkeleton() {
  const c = useColors();
  return (
    <SkeletonPage tab>
      <PageHeaderSkeleton title="45%" action={148} />
      <View style={{ gap: 24 }}>
        <View style={{ gap: 8, borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.paperLine, paddingVertical: 16 }}>
          <Skeleton height={10} width={120} />
          <Skeleton height={28} width={160} />
        </View>
        <RowsSkeleton rows={5} />
      </View>
    </SkeletonPage>
  );
}
