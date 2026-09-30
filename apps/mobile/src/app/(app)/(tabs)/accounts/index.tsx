import { View } from "react-native";
import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import { Screen, PageHeader, PageHeaderSkeleton, ScreenError, Skeleton, SkeletonPage, SkeletonText, useSettled } from "~/components/ui/screen";
import { Card } from "~/components/ui/card";
import { AccountGallery } from "~/components/accounts/account-gallery";
import { AddAccountControl } from "~/components/accounts/add-account-control";
import { AttentionLedger } from "~/components/accounts/attention-ledger";
import { useCardArtBackfill } from "~/components/accounts/card-art-backfill";

export default function AccountsScreen() {
  const t = useTranslations("Accounts");
  const { data, refetch, isError } = useScreen("accounts");
  useCardArtBackfill(data?.pendingArt ?? 0);
  const settled = useSettled();

  if (!data && isError) return <ScreenError onRetry={() => void refetch()} />;
  if (!data || !settled) return <AccountsSkeleton />;

  return (
    <Screen tab onRefresh={refetch}>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        actions={
          data.accounts.length > 0 ? (
            <AddAccountControl currencies={data.currencies} banks={data.banks} baseCurrency={data.baseCurrency} label={t("addAccount")} />
          ) : undefined
        }
      />
      <AttentionLedger items={data.attention} />
      <AccountGallery
        accounts={data.accounts}
        currencies={data.currencies}
        cardGroups={data.cardGroups}
        banks={data.banks}
        baseCurrency={data.baseCurrency}
      />
    </Screen>
  );
}

/** A group heading with its blurb, as the gallery prints one. */
function GroupHeadingSkeleton() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ width: "35%" }}>
        <SkeletonText size="lg" />
      </View>
      <Skeleton height={10} width={128} />
    </View>
  );
}

/**
 * The gallery's two usual bands: cards first (always shown, a face on its
 * tile), then one band of plain account tiles. The attention ledger reserves
 * nothing; most months it prints nothing at all.
 */
function AccountsSkeleton() {
  return (
    <SkeletonPage tab>
      <PageHeaderSkeleton title="45%" action={132} />
      <View style={{ gap: 40 }}>
        <View style={{ gap: 16 }}>
          <GroupHeadingSkeleton />
          <Card style={{ padding: 20, gap: 16 }}>
            <Skeleton ratio={1.7} style={{ borderRadius: 18 }} />
            <SkeletonText size="sm" width="40%" />
          </Card>
        </View>
        <View style={{ gap: 16 }}>
          <GroupHeadingSkeleton />
          <Skeleton height={144} style={{ borderRadius: 4 }} />
          <Skeleton height={144} style={{ borderRadius: 4 }} />
        </View>
      </View>
    </SkeletonPage>
  );
}
