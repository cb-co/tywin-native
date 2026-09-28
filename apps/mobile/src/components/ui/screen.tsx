import { forwardRef, useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Text } from "./text";
import { Button } from "./button";
import { makeStyles, useColors } from "~/theme/theme";

/** Room the tab screens leave for the bottom band and the quick-add seal above it. */
export const TAB_CLEARANCE = 152;

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

/** Paper-coloured blocks where a screen's content will land. */
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ height, width, borderRadius: 3, backgroundColor: c.muted }, style]} />;
}

export function ScreenSkeleton({ tab }: { tab?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16, gap: 24, paddingBottom: tab ? TAB_CLEARANCE : 48 }}>
      <View style={{ gap: 8, paddingBottom: 20 }}>
        <Skeleton height={28} width="55%" />
        <Skeleton height={14} width="80%" />
      </View>
      <Skeleton height={180} style={{ borderRadius: 6 }} />
      <Skeleton height={64} />
      <Skeleton height={64} />
      <Skeleton height={64} />
    </View>
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
}));
