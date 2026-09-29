import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { AccountWithStatus } from "@cigua/worker/api";
import { inferLast4, inferNetwork } from "@cigua/core/accounts/network";
import { formatDayOfMonth, formatMoney, formatPercent } from "@cigua/core/format";
import { accountTypeMeta, type AccountType } from "@cigua/core/accounts/meta";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Text } from "~/components/ui/text";
import { Perforation } from "~/components/papel/perforation";
import { Stamp } from "~/components/papel/stamp";
import { ProofMark } from "~/components/papel/proof-mark";
import { CardFace } from "~/components/papel/card-face";
import { MoneyDisplay, MaskedMoney } from "~/components/money/money-display";
import { accountTypeIcon } from "./type-icon";
import { useColors } from "~/theme/theme";

/** One account's tile. A card that belongs to a group is drawn by its group tile instead. */
export function AccountCard({ account }: { account: AccountWithStatus }) {
  const t = useTranslations("Accounts");
  const tType = useTranslations("AccountTypes");
  const c = useColors();
  const type = account.type as AccountType;
  const meta = accountTypeMeta(type);
  const currency = account.currency;
  const isStandaloneCard = type === "credit_card" && !account.card_group_id;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={account.name}
      onPress={() => router.push({ pathname: "/accounts/[id]", params: { id: account.id } })}
    >
      {({ pressed }) => (
        <Card style={[{ padding: 20 }, pressed ? { borderColor: c.inkSoft } : null]}>
          {isStandaloneCard ? (
            <CardFace
              name={account.name}
              last4={inferLast4(account.name, account.last4)}
              network={inferNetwork(account.name, account.brand)}
              accent={account.color}
            />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <Stamp color={account.color ?? meta.color} icon={accountTypeIcon(type)} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size="base" weight={500} numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text size="xs" tone="muted">
                    {tType(type)} · {currency}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color={c.mutedForeground} style={{ opacity: 0.5 }} />
            </View>
          )}

          {type === "credit_card" ? (
            <CardBody
              owed={account.cardStatus?.owed ?? account.current_balance}
              limit={account.cardStatus?.credit_limit ?? account.credit_limit ?? null}
              util={account.cardStatus?.utilization_pct ?? null}
              dueDay={account.payment_due_day}
              currency={currency}
            />
          ) : type === "loan" ? (
            <LoanBody
              outstanding={account.loanStatus?.outstanding_balance ?? account.principal ?? 0}
              paid={account.loanStatus?.progress_installments_paid ?? account.loanStatus?.installments_paid ?? 0}
              term={account.loanStatus?.progress_term_months ?? account.term_months}
              installment={account.installment_amount}
              currency={currency}
            />
          ) : (
            <View style={{ marginTop: 20 }}>
              <MoneyDisplay amount={account.balance ?? account.starting_balance} currency={currency} size="stat" />
              {/* An asset's figure is an estimate set by hand, not a balance. */}
              <Text size="xs" tone="muted" style={{ marginTop: 4 }}>
                {type === "asset" ? t("estimatedValue") : t("currentBalance")}
              </Text>
              {account.committed > 0 ? (
                <Text size="xs" tone="muted" figure style={{ marginTop: 4 }}>
                  {t.rich("availableCommitted", {
                    available: () => <MaskedMoney amount={account.available} currency={currency} />,
                    committed: () => <MaskedMoney amount={account.committed} currency={currency} />,
                  })}
                </Text>
              ) : null}
            </View>
          )}
        </Card>
      )}
    </Pressable>
  );
}

function CardBody({ owed, limit, util, dueDay, currency }: { owed: number; limit: number | null; util: number | null; dueDay: number | null; currency: string }) {
  const t = useTranslations("Accounts");
  return (
    <View style={{ marginTop: 20, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <MoneyDisplay amount={owed} currency={currency} size="stat" />
          <Text size="xs" tone="muted" style={{ marginTop: 4 }}>
            {t("owed")}
          </Text>
        </View>
        {util !== null ? <ProofMark tone={util >= 80 ? "flag" : "neutral"}>{formatPercent(util)}</ProofMark> : null}
      </View>
      {util !== null ? <Progress value={Math.min(Math.max(util, 0), 100)} /> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text size="xs" tone="muted" style={{ flexShrink: 1 }}>
          {limit ? t("limitAmount", { amount: formatMoney(limit, currency) }) : t("noLimitSet")}
        </Text>
        {dueDay ? (
          <Text size="xs" tone="muted">
            {t("dueThe", { day: formatDayOfMonth(dueDay) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function LoanBody({ outstanding, paid, term, installment, currency }: { outstanding: number; paid: number; term: number | null; installment: number | null; currency: string }) {
  const t = useTranslations("Accounts");
  return (
    <View style={{ marginTop: 20, gap: 12 }}>
      <View>
        <MoneyDisplay amount={outstanding} currency={currency} size="stat" />
        <Text size="xs" tone="muted" style={{ marginTop: 4 }}>
          {t("outstanding")}
        </Text>
      </View>
      {term ? <Perforation total={term} paid={paid} label={t("paidOfTerm", { paid, term })} decorative /> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <Text size="xs" tone="muted" style={{ flexShrink: 1 }}>
          {term ? t("paidOfTerm", { paid, term }) : t("paidOnly", { paid })}
        </Text>
        {installment ? (
          <Text size="xs" tone="muted">
            {t("perMonth", { amount: formatMoney(installment, currency) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
