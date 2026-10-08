import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarClock, PieChart, Repeat, Wallet } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import type { UpcomingItem } from "@cigua/worker/api";
import { formatDate } from "@cigua/core/format";
import { greetingName } from "@cigua/core/profile";
import { useScreen } from "~/lib/query";
import {
  Screen,
  PageHeader,
  PageHeaderSkeleton,
  RowsSkeleton,
  ScreenError,
  SectionLegendSkeleton,
  Skeleton,
  SkeletonPage,
  SkeletonText,
  useSettled,
} from "~/components/ui/screen";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { MoneyDisplay } from "~/components/money/money-display";
import { useMaskedFormatMoney } from "~/components/money/figure-mask";
import { AvailableHero } from "~/components/overview/available-hero";
import { PeriodStub } from "~/components/overview/period-stub";
import { RecommendationCard } from "~/components/overview/recommendation-card";
import { AskEntry } from "~/components/overview/ask-entry";
import { ImportCallout, EmptyOverviewNote } from "~/components/overview/import-callout";
import { ImportButton } from "~/components/statements/import-button";
import { StatementImportSheet } from "~/components/statements/statement-import-sheet";
import { RemindersCallout } from "~/components/overview/reminders-callout";
import { FxDegradedNotice } from "~/components/fx/fx-degraded-notice";
import { useColors } from "~/theme/theme";

const STARTER_LINKS = [
  { href: "/accounts", icon: Wallet, key: "Accounts" },
  { href: "/budgets", icon: PieChart, key: "Budgets" },
  { href: "/recurring", icon: Repeat, key: "Recurring" },
] as const;

export default function OverviewScreen() {
  const t = useTranslations("Overview");
  const c = useColors();
  const { data: o, refetch, isError } = useScreen("overview");
  const settled = useSettled();
  // `?import=1` is where a statement reminder lands: straight into the importer.
  const { import: importParam } = useLocalSearchParams<{ import?: string }>();

  if (!o && isError) return <ScreenError onRetry={() => void refetch()} />;
  if (!o || !settled) return <OverviewSkeleton />;

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
      <RemindersCallout hasSomethingDue={o.upcoming.length > 0} />

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
              <UpcomingRow key={item.key} item={item} today={o.today} rule={i < o.upcoming.length - 1} />
            ))}
          </Card>
        )}
      </View>
      <StatementImportSheet open={importParam === "1"} onClose={() => router.setParams({ import: undefined })} />
    </Screen>
  );
}

/**
 * One thing coming due. A card with a statement leads with the minimum still
 * left — the deadline that costs a late fee — and keeps the cutoff balance
 * standing beside it; once the minimum is paid the row carries the rest of the
 * balance. A past date is flagged rather than dropped: it is the row that
 * matters most.
 */
function UpcomingRow({ item, today, rule }: { item: UpcomingItem; today: string; rule: boolean }) {
  const t = useTranslations("Overview");
  const locale = useLocale();
  const c = useColors();
  const money = useMaskedFormatMoney();
  const date = formatDate(item.date, locale, { month: "short", day: "numeric" });
  const overdue = item.date < today;
  const subtitle = !item.card
    ? item.subtitle
    : item.card.basis === "minimum"
      ? t("upcomingCardMinimum", { balance: money(item.card.statementLeft, item.currency) })
      : item.card.minimumPaid
        ? t("upcomingCardMinimumPaid")
        : t("upcomingCardStatement");
  return (
    <LedgerRow
      rule={rule}
      lead={<CalendarClock size={16} color={overdue ? c.red : c.mutedForeground} />}
      title={item.title}
      subtitle={subtitle}
      amount={<MoneyDisplay amount={item.amount} currency={item.currency} size="inline" />}
      meta={
        overdue ? (
          <Text size="xs" tone="red" figure align="right">
            {t("upcomingOverdue", { date })}
          </Text>
        ) : (
          date
        )
      }
    />
  );
}

/** The page above, unprinted: the note and its stub, the margin note, Ask, Upcoming. */
function OverviewSkeleton() {
  const c = useColors();
  return (
    <SkeletonPage tab>
      <PageHeaderSkeleton title="60%" action={40} />
      <View>
        <Skeleton height={248} style={{ borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
        <RowsSkeleton rows={3} mark={false} subtitle={false} />
      </View>
      <View style={{ borderLeftWidth: 2, borderLeftColor: c.paperLine, paddingLeft: 16 }}>
        <SkeletonText size="base" width="55%" />
        <SkeletonText size="sm" width="90%" />
      </View>
      <View style={{ height: 52, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: c.paperLine }}>
        <Skeleton height={14} width="60%" />
      </View>
      <View style={{ gap: 8 }}>
        <SectionLegendSkeleton width={88} />
        <RowsSkeleton rows={3} mark={16} />
      </View>
    </SkeletonPage>
  );
}
