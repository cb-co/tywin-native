import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { cardLineLabel } from "@cigua/core/accounts/card-lines";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

type Line = ScreenData<"account">["cardLines"][number];

/**
 * The lines of this card (DOP, USD, Cuotas), as a segmented control under its face. No
 * figures: it only answers "which line am I on, and what else is there". Nothing
 * renders below two lines. Switching replaces this screen rather than stacking
 * another, so back still leaves the card.
 */
export function CardLineRail({ lines }: { lines: Line[] }) {
  const t = useTranslations("AccountDetail");
  const tf = useTranslations("AccountForm");
  const s = useStyles();
  if (lines.length < 2) return null;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={t("cardLinesLabel")} style={s.track}>
      {lines.map((line, i) => (
        <Pressable
          key={line.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: line.isCurrent }}
          disabled={line.isCurrent}
          onPress={() => router.replace({ pathname: "/accounts/[id]", params: { id: line.id } })}
          style={({ pressed }) => [s.segment, i > 0 && s.divider, line.isCurrent ? s.current : pressed ? s.pressed : null]}
        >
          <Text size="xs" weight={line.isCurrent ? 500 : 400} tone={line.isCurrent ? "default" : "muted"} numberOfLines={1} align="center">
            {cardLineLabel(line.line, tf("lineInstallments"))}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: {
    marginTop: 12,
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  segment: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border },
  current: { backgroundColor: c.muted },
  pressed: { backgroundColor: c.accent },
}));
