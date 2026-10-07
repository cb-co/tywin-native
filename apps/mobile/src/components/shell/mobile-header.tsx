import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff, MessagesSquare, Settings } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { Button } from "~/components/ui/button";
import { Medallion } from "~/components/papel/medallion";
import { Wordmark } from "~/components/papel/wordmark";
import { useFigureMask } from "~/components/money/figure-mask";
import { makeStyles, useColors } from "~/theme/theme";

/**
 * The phone's one persistent chrome: the mark, then figure mask, Ask and Settings.
 * Theme and language are preferences, set once, so they live in Settings alone;
 * what stays here is what gets reached for mid-task — hiding figures before
 * someone looks over your shoulder, and asking a question.
 */
export function MobileHeader() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Nav");
  const colors = useColors();
  const { masked, toggle: toggleMask } = useFigureMask();

  return (
    <View style={[s.header, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        <Pressable
          onPress={() => router.navigate("/")}
          accessibilityRole="link"
          accessibilityLabel={t("overview")}
          style={s.brand}
        >
          <Medallion size={34} />
          <Wordmark height={18} color={colors.foreground} />
        </Pressable>
        <View style={s.actions}>
          <Button
            variant="ghost"
            size="icon"
            icon={masked ? EyeOff : Eye}
            onPress={toggleMask}
            accessibilityLabel={masked ? t("showFigures") : t("hideFigures")}
          />
          {/* Named, not just drawn: a speech bubble alone reads as support chat. */}
          <Button
            variant="outline"
            size="sm"
            icon={MessagesSquare}
            onPress={() => router.push("/ask")}
            accessibilityLabel={t("ask")}
            style={s.ask}
          >
            {t("askShort")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            icon={Settings}
            onPress={() => router.push("/settings")}
            accessibilityLabel={t("settings")}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.rule },
  bar: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, paddingRight: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  ask: { borderColor: c.border, paddingHorizontal: 12 },
}));
