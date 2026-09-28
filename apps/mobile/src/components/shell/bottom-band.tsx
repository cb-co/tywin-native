import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { ArrowLeftRight, ChevronRight, LayoutDashboard, LineChart, PieChart, Repeat, Wallet, type LucideIcon } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { BottomSheet } from "~/components/ui/overlay";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { makeStyles, useColors } from "~/theme/theme";

type Cell = { route: string; key: "accounts" | "activity" | "overview" | "budgets" | "insights"; icon: LucideIcon; match?: string[]; sheet?: boolean };

/**
 * Five cells, Overview in the middle. Reads outward from home: what you have ->
 * what moved -> HOME <- what you planned <- what it means. Transactions and
 * Recurring share the Activity cell, which opens a chooser listing both.
 */
const CELLS: Cell[] = [
  { route: "accounts", key: "accounts", icon: Wallet },
  { route: "transactions", key: "activity", icon: ArrowLeftRight, match: ["recurring"], sheet: true },
  { route: "index", key: "overview", icon: LayoutDashboard },
  { route: "budgets", key: "budgets", icon: PieChart },
  { route: "insights", key: "insights", icon: LineChart },
];

const ACTIVITY: { route: "/transactions" | "/recurring"; name: string; key: "transactions" | "recurring"; icon: LucideIcon }[] = [
  { route: "/transactions", name: "transactions", key: "transactions", icon: ArrowLeftRight },
  { route: "/recurring", name: "recurring", key: "recurring", icon: Repeat },
];

/** A ruled paper band on the bottom edge. Active is ink density and a top rule, never colour alone. */
export function BottomBand({ state, navigation }: BottomTabBarProps) {
  const s = useStyles();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Nav");
  const tActivity = useTranslations("Activity");
  const [activityOpen, setActivityOpen] = useState(false);
  const current = state.routes[state.index]?.name;

  return (
    <View style={[s.band, { paddingBottom: insets.bottom }]}>
      {CELLS.map((cell) => {
        const active = current === cell.route || (cell.match ?? []).includes(current ?? "");
        const ink = active ? c.foreground : c.mutedForeground;
        const onPress = () => {
          if (cell.sheet) {
            setActivityOpen(true);
            return;
          }
          const event = navigation.emit({ type: "tabPress", target: state.routes.find((r) => r.name === cell.route)?.key ?? "", canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(cell.route);
        };
        return (
          <Pressable
            key={cell.key}
            onPress={onPress}
            accessibilityRole={cell.sheet ? "button" : "tab"}
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(cell.key)}
            style={({ pressed }) => [s.cell, pressed ? { transform: [{ scale: 0.96 }] } : null]}
          >
            <View style={s.iconBox}>
              {active ? <View style={[s.activeRule, { backgroundColor: c.foreground }]} /> : null}
              <cell.icon size={20} color={ink} strokeWidth={active ? 2.25 : 2} />
            </View>
            <Text
              size="2xs"
              weight={active ? 600 : 400}
              color={ink}
              numberOfLines={1}
              tracking={-0.01}
              style={{ fontSize: 10, lineHeight: 14 }}
            >
              {t(cell.key)}
            </Text>
          </Pressable>
        );
      })}

      <BottomSheet open={activityOpen} onClose={() => setActivityOpen(false)} title={tActivity("title")}>
        {ACTIVITY.map((item, i) => {
          const isCurrent = current === item.name;
          return (
            <View key={item.route} style={[s.activityItem, isCurrent ? { borderLeftColor: c.foreground } : null]}>
              <LedgerRow
                rule={i < ACTIVITY.length - 1}
                lead={<item.icon size={20} color={c.foreground} />}
                title={t(item.key)}
                subtitle={tActivity(`${item.key}Desc`)}
                wrapSubtitle
                amount={<ChevronRight size={16} color={c.mutedForeground} />}
                accessibilityLabel={t(item.key)}
                onPress={() => {
                  setActivityOpen(false);
                  router.navigate(item.route);
                }}
                style={{ paddingLeft: 12 }}
              />
            </View>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  band: {
    flexDirection: "row",
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderTopColor: c.rule,
  },
  cell: { flex: 1, minWidth: 0, alignItems: "center", paddingTop: 8, paddingBottom: 6, paddingHorizontal: 2, gap: 4 },
  iconBox: { height: 28, width: 48, alignItems: "center", justifyContent: "center" },
  activeRule: { position: "absolute", top: -8, left: 12, right: 12, height: 3 },
  activityItem: { borderLeftWidth: 3, borderLeftColor: "transparent", marginHorizontal: -4 },
}));
