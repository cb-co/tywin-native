import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { QuickAddProvider } from "~/components/quick-add/quick-add";
import { QuickAddSheet } from "~/components/quick-add/quick-add-sheet";
import { Splash } from "~/components/shell/splash";
import { useColors } from "~/theme/theme";
import { face } from "~/theme/fonts";

/** The signed-in app: the tabs, and the screens pushed over them. */
export default function AppLayout() {
  const c = useColors();
  const t = useTranslations("Nav");
  return (
    <QuickAddProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          contentStyle: { backgroundColor: c.background },
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.foreground,
          headerTitleStyle: { fontFamily: face(600), color: c.foreground },
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="accounts/[id]" options={{ title: "" }} />
        <Stack.Screen name="imports/[id]" options={{ title: "" }} />
        <Stack.Screen name="goals/[id]" options={{ title: "" }} />
        <Stack.Screen name="ask" options={{ title: t("ask") }} />
        <Stack.Screen name="settings/index" options={{ title: t("settings") }} />
        <Stack.Screen name="settings/rules" options={{ title: "" }} />
      </Stack>
      <QuickAddSheet />
      <Splash />
    </QuickAddProvider>
  );
}
