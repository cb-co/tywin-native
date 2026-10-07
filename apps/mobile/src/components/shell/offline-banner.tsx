import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { CloudOff } from "~/components/ui/icons";
import { useFormatter, useTranslations } from "use-intl";
import { queryClient } from "~/lib/query";
import { Text } from "~/components/ui/text";
import { makeStyles, useColors } from "~/theme/theme";

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
const isOnline = () => onlineManager.isOnline();

/** When the newest saved screen was fetched: what "as of" means while offline. */
function lastFetched(): number {
  let latest = 0;
  for (const q of queryClient.getQueryCache().getAll()) if (q.state.dataUpdatedAt > latest) latest = q.state.dataUpdatedAt;
  return latest;
}

/**
 * Offline, the app keeps showing the saved screens; this notice says they are
 * saved copies and from when, so a stale balance is never read as today's. It sits
 * on the paper under the header rule, flagged in peso, like a note in the margin.
 */
export function OfflineBanner() {
  const t = useTranslations("App");
  const f = useFormatter();
  const c = useColors();
  const s = useStyles();
  const online = useSyncExternalStore(subscribe, isOnline);
  if (online) return null;
  const at = lastFetched();
  return (
    <View accessibilityLiveRegion="polite" style={s.notice}>
      <CloudOff size={14} color={c.warning} />
      <Text size="xs" style={{ flex: 1 }}>
        {t("offlineAsOf", { time: at ? f.dateTime(new Date(at), { hour: "numeric", minute: "2-digit" }) : "—" })}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: c.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
}));
