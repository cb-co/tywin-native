import { StyleSheet, View } from "react-native";
import type { NativeStackNavigationOptions } from "expo-router";
import { MobileHeader } from "./mobile-header";
import { OfflineBanner } from "./offline-banner";
import { useColors } from "~/theme/theme";
import { face } from "~/theme/fonts";

/** The paper header every tab's own page carries. */
export function TabHeader() {
  return (
    <>
      <MobileHeader />
      <OfflineBanner />
    </>
  );
}

/** A pushed screen's header: plain paper, the title in ink, a bare back arrow, and
 *  a hairline under it so every screen's top edge is ruled, not just the tabs'. */
export function useStackOptions(): NativeStackNavigationOptions {
  const c = useColors();
  return {
    headerShown: true,
    contentStyle: { backgroundColor: c.background },
    headerStyle: { backgroundColor: c.background },
    headerTintColor: c.foreground,
    headerTitleStyle: { fontFamily: face(600), color: c.foreground },
    headerBackButtonDisplayMode: "minimal",
    headerShadowVisible: false,
    headerBackground: () => (
      <View
        style={{ flex: 1, backgroundColor: c.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }}
      />
    ),
  };
}
