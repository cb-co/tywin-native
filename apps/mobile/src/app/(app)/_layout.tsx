import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { QuickAddProvider } from "~/components/quick-add/quick-add";
import { QuickAddSheet } from "~/components/quick-add/quick-add-sheet";
import { useStackOptions } from "~/components/shell/stack-options";

/**
 * The signed-in app: the tabs, and the few screens pushed over them. Detail
 * pages live inside their tab's own stack (accounts/, budgets/), so the bottom
 * band stays under them.
 */
export default function AppLayout() {
  const t = useTranslations("Nav");
  return (
    <QuickAddProvider>
      <Stack screenOptions={useStackOptions()}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ask" options={{ title: t("ask") }} />
        <Stack.Screen name="settings/index" options={{ title: t("settings") }} />
        <Stack.Screen name="settings/rules" options={{ title: "" }} />
      </Stack>
      <QuickAddSheet />
    </QuickAddProvider>
  );
}
