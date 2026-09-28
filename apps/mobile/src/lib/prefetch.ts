import { useEffect } from "react";
import { InteractionManager } from "react-native";
import type { ScreenName } from "@cigua/worker/api";
import { loadScreen } from "./api";
import { keys, queryClient } from "./query";

const TABS: ScreenName[] = ["quickAdd", "accounts", "budgets", "recurring", "insights"];

/**
 * Warms every tab once the shell has settled, so the first tap on any of them
 * paints from memory. Each is one small request, and a tab already fresh in the
 * cache is skipped.
 */
export function usePrefetchTabs(): void {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      for (const name of TABS) {
        void queryClient.prefetchQuery({
          queryKey: keys.screen(name),
          queryFn: ({ signal }) => loadScreen(name, undefined, signal),
        });
      }
    });
    return () => task.cancel();
  }, []);
}
