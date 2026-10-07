import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeftRight,
  Bird,
  CreditCard,
  Landmark,
  Layers,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  PieChart,
  Repeat,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Wallet,
  type LucideIcon,
} from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { TABS } from "@cigua/core/nav/tabs";
import { Badge } from "~/components/ui/badge";
import { Text } from "~/components/ui/text";
import { HelpCallout, HelpChapter } from "~/components/help/chapter";
import {
  AccountsMock,
  AskMock,
  BudgetGroupsMock,
  BudgetsMock,
  InsightsMock,
  LedgerMock,
  OnboardingMock,
  OverviewMock,
  SettingsMock,
  SubscriptionsMock,
  TriageMock,
} from "~/components/help/mocks";
import { makeStyles, useColors } from "~/theme/theme";

function Bullets({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      {items.map((item) => (
        <View key={item} style={{ flexDirection: "row", gap: 8 }}>
          <Text size="sm" tone={muted ? "muted" : "default"}>
            •
          </Text>
          <Text size="sm" tone={muted ? "muted" : "default"} style={{ flex: 1 }}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

function H3({ children }: { children: string }) {
  return (
    <Text size="sm" weight={600} style={{ marginTop: 16, marginBottom: 8 }} accessibilityRole="header">
      {children}
    </Text>
  );
}

function P({ children, muted = true }: { children: string; muted?: boolean }) {
  return (
    <Text size="sm" tone={muted ? "muted" : "default"} style={{ marginTop: 12, lineHeight: 21 }}>
      {children}
    </Text>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((x) => (
        <Badge key={x} variant="outline">
          {x}
        </Badge>
      ))}
    </View>
  );
}

/** The guide: ten chapters, each with a still of the screen it explains, and a rail to jump between them. */
export default function HelpScreen() {
  const t = useTranslations("Help");
  const tTabs = useTranslations("Tabs");
  const tBudgets = useTranslations("Budgets");
  const tGroups = useTranslations("BudgetGroups");
  const tSubs = useTranslations("Subscriptions");
  const c = useColors();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const railOffset = useRef(0);
  const [active, setActive] = useState("getting-started");
  const usedOf = (used: string, budget: string) => tBudgets("amountOfBudget", { used, budget });

  const sections: { id: string; label: string; icon: LucideIcon }[] = [
    { id: "getting-started", label: t("gettingStartedTitle"), icon: Sparkles },
    { id: "overview", label: t("overviewTitle"), icon: LayoutDashboard },
    { id: "accounts", label: t("accountsTitle"), icon: Wallet },
    { id: "transactions", label: t("transactionsTitle"), icon: ArrowLeftRight },
    { id: "budgets", label: t("budgetsTitle"), icon: PieChart },
    { id: "budget-groups", label: t("budgetGroupsTitle"), icon: Layers },
    { id: "recurring", label: t("subscriptionsTitle"), icon: Repeat },
    { id: "insights", label: t("insightsTitle"), icon: LineChart },
    { id: "ask", label: t("askTitle"), icon: MessageCircle },
    { id: "settings", label: t("settingsTitle"), icon: Settings },
  ];

  const mark = (id: string) => (e: LayoutChangeEvent) => {
    offsets.current[id] = e.nativeEvent.layout.y;
  };

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    // The section whose top has passed 40% of the way down the screen.
    const y = e.nativeEvent.contentOffset.y + e.nativeEvent.layoutMeasurement.height * 0.4 - railOffset.current;
    let current = sections[0].id;
    for (const sec of sections) if ((offsets.current[sec.id] ?? Infinity) <= y) current = sec.id;
    if (current !== active) setActive(current);
  }

  const chapter = (id: string, index: number, icon: LucideIcon, title: string, intro: string, children: React.ReactNode) => (
    <View key={id} onLayout={mark(id)}>
      <HelpChapter icon={icon} index={index} title={title} intro={intro} last={id === "settings"}>
        {children}
      </HelpChapter>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t("pageTitle") }} />
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[1]}
        onScroll={onScroll}
        scrollEventThrottle={64}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        <View style={s.header}>
          <Text size="sm" tone="muted">
            {t("pageDescription")}
          </Text>
        </View>

        <View style={s.railWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
            {sections.map(({ id, label, icon: Icon }) => {
              const on = active === id;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="link"
                  accessibilityState={{ selected: on }}
                  onPress={() => scroll.current?.scrollTo({ y: (offsets.current[id] ?? 0) + railOffset.current - 48, animated: true })}
                  style={[s.railItem, on ? s.railOn : null]}
                >
                  <Icon size={16} color={on ? c.foreground : c.mutedForeground} />
                  <Text size="sm" weight={500} tone={on ? "default" : "muted"}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={s.body} onLayout={(e) => (railOffset.current = e.nativeEvent.layout.y)}>
          {chapter("getting-started", 1, Sparkles, t("gettingStartedTitle"), t("gettingStartedIntro"), (
            <>
              <View style={{ gap: 12 }}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <View key={n} style={{ flexDirection: "row", gap: 12 }}>
                    <View style={s.stepNo}>
                      <Text size="xs" figure color={c.primaryForeground}>
                        {n}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text size="sm" weight={600}>
                        {t(`step${n as 1 | 2 | 3 | 4 | 5 | 6}Title`)}
                      </Text>
                      <Text size="sm" tone="muted">
                        {t(`step${n as 1 | 2 | 3 | 4 | 5 | 6}Body`)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <View>
                <HelpCallout icon={Landmark} title={t("bankCalloutTitle")}>
                  {t("bankCalloutBody")}
                </HelpCallout>
                <View style={{ marginTop: 16 }}>
                  <OnboardingMock label={t("onboardingMockLabel")} account={t("onboardingMockAccount")} subtitle={t("onboardingMockSubtitle")} />
                </View>
              </View>
            </>
          ))}

          {chapter("overview", 2, LayoutDashboard, t("overviewTitle"), t("overviewIntro"), (
            <>
              <View>
                <Bullets items={[t("overviewAvailable"), t("overviewNetWorth"), t("overviewStats"), t("overviewUpcoming"), t("overviewFxWarning")]} />
                <P>{t("overviewZeroState")}</P>
                <H3>{t("disponibleTitle")}</H3>
                <Text size="sm" tone="muted" style={{ marginBottom: 8 }}>
                  {t("disponibleIntro")}
                </Text>
                <Bullets items={[t("disponibleLiquid"), t("disponibleCommitted"), t("disponibleCards"), t("disponibleLoans"), t("disponibleSubscriptions")]} />
                <HelpCallout icon={CreditCard} title={t("disponibleZeroCalloutTitle")}>
                  {t("disponibleZeroCalloutBody")}
                </HelpCallout>
                <P>{t("disponiblePeriodNote")}</P>
                <H3>{t("gettingAroundTitle")}</H3>
                <View style={s.navBox}>
                  <Text legend tone="muted" style={{ fontSize: 10, marginBottom: 6 }}>
                    {t("mobileNavTitle")}
                  </Text>
                  <Bullets items={TABS.map((tab) => tTabs(tab.key))} />
                </View>
                <P>{t("navNote")}</P>
              </View>
              <OverviewMock
                availableLabel={t("overviewMockAvailable")}
                availableIfCleared={t("overviewMockAvailableCleared")}
                liquidLabel={t("overviewMockLiquid")}
                committedLabel={t("overviewMockCommitted")}
                cardsLabel={t("overviewMockCards")}
                cardsNote={t("overviewMockCardsNote")}
                loansLabel={t("overviewMockLoans")}
                subscriptionsLabel={t("overviewMockSubscriptions")}
                netWorthLabel={t("overviewMockNetWorth")}
                thisPeriodLabel={t("overviewMockThisPeriod")}
                incomeLabel={t("overviewMockIncome")}
                spentLabel={t("overviewMockSpent")}
                budgetUsedLabel={t("overviewMockBudgetUsed")}
                upcomingItem={t("overviewMockUpcomingItem")}
                upcomingSubtitle={t("overviewMockUpcomingSubtitle")}
              />
            </>
          ))}

          {chapter("accounts", 3, Wallet, t("accountsTitle"), t("accountsIntro"), (
            <>
              <View>
                <Bullets items={[t("accountsAttention"), t("accountsCards"), t("accountsLoans")]} />
                <P>{t("quickAddCardNote")}</P>
                <H3>{t("commonFieldsTitle")}</H3>
                <Chips items={[t("fieldName"), t("fieldBank"), t("fieldCurrency"), t("fieldStartingBalance"), t("fieldTransferTax"), t("fieldNetworkFee")]} />
                <H3>{t("cardFieldsTitle")}</H3>
                <Chips items={[t("fieldBalanceOwed"), t("fieldCreditLimit"), t("fieldClosingDay"), t("fieldDueDay"), t("fieldCardGroup")]} />
                <P>{t("cardGroupNote")}</P>
                <H3>{t("cardFaceTitle")}</H3>
                <Text size="sm" tone="muted">
                  {t("cardFaceBody")}
                </Text>
                <P>{t("cardFaceReroll")}</P>
                <H3>{t("loanFieldsTitle")}</H3>
                <Chips items={[t("fieldPrincipal"), t("fieldInterestRate"), t("fieldTerm"), t("fieldInstallment"), t("fieldStartDate")]} />
                <HelpCallout icon={ShieldCheck} title={t("sameBankCalloutTitle")}>
                  {t("sameBankCalloutBody")}
                </HelpCallout>
                <H3>{t("accountPageTitle")}</H3>
                <Bullets
                  items={[
                    t("accountPageFace"),
                    t("accountPageLines"),
                    t("accountPageBalance"),
                    t("accountPageUtilization"),
                    t("accountPageReport"),
                    t("accountPageSpend"),
                    t("accountPageAmortization"),
                    t("accountPageActivity"),
                    t("accountPageActions"),
                  ]}
                />
                <H3>{t("statementsTitle")}</H3>
                <Text size="sm" tone="muted">
                  {t("statementsBody")}
                </Text>
                <P>{t("triageBody")}</P>
              </View>
              <View style={{ gap: 16 }}>
                <AccountsMock
                  attentionTitle={t("accountsMockAttentionTitle")}
                  attentionOverdue={t("accountsMockAttentionOverdue")}
                  lineCurrent={t("accountsMockLineCurrent")}
                  lineCurrentUtil={t("accountsMockLineCurrentUtil")}
                  lineOther={t("accountsMockLineOther")}
                  lineOtherUtil={t("accountsMockLineOtherUtil")}
                  loanOutstandingLabel={t("accountsMockLoanOutstanding")}
                  loanProgress={t("accountsMockLoanProgress")}
                />
                <TriageMock
                  summary={t("triageMockSummary")}
                  merchantOne={t("triageMockMerchantOne")}
                  merchantOneCount={t("triageMockMerchantOneCount")}
                  merchantTwo={t("triageMockMerchantTwo")}
                  merchantTwoCount={t("triageMockMerchantTwoCount")}
                  categoryOne={t("budgetsMockFood")}
                  categoryTwo={t("budgetsMockTransport")}
                  categoryThree={t("budgetsMockEntertainment")}
                />
              </View>
            </>
          ))}

          {chapter("transactions", 4, ArrowLeftRight, t("transactionsTitle"), t("transactionsIntro"), (
            <>
              <View>
                <Bullets items={[t("typeExpense"), t("typeIncome"), t("typePayment")]} />
                <H3>{t("togglesTitle")}</H3>
                <Bullets items={[t("toggleTax"), t("toggleFee")]} />
                <H3>{t("addingTitle")}</H3>
                <Text size="sm" tone="muted">
                  {t("addingBody")}
                </Text>
                <H3>{t("findingTitle")}</H3>
                <Text size="sm" tone="muted">
                  {t("findingBody")}
                </Text>
                <HelpCallout icon={Tags} title={t("merchantCalloutTitle")}>
                  {t("merchantCalloutBody")}
                </HelpCallout>
              </View>
              <LedgerMock
                dayLabel={t("ledgerMockDay")}
                groceries={t("ledgerMockGroceries")}
                groceriesAccount={t("ledgerMockGroceriesAccount")}
                groceriesBadge={t("ledgerMockGroceriesBadge")}
                paycheck={t("ledgerMockPaycheck")}
                paycheckAccount={t("ledgerMockPaycheckAccount")}
                payment={t("ledgerMockPayment")}
                paymentAccounts={t("ledgerMockPaymentAccounts")}
              />
            </>
          ))}

          {chapter("budgets", 5, PieChart, t("budgetsTitle"), t("budgetsIntro"), (
            <>
              <View>
                <Bullets items={[t("budgetsCategory"), t("budgetsInline"), t("budgetsProgress"), t("budgetsHeader")]} />
                <HelpCallout icon={Repeat} title={t("copyCalloutTitle")}>
                  {t("copyCalloutBody")}
                </HelpCallout>
              </View>
              <BudgetsMock
                month={t("budgetsMockMonth")}
                food={t("budgetsMockFood")}
                transport={t("budgetsMockTransport")}
                entertainment={t("budgetsMockEntertainment")}
                nearLabel={tBudgets("statusApproaching")}
                overLabel={tBudgets("statusOver")}
                usedOf={usedOf}
                usedLabel={tBudgets("usedLabel")}
                remainingLabel={tBudgets("remainingLabel")}
              />
            </>
          ))}

          {chapter("budget-groups", 6, Layers, t("budgetGroupsTitle"), t("budgetGroupsIntro"), (
            <>
              <View>
                <Bullets items={[t("budgetGroupsQualifier"), t("budgetGroupsGroup"), t("budgetGroupsAssign"), t("budgetGroupsOverride")]} />
                <HelpCallout icon={PieChart} title={t("budgetGroupsOptionalTitle")}>
                  {t("budgetGroupsOptionalBody")}
                </HelpCallout>
              </View>
              <BudgetGroupsMock
                heading={tGroups("sectionTitle")}
                essentials={t("budgetGroupsMockEssentials")}
                lifestyle={t("budgetGroupsMockLifestyle")}
                future={t("budgetGroupsMockFuture")}
                nearLabel={tBudgets("statusApproaching")}
                overLabel={tBudgets("statusOver")}
                usedOf={usedOf}
              />
            </>
          ))}

          {chapter("recurring", 7, Repeat, t("subscriptionsTitle"), t("subscriptionsIntro"), (
            <>
              <View>
                <Bullets items={[t("subName"), t("subCycle"), t("subLink"), t("subFees"), t("subViews"), t("subLook")]} />
                <P>{t("subLogCharge")}</P>
              </View>
              <SubscriptionsMock
                heading={tSubs("sectionOther")}
                streaming={t("subscriptionsMockStreaming")}
                streamingCycle={t("subscriptionsMockStreamingCycle")}
                streamingNext={t("subscriptionsMockStreamingNext")}
                transfer={t("subscriptionsMockTransfer")}
                transferCycle={t("subscriptionsMockTransferCycle")}
                transferNext={t("subscriptionsMockTransferNext")}
                addCharge={t("subAddCharge")}
              />
            </>
          ))}

          {chapter("insights", 8, LineChart, t("insightsTitle"), t("insightsIntro"), (
            <>
              <View>
                <Bullets items={[t("insightsCashflow"), t("insightsSpend"), t("insightsBudget"), t("insightsDebt"), t("insightsDebtCost")]} />
                <P>{t("insightsBasis")}</P>
              </View>
              <InsightsMock
                label={t("insightsMockLabel")}
                thisMonth={t("insightsMockThisMonth")}
                essentials={t("legendEssentials")}
                discretionary={t("legendDiscretionary")}
                subscriptions={t("legendSubscriptions")}
                other={t("legendOther")}
              />
            </>
          ))}

          {chapter("ask", 9, MessageCircle, t("askTitle"), t("askIntro"), (
            <>
              <View>
                <Text size="sm">{t("askAnswers")}</Text>
                <P muted={false}>{t("askReadOnly")}</P>
                <P muted={false}>{t("askLimits")}</P>
              </View>
              <AskMock you={t("askMockYou")} question={t("askMockQuestion")} narration={t("askMockNarration")} answer={t("askMockAnswer")} />
            </>
          ))}

          {chapter("settings", 10, Settings, t("settingsTitle"), t("settingsIntro"), (
            <>
              <View>
                <Bullets items={[t("settingsName"), t("settingsPayCycle"), t("settingsTheme"), t("settingsSound"), t("settingsAccount")]} />
                <H3>{t("rulesTitle")}</H3>
                <Text size="sm" tone="muted">
                  {t("rulesBody")}
                </Text>
              </View>
              <SettingsMock
                currencyLabel={t("settingsMockCurrency")}
                currencyValue={t("settingsMockCurrencyValue")}
                themeLabel={t("settingsMockTheme")}
                soundLabel={t("settingsMockSound")}
              />
            </>
          ))}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 16 }}>
            <Bird size={16} color={c.mutedForeground} />
            <Text size="sm" tone="muted" style={{ flex: 1 }}>
              {t("footerNote")}
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  railWrap: { backgroundColor: c.background, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  railItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  railOn: { borderBottomColor: c.rule },
  body: { paddingHorizontal: 16, width: "100%", maxWidth: 720, alignSelf: "center" },
  stepNo: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.primary },
  navBox: { borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, padding: 12 },
}));
