import { View, type ViewStyle } from "react-native";
import { useTranslations } from "use-intl";
import type { GoalCardRow, Pace } from "@cigua/worker/api";
import { formatMoney } from "@cigua/core/format";
import { ProofMark } from "~/components/papel/proof-mark";
import { Text } from "~/components/ui/text";

/**
 * Share of the target saved, 0-100, clamped at both ends (withdrawals can drive
 * `saved` negative; an overshoot still fills the strip once). The strip and the
 * percentage beside it read this one number.
 */
export function goalProgressPct(goal: Pick<GoalCardRow, "saved" | "target_amount">) {
  const target = goal.target_amount;
  return target > 0 ? Math.min(Math.max(goal.saved / target, 0), 1) * 100 : 0;
}

const PACE_TONE = { success: "ok", warning: "flag", destructive: "flag" } as const;

type PaceParts = {
  detail: string | null;
  status: { label: string; tone: keyof typeof PACE_TONE } | null;
};

function usePaceParts(pace: Pace, currency: string): PaceParts {
  const t = useTranslations("Goals");
  const needVsActual = (required: number, actual: number) =>
    t("paceNeedVsActual", { required: formatMoney(required, currency), actual: formatMoney(actual, currency) });

  switch (pace.kind) {
    case "shortfall":
      return { detail: t("paceShortfall", { amount: formatMoney(pace.amount, currency) }), status: null };
    case "complete":
      return { detail: null, status: { label: t("paceComplete"), tone: "success" } };
    case "overdue":
      return { detail: null, status: { label: t("paceOverdue"), tone: "destructive" } };
    case "no-pace":
      return { detail: t("paceNone"), status: null };
    case "on-track":
      return { detail: needVsActual(pace.required, pace.actual), status: { label: t("paceOnTrack"), tone: "success" } };
    case "behind":
      return { detail: needVsActual(pace.required, pace.actual), status: { label: t("paceBehind"), tone: "warning" } };
    case "projection":
      return { detail: t("paceProjection", { actual: formatMoney(pace.actual, currency), months: pace.months }), status: null };
  }
}

/**
 * The pace as two objects: the arithmetic as muted text, the verdict as a proof
 * mark pinned right. Whichever half would repeat the other is left out.
 */
export function PaceSummary({ pace, currency, size = "xs", style }: { pace: Pace; currency: string; size?: "xs" | "sm"; style?: ViewStyle }) {
  const { detail, status } = usePaceParts(pace, currency);
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, minHeight: 24 }, style]}>
      {detail ? (
        <Text size={size} figure tone={pace.kind === "shortfall" ? "destructive" : "muted"} style={{ flexShrink: 1 }}>
          {detail}
        </Text>
      ) : null}
      {status ? (
        <View style={{ marginLeft: "auto", flexShrink: 0 }}>
          <ProofMark tone={PACE_TONE[status.tone]}>{status.label}</ProofMark>
        </View>
      ) : null}
    </View>
  );
}
