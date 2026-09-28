import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import { Screen, PageHeader, ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { AccountGallery } from "~/components/accounts/account-gallery";
import { AddAccountControl } from "~/components/accounts/add-account-control";
import { AttentionLedger } from "~/components/accounts/attention-ledger";
import { useCardArtBackfill } from "~/components/accounts/card-art-backfill";

export default function AccountsScreen() {
  const t = useTranslations("Accounts");
  const { data, refetch, isError } = useScreen("accounts");
  useCardArtBackfill(data?.pendingArt ?? 0);

  if (!data) return isError ? <ScreenError onRetry={() => void refetch()} /> : <ScreenSkeleton tab />;

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
