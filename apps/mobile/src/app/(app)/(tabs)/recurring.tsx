import { useState } from "react";
import { Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import { Button } from "~/components/ui/button";
import { PageHeader, Screen, ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { SubscriptionFormSheet } from "~/components/subscriptions/subscription-form-sheet";
import { SubscriptionsView } from "~/components/subscriptions/subscriptions-view";

export default function RecurringScreen() {
  const t = useTranslations("Subscriptions");
  const recurring = useScreen("recurring");
  const quickAdd = useScreen("quickAdd");
  const [adding, setAdding] = useState(false);

  if (!recurring.data || !quickAdd.data) {
    return recurring.isError || quickAdd.isError ? (
      <ScreenError onRetry={() => void Promise.all([recurring.refetch(), quickAdd.refetch()])} />
    ) : (
      <ScreenSkeleton tab />
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
