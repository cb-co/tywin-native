import { View } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MobileHeader } from "~/components/shell/mobile-header";
import { OfflineBanner } from "~/components/shell/offline-banner";
import { BottomBand } from "~/components/shell/bottom-band";
import { QuickAddFab } from "~/components/shell/quick-add-fab";
import { usePrefetchTabs } from "~/lib/prefetch";
import { useColors } from "~/theme/theme";

/**
 * The phone shell: the paper header on top, the five-cell band on the bottom
 * edge, the quick-add seal above it. Every tab keeps its place when you leave it.
 */
export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  usePrefetchTabs();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Tabs
        tabBar={(props) => <BottomBand {...props} />}
        screenOptions={{
          header: () => (
            <>
              <MobileHeader />
              <OfflineBanner />
            </>
          ),
          sceneStyle: { backgroundColor: c.background },
          freezeOnBlur: true,
          animation: "none",
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="accounts" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="recurring" />
        <Tabs.Screen name="budgets" />
        <Tabs.Screen name="insights" />
      </Tabs>
      <QuickAddFab bottom={insets.bottom + 80} />
    </View>
  );
}
