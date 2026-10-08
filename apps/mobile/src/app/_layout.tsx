import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "~/theme/theme";
import { LocaleProvider } from "~/lib/i18n";
import { QueryProvider, useScreen } from "~/lib/query";
import { SessionProvider, useSession } from "~/lib/session";
import { FigureMaskProvider } from "~/components/money/figure-mask";
import { FeedbackProvider } from "~/lib/feedback";
import { Toaster } from "~/components/ui/toast";
import { ScreenError } from "~/components/ui/screen";
import { face } from "~/theme/fonts";
import { cancelReminders } from "~/lib/reminders/native";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <QueryProvider>
            <SessionProvider>
              <FigureMaskProvider>
                <FeedbackProvider>
                  <RootNavigator />
                  <Toaster />
                </FeedbackProvider>
              </FigureMaskProvider>
            </SessionProvider>
          </QueryProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Who sees what. Signed out: sign-in (and the public help and legal pages).
 * Signed in but not set up: onboarding, which drives activation. Set up: the app.
 * The native splash stays up until that is known, so nothing flashes.
 */
function RootNavigator() {
  const { colors, scheme } = useTheme();
  const session = useSession();
  const signedIn = session.status === "signedIn";
  const profile = useScreen("session", undefined, { enabled: signedIn });
  const onboarded = profile.data?.onboarded ?? false;
  const deciding = session.status === "loading" || (signedIn && !profile.data && profile.isPending && !profile.isError);

  useEffect(() => {
    if (!deciding) void SplashScreen.hideAsync().catch(() => {});
  }, [deciding]);

  // Reminders carry the last person's figures: they go with them on sign-out.
  useEffect(() => {
    if (session.status === "signedOut") void cancelReminders();
  }, [session.status]);

  if (deciding) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (signedIn && !profile.data && profile.isError) return <ScreenError onRetry={() => void profile.refetch()} />;

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: face(600), color: colors.foreground },
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="help" options={{ headerShown: true, title: "" }} />
        <Stack.Screen name="legal/[doc]" options={{ headerShown: true, title: "" }} />
      </Stack>
    </>
  );
}
