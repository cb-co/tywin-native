import { useState } from "react";
import { Pressable, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { periodSerial } from "@cigua/core/overview/period-serial";
import { formatMoney } from "@cigua/core/format";
import { Note } from "~/components/papel/note";
import { ProofMark } from "~/components/papel/proof-mark";
import { fitFigureSize } from "~/components/papel/fit";
import { MoneyDisplay } from "~/components/money/money-display";
import { Text } from "~/components/ui/text";
import { QuincenaEdge } from "./quincena-edge";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

type Overview = ScreenData<"overview">;

function Row({ label, amount, currency, negate = true, ink }: { label: string; amount: number; currency: string; negate?: boolean; ink: string }) {
  // A zero line (no committed goals, no card debt, no loans) is noise under the figure that matters.
  if (amount === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
      <Text size="sm" color={ink} style={{ opacity: 0.9, flexShrink: 1 }}>
        {label}
      </Text>
      <MoneyDisplay amount={negate ? -amount : amount} currency={currency} size="inline" color={ink} centsOpacity={0.9} />
    </View>
  );
}

/**
 * "Disponible hasta el <payday>": not what you're worth, but what's left before
 * the next payday. Net worth survives as a secondary line inside the same note.
 * On a phone the breakdown starts folded; net worth is outside the fold and
 * always visible.
 */
export function AvailableHero({
  available: a,
  netWorth,
  currency,
  period,
  today,
}: {
  available: Overview["available"];
  netWorth: number;
  currency: string;
  period: Overview["period"];
  today: string;
}) {
  const t = useTranslations("Overview");
  const tm = useTranslations("Papel");
  const f = useFormatter();
  const c = useColors();
  const ink = c.pesoInk;
  const [open, setOpen] = useState(false);

  const date = f.dateTime(new Date(`${a.periodEnd}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const negative = a.available < 0;
  const size = fitFigureSize(formatMoney(a.available, currency));
  const figure = (
    <MoneyDisplay
      amount={a.available}
      currency={currency}
      size="hero"
      animate
      fontSize={size}
      width="expanded"
      weight={800}
      color={negative ? c.red : ink}
      centsOpacity={0.9}
      adjustsFontSizeToFit
    />
  );

  return (
    <Note tone="peso" label={t("availableLabel", { date })} serial={periodSerial(period.start)} microprint={tm("microprint")}>
      {negative ? (
        <View style={{ alignSelf: "flex-start", maxWidth: "100%", borderRadius: radius.control, backgroundColor: c.paper2, paddingHorizontal: 12, paddingVertical: 8 }}>
          {figure}
          <View style={{ marginTop: 4 }}>
            <ProofMark tone="flag">{t("availableOver")}</ProofMark>
          </View>
        </View>
      ) : (
        figure
      )}

      {/* Only when the two card bases differ; printing the same figure twice reads as a bug. */}
      {Math.abs(a.cardsFull - a.cardsMinimum) >= 0.01 ? (
        <Text size="sm" color={ink} style={{ marginTop: 4, opacity: 0.9 }}>
          {t.rich("availableIfCleared", {
            amount: () => <MoneyDisplay amount={a.availableIfCardsCleared} currency={currency} size="inline" color={ink} centsOpacity={0.9} />,
          })}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={{ marginTop: 16, alignSelf: "flex-start" }}
      >
        <Text size="sm" color={ink} style={{ textDecorationLine: "underline" }}>
          {t("availableBreakdownToggle")}
        </Text>
      </Pressable>

      {open ? (
        <View style={{ marginTop: 24, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
            <Text size="sm" color={ink} style={{ opacity: 0.9, flexShrink: 1 }}>
              {t("availableLiquid")}
            </Text>
            <MoneyDisplay amount={a.liquid} currency={currency} size="inline" color={ink} centsOpacity={0.9} />
          </View>
          <Row label={t("availableCommitted")} amount={a.committed} currency={currency} ink={ink} />
          {/* Gated on the basis list, not the amount: a card with a legitimate $0
              minimum on a nonzero balance still owes, and its footnotes need a header. */}
          {a.cardBasis.length > 0 ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                <Text size="sm" color={ink} style={{ opacity: 0.9, flexShrink: 1 }}>
                  {t("availableCards")}
                </Text>
                <MoneyDisplay amount={-a.cardsMinimum} currency={currency} size="inline" color={ink} centsOpacity={0.9} />
              </View>
              {a.cardBasis.map((cb) => (
                <Text key={cb.accountId} size="xs" color={ink} style={{ paddingLeft: 12, opacity: 0.9 }}>
                  {t(cb.basis === "minimum" ? "availableBasisMinimum" : "availableBasisFull", { name: cb.name })}
                </Text>
              ))}
            </>
          ) : null}
          <Row label={t("availableLoans")} amount={a.loans} currency={currency} ink={ink} />
          <Row label={t("availableSubscriptions")} amount={a.subscriptions} currency={currency} ink={ink} />
        </View>
      ) : null}

      <View
        style={{
          marginTop: 24,
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          borderTopWidth: 1,
          // The peso ink at 20%: the note never inverts, so neither does its rule.
          borderTopColor: `${ink}33`,
          paddingTop: 16,
        }}
      >
        <Text size="sm" color={ink} style={{ opacity: 0.9, flexShrink: 1 }}>
          {t("netWorthSecondary")}
        </Text>
        <MoneyDisplay amount={netWorth} currency={currency} size="stat" color={ink} centsOpacity={0.9} />
      </View>

      <QuincenaEdge start={period.start} end={period.end} today={today} color={ink} />
    </Note>
  );
}
