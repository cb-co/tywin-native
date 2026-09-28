import { Children, cloneElement, isValidElement, type ReactElement } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Text } from "~/components/ui/text";
import { makeStyles, useColors } from "~/theme/theme";

/**
 * One printed ledger line: lead (a Stamp or date), title/subtitle, and a
 * right-aligned tabular amount. The rule under it is the separator; a list of
 * these needs no card around each row. Pressable when it goes somewhere.
 */
export function LedgerRow({
  lead,
  title,
  subtitle,
  amount,
  meta,
  wrapSubtitle,
  trailing,
  rule = true,
  onPress,
  accessibilityLabel,
  style,
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount?: React.ReactNode;
  meta?: React.ReactNode;
  wrapSubtitle?: boolean;
  trailing?: React.ReactNode;
  /** The hairline under the row. Lists turn it off for their last row. */
  rule?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const s = useStyles();
  const body = (
    <>
      {lead}
      <View style={s.text}>
        {typeof title === "string" ? (
          <Text size="sm" weight={500} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text size="xs" tone="muted" numberOfLines={wrapSubtitle ? undefined : 1}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {amount || meta ? (
        <View style={s.figure}>
          {amount}
          {meta ? (
            typeof meta === "string" ? (
              <Text size="xs" tone="muted" figure align="right">
                {meta}
              </Text>
            ) : (
              meta
            )
          ) : null}
        </View>
      ) : null}
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </>
  );
  const rowStyle = [s.row, rule ? s.rule : null, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...rowStyle, pressed ? s.pressed : null]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{body}</View>;
}

/**
 * Rows with one hairline between each and none after the last: the list sets
 * each LedgerRow's or LedgerBlock's `rule`.
 */
export function LedgerList({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ rule?: boolean }>[];
  return (
    <View style={style}>
      {items.map((child, i) => cloneElement(child, { rule: i < items.length - 1 }))}
    </View>
  );
}

/**
 * A ledger line with a body under it: `head` is a LedgerRow (drawn without its
 * own rule), `children` are the controls or meter that belong to it.
 */
export function LedgerBlock({
  head,
  children,
  rule = true,
}: {
  head: React.ReactNode;
  children?: React.ReactNode;
  rule?: boolean;
}) {
  const s = useStyles();
  return (
    <View style={rule ? s.rule : null}>
      {head}
      {children ? <View style={s.blockBody}>{children}</View> : null}
    </View>
  );
}

/** Two thin ink rules with paper between them: separates two ledgers. */
export function DoubleRule({ style }: { style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height: 5, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.rule }, style]}
    />
  );
}

/** A section's heading: engraved caps over a heavy rule, with an optional aside at the far end. */
export function SectionLegend({
  children,
  aside,
  style,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  style?: ViewStyle;
}) {
  const s = useStyles();
  return (
    <View style={[s.legend, style]}>
      <Text legend accessibilityRole="header" style={{ fontSize: 11, flexShrink: 1 }}>
        {children}
      </Text>
      {aside ? <View style={s.legendAside}>{aside}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 0,
  },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  pressed: { backgroundColor: c.muted },
  text: { flex: 1, minWidth: 0 },
  figure: { flexShrink: 0, alignItems: "flex-end" },
  trailing: { flexShrink: 0, flexDirection: "row", alignItems: "center" },
  blockBody: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  legend: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    borderBottomWidth: 2,
    borderBottomColor: c.rule,
    paddingBottom: 6,
  },
  legendAside: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
}));
