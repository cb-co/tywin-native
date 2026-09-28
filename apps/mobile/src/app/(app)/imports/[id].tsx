import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import {
  EmptyState,
  PageHeader,
  PageHeaderSkeleton,
  Screen,
  ScreenError,
  Skeleton,
  SkeletonPage,
  SkeletonText,
  lineWidth,
  useSettled,
} from "~/components/ui/screen";
import { useColors } from "~/theme/theme";
import { TriageList } from "~/components/imports/triage-list";

export default function ImportTriageScreen() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const t = useTranslations("Imports");
  const tApp = useTranslations("App");
  const triage = useScreen("importTriage", { id });
  const quickAdd = useScreen("quickAdd");
  const settled = useSettled();

  if (!triage.data || !quickAdd.data || !settled) {
    if (triage.isSuccess && !triage.data) {
      return (
        <View style={{ flex: 1, padding: 16 }}>
          <EmptyState title={tApp("notFoundTitle")} description={tApp("notFoundBody")} />
        </View>
      );
    }
    return (!triage.data && triage.isError) || (!quickAdd.data && quickAdd.isError) ? (
      <ScreenError onRetry={() => void Promise.all([triage.refetch(), quickAdd.refetch()])} />
    ) : (
      <TriageSkeleton />
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

/** The header, the summary line, then the sheet of ledger blocks, each with its category picker. */
function TriageSkeleton() {
  const c = useColors();
  return (
    <SkeletonPage>
      <PageHeaderSkeleton title="55%" />
      <SkeletonText size="sm" width="65%" />
      <View style={{ borderWidth: 1, borderColor: c.paperLine }}>
        {[0, 1, 2, 3].map((block) => (
          <View
            key={block}
            style={{ gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: block < 3 ? 2 : 0, borderBottomColor: c.paperLine }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <SkeletonText size="sm" width={lineWidth(block, 50, 30)} />
                <SkeletonText size="xs" width="70%" />
              </View>
              <Skeleton height={12} width={64} />
            </View>
            <Skeleton height={32} />
          </View>
        ))}
      </View>
    </SkeletonPage>
  );
}
