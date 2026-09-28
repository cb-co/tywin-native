import { View } from "react-native";
import { ChevronLeft, ChevronRight } from "~/components/ui/icons";
import { useLocale, useTranslations } from "use-intl";
import { formatDate } from "@cigua/core/format";
import { monthEnd, monthLabel, normalizeMonth } from "@cigua/core/budgets/month";
import { isWholeMonth, periodFor, shiftPeriod, type PayCycle, type Period } from "@cigua/core/period/cycle";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Segmented } from "~/components/ui/segmented";

export type PeriodMode = "month" | "native";

/**
 * The toggle shows only when the profile's own cycle, computed fresh rather than
 * read off the side on screen, is not a whole month. Otherwise a quincenal person
 * who flipped to "Month" would watch the toggle vanish with no way back.
 */
export function showsPeriodToggle(period: Period, payCycle: PayCycle, payAnchor: number | null): boolean {
  return !isWholeMonth(periodFor(period.start, payCycle, payAnchor));
}

/** Label for a period the way both budget bands name it: the month, or a date range. */
export function usePeriodLabel() {
  const t = useTranslations("Budgets");
  const locale = useLocale();
  return (period: Period, mode: PeriodMode) =>
    mode === "month"
      ? monthLabel(normalizeMonth(period.start), locale)
      : t("periodRange", {
          start: formatDate(period.start, locale, { day: "numeric", month: "short" }),
          end: formatDate(period.end, locale, { day: "numeric", month: "short" }),
        });
}

/** Month or pay-period stepper, with the month / own-cycle toggle when they differ. */
export function PeriodPicker({
  period,
  mode,
  payCycle,
  payAnchor,
  pending,
  onNavigate,
}: {
  period: Period;
  mode: PeriodMode;
  payCycle: PayCycle;
  payAnchor: number | null;
  pending: boolean;
  onNavigate: (period: Period, mode: PeriodMode) => void;
}) {
  const t = useTranslations("Budgets");
  const labelFor = usePeriodLabel();

  function shift(delta: number) {
    // "Month" always steps by the calendar month, whatever the profile's own cycle.
    const next = mode === "month" ? shiftPeriod(period, "monthly", 1, delta) : shiftPeriod(period, payCycle, payAnchor, delta);
    onNavigate(next, mode);
  }

  function toggle(next: PeriodMode) {
    if (next === mode) return;
    // Re-anchored on the period on screen, not on today.
    const target: Period =
      next === "month"
        ? { start: normalizeMonth(period.start), end: monthEnd(normalizeMonth(period.start)) }
        : periodFor(period.start, payCycle, payAnchor);
    onNavigate(target, next);
  }

  const cycleLabel =
    payCycle === "weekly" ? t("periodWeekly") : payCycle === "monthly" ? t("periodOwnCycle") : t("periodSemimonthly");

  const arrows = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Button
        variant="outline"
        size="icon-sm"
        icon={ChevronLeft}
        accessibilityLabel={mode === "month" ? t("prevMonth") : t("prevPeriod")}
        onPress={() => shift(-1)}
        disabled={pending}
      />
      <Text size="sm" weight={500} align="center" style={{ minWidth: 144 }} accessibilityLiveRegion="polite">
        {labelFor(period, mode)}
      </Text>
      <Button
        variant="outline"
        size="icon-sm"
        icon={ChevronRight}
        accessibilityLabel={mode === "month" ? t("nextMonth") : t("nextPeriod")}
        onPress={() => shift(1)}
        disabled={pending}
      />
    </View>
  );

  if (!showsPeriodToggle(period, payCycle, payAnchor)) return arrows;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      {arrows}
      <Segmented
        value={mode}
        onChange={toggle}
        disabled={pending}
        items={[
          { value: "month", label: t("periodMonth") },
          { value: "native", label: cycleLabel },
        ]}
      />
    </View>
  );
}
