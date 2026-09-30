import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useLocale, useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { accountTypeMeta, hasTransferFees, type AccountType } from "@cigua/core/accounts/meta";
import { formatDate, formatDayOfMonth, formatMoney, formatPercent } from "@cigua/core/format";
import { useScreen } from "~/lib/query";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Screen, ScreenError, EmptyState, Skeleton, SkeletonPage, SkeletonText, useSettled } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { CardFace } from "~/components/papel/card-face";
import { Perforation } from "~/components/papel/perforation";
import { Stamp } from "~/components/papel/stamp";
import { MaskedMoney } from "~/components/money/money-display";
import { AccountActivity } from "~/components/accounts/account-activity";
import { AccountDetailActions } from "~/components/accounts/account-detail-actions";
import { AmortizationTable } from "~/components/accounts/amortization-table";
import { BalanceChart } from "~/components/accounts/balance-chart";
import { CardLineRail } from "~/components/accounts/card-line-rail";
import { CardReport } from "~/components/accounts/card-report";
import { StatementsPanel } from "~/components/accounts/statements-panel";
import { accountTypeIcon } from "~/components/accounts/type-icon";
import { SpendLedger } from "~/components/insights/spend-ledger";
import { makeStyles } from "~/theme/theme";

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tApp = useTranslations("App");
  const { data, refetch, isError, isSuccess } = useScreen("account", { id });
  const settled = useSettled();

  if (!data) {
    // A loaded screen with no account: it was deleted, or never existed.
    if (isSuccess) {
      return (
        <View style={{ flex: 1, padding: 16 }}>
          <EmptyState title={tApp("notFoundTitle")} description={tApp("notFoundBody")} />
        </View>
      );
    }
    if (isError) return <ScreenError onRetry={() => void refetch()} />;
  }
  if (!data || !settled) return <AccountDetailSkeleton />;
  return <AccountDetail data={data} onRefresh={refetch} />;
}

/**
 * The header (stamp, name, type line, actions) and the panels below it.
 *
 * It reserves no card face: the account's type is unknown until it loads, and
 * a face is right for cards only, so every chequing account and loan would get
 * a large block that then collapses. The face resolves in instead.
 */
function AccountDetailSkeleton() {
  const s = useStyles();
  return (
    <SkeletonPage>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton height={44} width={44} style={{ borderRadius: 22 }} />
          <View style={{ flex: 1 }}>
            <SkeletonText size="2xl" width="60%" />
            <SkeletonText size="sm" width="40%" />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Skeleton height={32} width={80} />
          <Skeleton height={32} width={96} />
          <Skeleton height={32} width={88} />
        </View>
      </View>
      <Skeleton height={144} style={{ borderRadius: 4 }} />
      <Skeleton height={256} style={{ borderRadius: 4 }} />
      <Skeleton height={192} style={{ borderRadius: 4 }} />
    </SkeletonPage>
  );
}

function AccountDetail({ data, onRefresh }: { data: ScreenData<"account">; onRefresh: () => Promise<unknown> }) {
  const t = useTranslations("AccountDetail");
  const tType = useTranslations("AccountTypes");
  const locale = useLocale();
  const s = useStyles();
  const { account, statements, face, report, spend, transferPaid } = data;

  const type = account.type as AccountType;
  const meta = accountTypeMeta(type);
  const currency = account.currency;
  const isCard = type === "credit_card";
  const isLoan = type === "loan";

  const owed = account.cardStatus?.owed ?? account.current_balance;
  const util = account.cardStatus?.utilization_pct ?? null;
  const outstanding = account.loanStatus?.outstanding_balance ?? account.principal ?? 0;
  // Payments logged here drive the schedule; the display progress also credits
  // installments paid before tracking started.
  const paid = account.loanStatus?.installments_paid ?? 0;
  const progressPaid = account.loanStatus?.progress_installments_paid ?? paid;
  const progressTerm = account.loanStatus?.progress_term_months ?? account.term_months;

  return (
    <>
      {/* The group names the physical card when this account is one line of one. */}
      <Stack.Screen options={{ title: data.cardGroupName ?? "" }} />
      <Screen onRefresh={onRefresh}>
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Stamp color={account.color ?? meta.color} icon={accountTypeIcon(type)} size="md" />
            <View style={{ flex: 1 }}>
              <Text size="2xl" weight={600} tracking={-0.025} accessibilityRole="header">
                {account.name}
              </Text>
              <Text size="sm" tone="muted">
                {tType(type)} · {currency}
                {account.is_archived ? ` · ${t("archived")}` : ""}
              </Text>
            </View>
          </View>
          <AccountDetailActions
            account={account}
            currencies={data.currencies}
            banks={data.banks}
            baseCurrency={data.baseCurrency}
            effectiveBonus={data.effectiveBonus}
            anchoredTo={statements[0]?.period_end ?? null}
          />
        </View>

        <Card style={{ padding: 24, gap: 28 }}>
          {face ? (
            <View style={{ width: "100%", maxWidth: 352, alignSelf: "center" }}>
              <CardFace {...face} />
              <CardLineRail lines={data.cardLines} />
            </View>
          ) : null}
          <View>
            {isCard ? (
              <>
                <Text size="sm" weight={500} tone="muted">
                  {t("balanceOwed")}
                </Text>
                <HeroFigure>{formatMoney(owed, currency)}</HeroFigure>
                {statements[0] ? (
                  <Text size="xs" tone="muted" style={{ marginTop: 4 }}>
                    {t("anchoredToStatement", { date: formatDate(statements[0].period_end, locale) })}
                  </Text>
                ) : null}
                {util !== null ? (
                  <View style={{ marginTop: 16, gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text size="xs" tone="muted">
                        {t("utilization")}
                      </Text>
                      <Text size="xs" tone="muted" figure>
                        {formatPercent(util)}
                      </Text>
                    </View>
                    <Progress value={util} label={t("utilization")} />
                  </View>
                ) : null}
                {account.payment_due_day ? (
                  <Text size="sm" tone="muted" style={{ marginTop: 12 }}>
                    {t("paymentDueEachMonth", { day: formatDayOfMonth(account.payment_due_day) })}
                  </Text>
                ) : null}
              </>
            ) : isLoan ? (
              <>
                <Text size="sm" weight={500} tone="muted">
                  {t("outstandingBalance")}
                </Text>
                <HeroFigure>{formatMoney(outstanding, currency)}</HeroFigure>
                {progressTerm ? (
                  <View style={{ marginTop: 16, gap: 8 }}>
                    <Perforation
                      total={progressTerm}
                      paid={progressPaid}
                      label={t("installmentsPaidOfTerm", { paid: progressPaid, term: progressTerm })}
                      decorative
                    />
                    <Text size="sm" tone="muted">
                      {t("installmentsPaidOfTerm", { paid: progressPaid, term: progressTerm })}
                    </Text>
                  </View>
                ) : (
                  <Text size="sm" tone="muted" style={{ marginTop: 12 }}>
                    {t("installmentsPaidOnly", { paid: progressPaid })}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text size="sm" weight={500} tone="muted">
                  {type === "asset" ? t("estimatedValue") : t("currentBalance")}
                </Text>
                <HeroFigure>
                  <MaskedMoney amount={account.balance ?? account.starting_balance} currency={currency} />
                </HeroFigure>
                <Text size="sm" tone="muted" style={{ marginTop: 12 }}>
                  {t.rich("derivedFromStarting", {
                    amount: () => <MaskedMoney amount={account.starting_balance} currency={currency} />,
                  })}
                </Text>
              </>
            )}
          </View>
        </Card>

        {report ? <CardReport currency={currency} report={report} /> : null}

        {!isCard && !isLoan ? (
          <Card style={{ padding: 24 }}>
            <SectionTitle>{t("balanceOverTime")}</SectionTitle>
            <BalanceChart
              accountId={account.id}
              startingBalance={account.starting_balance}
              currency={currency}
              transactions={data.activity}
            />
          </Card>
        ) : null}

        {spend ? (
          <Card>
            <SectionTitle>{t("spendByCategory")}</SectionTitle>
            {/* Native currency, never converted: every charge here posted to this one account. */}
            <SpendLedger
              data={spend.slices}
              total={spend.total}
              currency={currency}
              month={spend.month}
              scope={{ kind: "account", accountId: account.id }}
            />
          </Card>
        ) : null}

        {isCard ? (
          <StatementsPanel accountId={account.id} currency={currency} statements={statements} triageCounts={data.triageCounts} />
        ) : null}

        {isLoan ? (
          <Card style={{ padding: 24 }}>
            <SectionTitle>{t("amortizationSchedule")}</SectionTitle>
            <AmortizationTable
              principal={account.principal ?? 0}
              annualRate={account.interest_rate ?? 0}
              termMonths={account.term_months ?? 0}
              installment={account.installment_amount}
              currency={currency}
              installmentsPaid={paid}
            />
          </Card>
        ) : null}

        {hasTransferFees(type) ? (
          <Card style={{ padding: 24 }}>
            <SectionTitle>{t("transferFees")}</SectionTitle>
            <View style={s.facts}>
              <Fact label={t("taxRate")} value={formatPercent(account.transfer_tax_rate * 100)} figure />
              <Fact label={t("networkFee")} value={formatMoney(account.network_fee_amount, currency)} figure />
              <Fact label={t("feeIs")} value={account.network_fee_optional ? t("optional") : t("obligatory")} />
            </View>
            {/* Zeros are real answers here: the trigger derives every fee and tax on write. */}
            {transferPaid ? (
              <View style={s.paid}>
                <Text size="sm" weight={500}>
                  {t("transferPaidIn", { year: String(transferPaid.year) })}
                </Text>
                <View style={[s.facts, { marginTop: 12 }]}>
                  <Fact label={t("transferPaidFees")} value={formatMoney(transferPaid.fees, currency)} figure />
                  <Fact label={t("transferPaidTax")} value={formatMoney(transferPaid.tax, currency)} figure />
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        <AccountActivity accountId={account.id} transactions={data.activity} />
      </Screen>
    </>
  );
}

function HeroFigure({ children }: { children: React.ReactNode }) {
  return (
    <Text
      figure
      weight={600}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      style={{ marginTop: 8, fontSize: 34, lineHeight: 38 }}
    >
      {children}
    </Text>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text size="lg" weight={500} accessibilityRole="header" style={{ marginBottom: 16 }}>
      {children}
    </Text>
  );
}

function Fact({ label, value, figure }: { label: string; value: string; figure?: boolean }) {
  return (
    <View style={{ minWidth: 96, flexGrow: 1 }}>
      <Text size="sm" tone="muted">
        {label}
      </Text>
      <Text size="sm" figure={figure}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingBottom: 20 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  paid: { marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, paddingTop: 16 },
}));
