import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import { EmptyState, PageHeader, Screen, ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { TriageList } from "~/components/imports/triage-list";

export default function ImportTriageScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const t = useTranslations("Imports");
  const tApp = useTranslations("App");
  const triage = useScreen("importTriage", { id });
  const quickAdd = useScreen("quickAdd");

  if (!triage.data || !quickAdd.data) {
    if (triage.isSuccess && !triage.data) {
      return (
        <View style={{ flex: 1, padding: 16 }}>
          <EmptyState title={tApp("notFoundTitle")} description={tApp("notFoundBody")} />
        </View>
      );
    }
    return triage.isError || quickAdd.isError ? (
      <ScreenError onRetry={() => void Promise.all([triage.refetch(), quickAdd.refetch()])} />
    ) : (
      <ScreenSkeleton />
    );
  }

  return (
    <Screen onRefresh={triage.refetch}>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription", { fileName: triage.data.fileName, account: triage.data.accountName })}
      />
      <TriageList
        triage={triage.data}
        categories={quickAdd.data.categories}
        categoryOrder={quickAdd.data.categoryOrder}
        fresh={fresh === "1"}
      />
    </Screen>
  );
}
