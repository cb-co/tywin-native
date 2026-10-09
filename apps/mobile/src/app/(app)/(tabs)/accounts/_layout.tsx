import { Stack } from "expo-router";
import { tabPageOptions, useStackOptions } from "~/components/shell/stack-options";

/** The accounts list, and what opens from it, inside the tab so the band stays. */
export const unstable_settings = { initialRouteName: "index" };

export default function AccountsStack() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={tabPageOptions} />
      <Stack.Screen name="[id]" options={{ title: "" }} />
      <Stack.Screen name="imports/[id]" options={{ title: "" }} />
    </Stack>
  );
}
