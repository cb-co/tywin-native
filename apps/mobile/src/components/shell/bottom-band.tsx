import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { ArrowLeftRight, LayoutDashboard, LineChart, PieChart, Repeat, Wallet, type LucideIcon } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { TAB_LABEL_INSET, TAB_LABEL_SIZE, TABS, type TabKey } from "@cigua/core/nav/tabs";
import { Text } from "~/components/ui/text";
import { useReduceMotion } from "~/components/papel/guilloche";
import { makeStyles, useColors } from "~/theme/theme";
import { duration, radius } from "~/theme/tokens";

const ICONS: Record<TabKey, LucideIcon> = {
  overview: LayoutDashboard,
  wallet: Wallet,
  ledger: ArrowLeftRight,
  recurring: Repeat,
  plan: PieChart,
  insights: LineChart,
};

/**
 * A ruled paper band on the bottom edge: six cells, one per page, each always
 * named and always in the same place. The current page is marked three ways —
 * a paper pill behind its icon, full ink, and a heavier name — never colour alone.
 */
export function BottomBand({ state, navigation }: BottomTabBarProps) {
  const s = useStyles();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Tabs");
  const current = state.routes[state.index]?.name;

  return (
    <View style={[s.band, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => {
        const active = current === tab.route;
        const ink = active ? c.foreground : c.mutedForeground;
        const Icon = ICONS[tab.key];
        const onPress = () => {
          const target = state.routes.find((r) => r.name === tab.route)?.key ?? "";
          const event = navigation.emit({ type: "tabPress", target, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigation.navigate(tab.route);
        };
        return (
          <Pressable
            key={tab.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(tab.key)}
            style={({ pressed }) => [s.cell, pressed ? { transform: [{ scale: 0.96 }] } : null]}
          >
            <View style={s.iconBox}>
              <ActivePill active={active} />
              <Icon size={20} color={ink} strokeWidth={active ? 2.25 : 2} />
            </View>
            {/* Sized to fit its own box: at large accessibility text a long name shrinks
                rather than running into its neighbour (see @cigua/core/nav/tabs). */}
            <Text
              size="2xs"
              weight={active ? 600 : 400}
              color={ink}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.3}
              tracking={-0.01}
              style={s.label}
            >
              {t(tab.key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The paper pill behind the current tab's icon. It grows out from the icon when a
 *  tab is chosen — the band's one moment of motion — and simply appears under
 *  reduced motion. */
function ActivePill({ active }: { active: boolean }) {
  const s = useStyles();
  const reduce = useReduceMotion();
  const shown = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      shown.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(shown, {
      toValue: active ? 1 : 0,
      duration: duration.fast,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [active, reduce, shown]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.pill, { opacity: shown, transform: [{ scaleX: shown.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}
    />
  );
}

const useStyles = makeStyles((c) => ({
  band: {
    flexDirection: "row",
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderTopColor: c.rule,
  },
  cell: { flex: 1, minWidth: 0, alignItems: "center", paddingTop: 8, paddingBottom: 6, gap: 4 },
  iconBox: { height: 28, width: 48, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.sheet, backgroundColor: c.secondaryHover },
  label: { fontSize: TAB_LABEL_SIZE, lineHeight: 14, alignSelf: "stretch", textAlign: "center", paddingHorizontal: TAB_LABEL_INSET },
}));
