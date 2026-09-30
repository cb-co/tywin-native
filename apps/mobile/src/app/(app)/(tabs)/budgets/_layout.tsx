import { Stack } from "expo-router";
import { TabHeader, useStackOptions } from "~/components/shell/stack-options";

/** Budgets, and the goals that open from it, inside the tab so the band stays. */
export const unstable_settings = { initialRouteName: "index" };

export default function BudgetsStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ header: TabHeader }} />
      <Stack.Screen name="goals/[id]" options={{ title: "" }} />
    </Stack>
  );
}
