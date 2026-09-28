import { useSyncExternalStore } from "react";
import { View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { CloudOff } from "~/components/ui/icons";
import { useFormatter, useTranslations } from "use-intl";
import { queryClient } from "~/lib/query";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
const isOnline = () => onlineManager.isOnline();

/** When the newest saved screen was fetched: what "as of" means while offline. */
function lastFetched(): number {
  let latest = 0;
  for (const q of queryClient.getQueryCache().getAll()) if (q.state.dataUpdatedAt > latest) latest = q.state.dataUpdatedAt;
  return latest;
}

/**
 * Offline, the app keeps showing the saved screens; this strip says they are
 * saved copies and from when, so a stale balance is never read as today's.
 */
export function OfflineBanner() {
  const t = useTranslations("App");
  const f = useFormatter();
  const c = useColors();
  const online = useSyncExternalStore(subscribe, isOnline);
  if (online) return null;
  const at = lastFetched();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: c.muted, paddingVertical: 6 }}
    >
      <CloudOff size={14} color={c.mutedForeground} />
      <Text size="xs" tone="muted">
        {t("offlineAsOf", { time: at ? f.dateTime(new Date(at), { hour: "numeric", minute: "2-digit" }) : "—" })}
      </Text>
    </View>
  );
}
