import type { TextStyle } from "react-native";
import { formatMoney, type MoneyOpts } from "@cigua/core/format";
import { splitMoney } from "@cigua/core/money-parts";
import { Text, type TextProps } from "~/components/ui/text";
import { useFigureMask, maskFigure } from "./figure-mask";
import { useCountUp } from "./count-up";
import type { Weight, Width } from "~/theme/fonts";

const SIZES: Record<
  "hero" | "feature" | "stat" | "inline",
  { size: number; weight: Weight; tracking: number; cents: number }
> = {
  // The hero prints on a Note, so it sits at 600 and lets the scale do the work.
  hero: { size: 48, weight: 600, tracking: -0.03, cents: 0.6 },
  // A figure that leads a section but is not the page's subject.
  feature: { size: 30, weight: 700, tracking: -0.025, cents: 0.61 },
  stat: { size: 24, weight: 700, tracking: -0.02, cents: 0.62 },
  inline: { size: 16, weight: 600, tracking: 0, cents: 0.75 },
};

/**
 * A money figure with de-emphasised cents — the "$8,822.⁸⁹" treatment. Masked
 * figures are never split. `animate` counts it up on arrival: opt in only for the
 * figure a screen is about.
 */
export function MoneyDisplay({
  amount,
  currency,
  size = "stat",
  opts,
  animate = false,
  fontSize,
  weight,
  width,
  centsOpacity = 0.6,
  color,
  tone,
  style,
  numberOfLines = 1,
  adjustsFontSizeToFit,
}: {
  amount: number;
  currency: string;
  size?: keyof typeof SIZES;
  opts?: MoneyOpts;
  animate?: boolean;
  /** Override the size step's font size (the Note sets its own). */
  fontSize?: number;
  weight?: Weight;
  width?: Width;
  centsOpacity?: number;
  color?: string;
  tone?: TextProps["tone"];
  style?: TextStyle;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}) {
  const { masked } = useFigureMask();
  const shown = useCountUp(amount, animate && !masked);
  const s = SIZES[size];
  const px = fontSize ?? s.size;
  const common: TextProps = {
    figure: true,
    weight: weight ?? s.weight,
    width,
    color,
    tone,
    numberOfLines,
    adjustsFontSizeToFit,
    minimumFontScale: 0.5,
    style: [{ fontSize: px, lineHeight: Math.round(px * 1.15), letterSpacing: s.tracking * px }, style],
  };

  if (masked) {
    return <Text {...common}>{maskFigure(formatMoney(amount, currency, opts))}</Text>;
  }

  const { head, sep, cents } = splitMoney(shown, currency, opts);
  return (
    <Text {...common} accessibilityLabel={formatMoney(amount, currency, opts)}>
      {head}
      {cents ? (
        <Text figure weight={600} width={width} color={color} tone={tone} style={{ fontSize: px * s.cents, opacity: centsOpacity }}>
          {sep}
          {cents}
        </Text>
      ) : null}
    </Text>
  );
}

/** A money figure as plain text, masked while figure masking is on. */
export function MaskedMoney({
  amount,
  currency,
  opts,
}: {
  amount: number;
  currency: string;
  opts?: MoneyOpts;
}) {
  const { masked } = useFigureMask();
  const formatted = formatMoney(amount, currency, opts);
  return <>{masked ? maskFigure(formatted) : formatted}</>;
}
