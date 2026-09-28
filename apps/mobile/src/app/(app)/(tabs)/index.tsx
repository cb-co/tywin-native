import { View } from "react-native";
import { router } from "expo-router";
import { CalendarClock, PieChart, Repeat, Wallet } from "~/components/ui/icons";
import { useFormatter, useTranslations } from "use-intl";
import { greetingName } from "@cigua/core/profile";
import { useScreen } from "~/lib/query";
import { Screen, PageHeader, ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { MoneyDisplay } from "~/components/money/money-display";
import { AvailableHero } from "~/components/overview/available-hero";
import { PeriodStub } from "~/components/overview/period-stub";
import { RecommendationCard } from "~/components/overview/recommendation-card";
import { AskEntry } from "~/components/overview/ask-entry";
import { ImportCallout, EmptyOverviewNote } from "~/components/overview/import-callout";
import { ImportButton } from "~/components/statements/import-button";
import { FxDegradedNotice } from "~/components/fx/fx-degraded-notice";
import { useColors } from "~/theme/theme";

const STARTER_LINKS = [
  { href: "/accounts", icon: Wallet, key: "Accounts" },
  { href: "/budgets", icon: PieChart, key: "Budgets" },
  { href: "/recurring", icon: Repeat, key: "Recurring" },
] as const;

export default function OverviewScreen() {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const c = useColors();
  const { data: o, refetch, isError } = useScreen("overview");

  if (!o) return isError ? <ScreenError onRetry={() => void refetch()} /> : <ScreenSkeleton tab />;

  // A name turns the header into a greeting; without one it stays the plain title.
  const name = greetingName(o.displayName, null);

  if (!o.hasAccounts) {
    return (
      <Screen tab onRefresh={refetch}>
        <PageHeader title={name ? t("welcomeNamed", { name }) : t("greetingTitle")} description={t("greetingDescription")} />
        <EmptyOverviewNote currency={o.baseCurrency} />
        <Card flush>
          {STARTER_LINKS.map(({ href, icon: Icon, key }, i) => (
            <LedgerRow
              key={href}
              rule={i < STARTER_LINKS.length - 1}
              onPress={() => router.navigate(href)}
              lead={<Icon size={16} color={c.mutedForeground} />}
              title={t(`starter${key}Title`)}
              subtitle={t(`starter${key}Body`)}
              wrapSubtitle
            />
          ))}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen tab onRefresh={refetch}>
      <PageHeader
        title={name ? t("welcomeNamed", { name }) : t("title")}
        description={t("description")}
        actions={<ImportButton iconOnly />}
      />

      {/* One issued document: the note, then the stub torn along the perforation. */}
      <View>
        <AvailableHero available={o.available} netWorth={o.netWorth} currency={o.baseCurrency} period={o.period} today={o.today} />
        <FxDegradedNotice currencies={o.fxUnconverted} base={o.baseCurrency} style={{ marginVertical: 12 }} />
        <PeriodStub
          income={o.monthIncome}
          spending={o.monthExpense}
          used={o.totalUsed}
          budget={o.totalBudget}
          currency={o.baseCurrency}
        />
      </View>

      {o.importPrompt !== "none" ? <ImportCallout state={o.importPrompt} /> : null}

      <RecommendationCard rec={o.recommendation?.rec ?? null} stale={o.recommendation?.stale ?? false} />
      <AskEntry />

      <View style={{ gap: 8 }}>
        <Text legend tone="muted" accessibilityRole="header" style={{ fontSize: 11 }}>
          {t("upcoming")}
        </Text>
        {o.upcoming.length === 0 ? (
          <Text size="sm" tone="muted">
            {t("upcomingEmpty")}
          </Text>
        ) : (
          <Card flush>
            {o.upcoming.map((item, i) => (
              <LedgerRow
                key={item.key}
                rule={i < o.upcoming.length - 1}
                lead={<CalendarClock size={16} color={c.mutedForeground} />}
                title={item.title}
                subtitle={item.subtitle}
                amount={<MoneyDisplay amount={item.amount} currency={item.currency} size="inline" />}
                meta={f.dateTime(new Date(item.date), { month: "short", day: "numeric" })}
              />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
