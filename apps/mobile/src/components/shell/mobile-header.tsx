import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff, Languages, MessagesSquare, Moon, Settings, Sun } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { LOCALES, LOCALE_LABEL } from "@cigua/core/i18n/locale";
import { Button } from "~/components/ui/button";
import { Menu } from "~/components/ui/menu";
import { Medallion } from "~/components/papel/medallion";
import { Wordmark } from "~/components/papel/wordmark";
import { useFigureMask } from "~/components/money/figure-mask";
import { useAppLocale } from "~/lib/i18n";
import { makeStyles, useTheme } from "~/theme/theme";

/**
 * The phone's one persistent chrome: the mark, then figure mask, theme, language,
 * Ask and Settings. Every destination has a home — five cells in the bottom band
 * (two behind Activity), Ask and Settings here — so nothing hides in an overflow.
 */
export function MobileHeader() {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Nav");
  const tTheme = useTranslations("Theme");
  const { colors, scheme, toggle } = useTheme();
  const { masked, toggle: toggleMask } = useFigureMask();
  const { setLocale } = useAppLocale();

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
          <Button
            variant="ghost"
            size="icon"
            icon={scheme === "dark" ? Moon : Sun}
            onPress={toggle}
            accessibilityLabel={tTheme("toggle")}
          />
          <Menu
            items={LOCALES.map((code) => ({ label: LOCALE_LABEL[code], onPress: () => setLocale(code) }))}
            trigger={(open) => (
              <Button variant="ghost" size="icon" icon={Languages} onPress={open} accessibilityLabel={t("language")} />
            )}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={MessagesSquare}
            onPress={() => router.push("/ask")}
            accessibilityLabel={t("ask")}
          />
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
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
}));
