import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { AccountWithStatus, BankRow, CardGroupRow, CurrencyRow } from "@cigua/worker/api";
import { ACCOUNT_GROUPS, accountTypeMeta, type GroupKey } from "@cigua/core/accounts/meta";
import { EmptyState } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { SpotIllustration } from "~/components/brand/spot-illustration";
import { StatementImportSheet } from "~/components/statements/statement-import-sheet";
import { AccountCard } from "./account-card";
import { CardGroupTile } from "./card-group-tile";
import { AddAccountControl } from "./add-account-control";
import { useColors } from "~/theme/theme";

/** Cluster credit cards by card_group_id; solo cards keep a unique key. */
function clusterCards(items: AccountWithStatus[]) {
  const map = new Map<string, AccountWithStatus[]>();
  const order: string[] = [];
  for (const a of items) {
    const key = a.card_group_id ?? `solo:${a.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(a);
  }
  return order.map((key) => ({ key, items: map.get(key)! }));
}

/** The fast path onto the Cards section: a card name and currency, then its statement. */
function QuickAddCardControl() {
  const t = useTranslations("Accounts");
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Plus size={14} color={c.primary} />
        <Text size="xs" weight={500} tone="primary">
          {t("quickAddCard")}
        </Text>
      </Pressable>
      <StatementImportSheet open={open} onClose={() => setOpen(false)} forceStub />
    </>
  );
}

export function AccountGallery({
  accounts,
  currencies,
  cardGroups,
  banks,
  baseCurrency,
}: {
  accounts: AccountWithStatus[];
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
}) {
  const t = useTranslations("Accounts");
  const { width } = useWindowDimensions();
  const columns = width >= 1024 ? 3 : width >= 640 ? 2 : 1;
  const groupById = new Map(cardGroups.map((g) => [g.id, g]));
  const labels: Record<GroupKey, { title: string; blurb: string }> = {
    cash: { title: t("groupCashTitle"), blurb: t("groupCashBlurb") },
    assets: { title: t("groupAssetsTitle"), blurb: t("groupAssetsBlurb") },
    cards: { title: t("groupCardsTitle"), blurb: t("groupCardsBlurb") },
    loans: { title: t("groupLoansTitle"), blurb: t("groupLoansBlurb") },
  };

  if (accounts.length === 0) {
    return (
      <EmptyState
        illustration={<SpotIllustration scene="wallet" size={112} />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={<AddAccountControl currencies={currencies} banks={banks} baseCurrency={baseCurrency} label={t("addFirstAccount")} />}
      />
    );
  }

  const groups = ACCOUNT_GROUPS.map((g) => ({ ...g, items: accounts.filter((a) => accountTypeMeta(a.type).group === g.key) })).filter(
    (g) => g.key === "cards" || g.items.length > 0,
  );

  const grid = (tiles: React.ReactNode[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      {tiles.map((tile, i) => (
        <View key={i} style={{ width: columns === 1 ? "100%" : `${100 / columns - 2}%` }}>
          {tile}
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ gap: 40 }}>
      {groups.map((group) => (
        <View key={group.key} style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <Text size="lg" weight={500} accessibilityRole="header">
              {labels[group.key].title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
              <Text size="xs" tone="muted" style={{ flexShrink: 1 }}>
                {group.key === "cards" && group.items.length === 0 ? t("groupCardsEmptyBlurb") : labels[group.key].blurb}
              </Text>
              {group.key === "cards" ? <QuickAddCardControl /> : null}
            </View>
          </View>
          {group.items.length > 0
            ? grid(
                group.key === "cards"
                  ? clusterCards(group.items).map((cluster) => {
                      const cardGroup = groupById.get(cluster.key);
                      return cardGroup ? (
                        <CardGroupTile
                          key={cluster.key}
                          name={cardGroup.name}
                          brand={cardGroup.brand}
                          artColor={cardGroup.art_color}
                          accounts={cluster.items}
                          baseCurrency={baseCurrency}
                        />
                      ) : (
                        <AccountCard key={cluster.key} account={cluster.items[0]} />
                      );
                    })
                  : group.items.map((account) => <AccountCard key={account.id} account={account} />),
              )
            : null}
        </View>
      ))}
    </View>
  );
}
