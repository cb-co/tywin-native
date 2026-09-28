import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { useScreen } from "~/lib/query";
import { ScreenError, ScreenSkeleton } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { Guilloche } from "~/components/papel/guilloche";
import { Microprint } from "~/components/papel/microprint";
import { Seal } from "~/components/papel/seal";
import { Wordmark } from "~/components/papel/wordmark";
import { WelcomeFlow } from "~/components/onboarding/welcome-flow";
import { useColors } from "~/theme/theme";

/** Continues sign-in's violet band, so signing in and setting up read as one sheet. */
export default function WelcomeScreen() {
  const t = useTranslations("Login");
  const tm = useTranslations("Papel");
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { data, isError, refetch } = useScreen("welcome");

  if (!data) return isError ? <ScreenError onRetry={() => void refetch()} /> : <ScreenSkeleton />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={{ backgroundColor: c.note, paddingTop: insets.top + 20, paddingHorizontal: 28, paddingBottom: 28, overflow: "hidden" }}>
          <Guilloche variant="rosette" color={c.noteInk} lineWidth={0.5} opacity={0.3} style={{ position: "absolute", right: -80, top: -60, width: 280, height: 280 }} />
          <Microprint text={tm("microprint")} color={c.noteLine} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel="Cigua">
            <Seal size={28} />
            <Wordmark height={16} color={c.noteInk} />
          </View>
          <Text size="lg" weight={700} width="semi" color={c.noteInk} style={{ marginTop: 16, maxWidth: 480 }}>
            {t("heroTitle")}
          </Text>
        </View>
        <View style={{ padding: 20 }}>
          <WelcomeFlow welcome={data} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
