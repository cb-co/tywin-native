import { View } from "react-native";
import { useSegments } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabHeader } from "~/components/shell/stack-options";
import { BottomBand } from "~/components/shell/bottom-band";
import { QuickAddFab } from "~/components/shell/quick-add-fab";
import { FAB_GAP } from "~/components/ui/screen";
import { usePrefetchTabs } from "~/lib/prefetch";
import { useColors } from "~/theme/theme";

/**
 * The phone shell: the paper header on top, the six-cell band on the bottom
 * edge, the quick-add seal above it. Every tab keeps its place when you leave it.
 * Accounts and Budgets are stacks of their own, so their detail pages keep the
 * band; the seal stays on the tabs' own pages, where the screens leave room for it.
 */
export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // ["(app)", "(tabs)", "accounts"] on a tab's own page; a fourth segment is a pushed screen.
  const pushed = useSegments().length > 3;
  usePrefetchTabs();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Tabs
        tabBar={(props) => <BottomBand {...props} />}
        screenOptions={{
          header: TabHeader,
          sceneStyle: { backgroundColor: c.background },
          freezeOnBlur: true,
          animation: "none",
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="accounts" options={{ headerShown: false }} />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="recurring" />
        <Tabs.Screen name="budgets" options={{ headerShown: false }} />
        <Tabs.Screen name="insights" />
      </Tabs>
      {pushed ? null : <QuickAddFab bottom={insets.bottom + FAB_GAP} />}
    </View>
  );
}
