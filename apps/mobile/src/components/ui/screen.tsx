import { forwardRef, startTransition, useCallback, useEffect, useState } from "react";
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Text } from "./text";
import { Button } from "./button";
import { useReduceMotion } from "~/components/papel/guilloche";
import { makeStyles, useColors } from "~/theme/theme";
import { scale, type Size } from "~/theme/fonts";

/** How far the quick-add seal's foot sits above the bottom safe-area edge: the band, plus a gap. */
export const FAB_GAP = 76;

/** Room the tab screens leave above the band so their last row clears the seal:
 *  its top (FAB_GAP + 56 − the band's 60) plus a breath of paper. */
export const TAB_CLEARANCE = 120;

/**
 * A screen's scrolling sheet of paper. Pull to refresh re-reads the screen; the
 * bottom clears the band and seal on tab screens, or the home indicator elsewhere.
 */
export const Screen = forwardRef<
  ScrollView,
  ScrollViewProps & {
    onRefresh?: () => Promise<unknown>;
    tab?: boolean;
    contentStyle?: ViewStyle;
    gap?: number;
  }
>(function Screen({ onRefresh, tab, contentStyle, gap = 32, children, ...props }, ref) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[
        {
          padding: 16,
          paddingBottom: tab ? TAB_CLEARANCE : insets.bottom + 48,
          gap,
          width: "100%",
          maxWidth: 960,
          alignSelf: "center",
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.mutedForeground} colors={[c.primary]} />
        ) : undefined
      }
      {...props}
    >
      {children}
    </ScrollView>
  );
});

/**
 * Title and its one action share the first row; the description gets the second
 * to itself, so a single button never costs a whole band of height.
 */
export function PageHeader({
  title,
  description,
  actions,
  style,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  style?: ViewStyle;
}) {
  const s = useStyles();
  return (
    <View style={[s.header, style]}>
      <View style={s.headerRow}>
        <Text size="2xl" weight={600} tracking={-0.025} accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Text>
        {actions ? <View style={s.actions}>{actions}</View> : null}
      </View>
      {description ? (
        <Text size="sm" tone="muted">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

/** One piece of art (or an icon), a title, one line, and at most one action. */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  style,
}: {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  const s = useStyles();
  return (
    <View style={[s.empty, style]}>
      {illustration ? <View style={{ marginBottom: 16 }}>{illustration}</View> : icon ? <View style={s.emptyIcon}>{icon}</View> : null}
      <Text size="lg" weight={500} align="center">
        {title}
      </Text>
      <Text size="sm" tone="muted" align="center" style={{ marginTop: 4, maxWidth: 384 }}>
        {description}
      </Text>
      {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
    </View>
  );
}

/** A screen that could not load and has nothing saved to show instead. */
export function ScreenError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("Errors");
  const tApp = useTranslations("App");
  const s = useStyles();
  return (
    <View style={s.error}>
      <Text size="lg" weight={500} align="center">
        {t("title")}
      </Text>
      <Text size="sm" tone="muted" align="center">
        {tApp("errorBody")}
      </Text>
      <Button variant="outline" onPress={onRetry} style={{ alignSelf: "center" }}>
        {t("retry")}
      </Button>
    </View>
  );
}

/* ------------------------------------------------------------ skeletons -- */

/**
 * False for a screen's first frame, true from the next.
 *
 * A screen mounts in the same commit as the tap that opened it, so a screen that
 * renders its real content straight away (charts, card faces, engraving) holds
 * the tap until all of it is built, and the old page just sits there. Returning
 * the screen's skeleton until this settles paints the new page at once; the
 * content follows a frame later, as a transition, so it never blocks a touch.
 * A tab stays mounted once visited, so this only plays on the first visit.
 */
export function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => startTransition(() => setSettled(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return settled;
}

const SWEEP_MS = 1600;

/* One sweep drives every block on screen, so a skeleton moves as one sheet
 * instead of each block keeping its own time. It runs only while a block is up. */
const sweep = new Animated.Value(0);
let sweepers = 0;
let sweepLoop: Animated.CompositeAnimation | null = null;

function useSweep(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    if (sweepers++ === 0) {
      sweep.setValue(0);
      sweepLoop = Animated.loop(
        // CSS's default `ease`, which the web's sweep runs on.
        Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
      );
      sweepLoop.start();
    }
    return () => {
      if (--sweepers === 0) {
        sweepLoop?.stop();
        sweepLoop = null;
      }
    };
  }, [on]);
}

/**
 * A muted block where content will land, with a faint band of ink sweeping
 * across it in reading order (the web's `.skeleton`). Under Reduce Motion the
 * block stays still.
 */
export function Skeleton({
  height = 16,
  width = "100%",
  ratio,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  /** Width over height, in place of `height`, for blocks that stand in for a card face or a chart. */
  ratio?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  useSweep(!reduce);
  const { w, h } = box;
  return (
    <View
      onLayout={(e) => setBox({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
      style={[
        { width, borderRadius: 3, backgroundColor: c.muted, overflow: "hidden" },
        ratio ? { aspectRatio: ratio } : { height },
        style,
      ]}
    >
      {!reduce && w > 0 && h > 0 ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-w, w] }) }] },
          ]}
        >
          <Svg width={w} height={h}>
            <Defs>
              <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={c.foreground} stopOpacity={0} />
                <Stop offset="0.5" stopColor={c.foreground} stopOpacity={0.06} />
                <Stop offset="1" stopColor={c.foreground} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={w} height={h} fill="url(#sweep)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** One line of text: the line's full height, with a bar the height of its type. */
export function SkeletonText({ size = "sm", width = "100%" }: { size?: Size; width?: number | `${number}%` }) {
  const [font, line] = scale[size];
  return (
    <View style={{ height: line, justifyContent: "center" }}>
      <Skeleton height={Math.round(font * 0.8)} width={width} />
    </View>
  );
}

/**
 * The sheet a skeleton is laid out on: `Screen`'s padding, gap, clearance and
 * width, so every block lands where the real content will. It never scrolls.
 */
export function SkeletonPage({ tab, gap = 32, children }: { tab?: boolean; gap?: number; children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Common");
  return (
    // One element to a screen reader: the page is loading, not a stack of blank blocks.
    <View
      accessible
      accessibilityLabel={t("loading")}
      accessibilityState={{ busy: true }}
      style={{ flex: 1, backgroundColor: c.background, overflow: "hidden" }}
    >
      <View
        style={{
          padding: 16,
          paddingBottom: tab ? TAB_CLEARANCE : insets.bottom + 48,
          gap,
          width: "100%",
          maxWidth: 960,
          alignSelf: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** `PageHeader`'s skeleton: the title, its one action when it has one, the description. */
export function PageHeaderSkeleton({ title = "50%", action }: { title?: `${number}%`; action?: number }) {
  const s = useStyles();
  return (
    <View style={s.header}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <SkeletonText size="2xl" width={title} />
        </View>
        {action ? <Skeleton height={40} width={action} style={{ borderRadius: 4 }} /> : null}
      </View>
      <SkeletonText size="sm" width="80%" />
    </View>
  );
}

/** `SectionLegend`'s skeleton: a short caps line on the legend's baseline. */
export function SectionLegendSkeleton({ width = 112, aside }: { width?: number; aside?: React.ReactNode }) {
  return (
    <View style={{ minHeight: 32, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <Skeleton height={10} width={width} />
      {aside}
    </View>
  );
}

/** A varied but stable bar width for the `i`th line of a list, so the bars read
 *  as lines of text rather than a stack of identical slabs. */
export function lineWidth(i: number, base: number, spread: number): `${number}%` {
  return `${base + ((i * 17) % spread)}%`;
}

/**
 * `LedgerRow`s' skeleton: a round mark, a title over a subtitle, a figure, with
 * the ledger's hairline between rows. `card` prints them on a card; without it
 * they sit on the page, as the transaction ledger does.
 */
export function RowsSkeleton({ rows = 3, mark = 36, card = true, subtitle = true }: { rows?: number; mark?: number | false; card?: boolean; subtitle?: boolean }) {
  const s = useStyles();
  return (
    <View style={card ? s.skeletonCard : null}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[s.skeletonRow, card ? { paddingHorizontal: 16 } : null, i < rows - 1 ? s.skeletonRule : null]}>
          {mark ? <Skeleton height={mark} width={mark} style={{ borderRadius: mark / 2 }} /> : null}
          <View style={{ flex: 1 }}>
            <SkeletonText size="sm" width={lineWidth(i, 45, 35)} />
            {subtitle ? <SkeletonText size="xs" width={lineWidth(i + 2, 30, 25)} /> : null}
          </View>
          <Skeleton height={12} width={64} />
        </View>
      ))}
    </View>
  );
}

/** A generic page, for screens with no skeleton of their own. */
export function ScreenSkeleton({ tab }: { tab?: boolean }) {
  return (
    <SkeletonPage tab={tab} gap={24}>
      <PageHeaderSkeleton />
      <Skeleton height={180} style={{ borderRadius: 6 }} />
      <Skeleton height={64} />
      <Skeleton height={64} />
      <Skeleton height={64} />
    </SkeletonPage>
  );
}

const useStyles = makeStyles((c) => ({
  header: { gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.border,
    backgroundColor: c.card,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
  },
  error: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, backgroundColor: c.background },
  skeletonCard: { backgroundColor: c.card, borderColor: c.paperLine, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, overflow: "hidden" },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  skeletonRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
}));
