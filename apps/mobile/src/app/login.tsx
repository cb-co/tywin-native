import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { AUTH_REDIRECT, signInWithApple, signInWithGoogle } from "~/lib/auth";
import { ENV } from "~/lib/env";
import { auth } from "~/lib/supabase";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { GoogleIcon } from "~/components/brand/google-icon";
import { Guilloche } from "~/components/papel/guilloche";
import { Microprint, Serial } from "~/components/papel/microprint";
import { Seal } from "~/components/papel/seal";
import { Wordmark } from "~/components/papel/wordmark";
import { makeStyles, useColors, useTheme } from "~/theme/theme";

/**
 * Must match the Auth password policy in the Supabase dashboard. Enforced
 * server-side; this only rejects a too-short password before a round trip.
 */
const PASSWORD_MIN_LENGTH = 8;

/**
 * Sign in or sign up. The violet note band is the brand, in both themes; the
 * form sits on paper under it. Google opens the system's auth session; Apple
 * signs in natively on iOS.
 */
export default function LoginScreen() {
  const t = useTranslations("Login");
  const tm = useTranslations("Papel");
  const c = useColors();
  const { scheme } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"form" | "google" | "apple" | null>(null);
  const signingUp = mode === "up";

  async function onSubmit() {
    if (!email.trim() || !password) return;
    if (signingUp && password.length < PASSWORD_MIN_LENGTH) {
      toast.error(t("passwordRules", { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    setPending("form");
    try {
      if (signingUp) {
        const { error } = await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: AUTH_REDIRECT } });
        if (error) toast.error(error.message);
        else toast.success(t("confirmEmail"));
      } else {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) toast.error(error.message);
      }
    } finally {
      setPending(null);
    }
  }

  async function social(kind: "google" | "apple") {
    setPending(kind);
    try {
      const result = kind === "google" ? await signInWithGoogle() : await signInWithApple();
      if (result.error) toast.error(result.error === "auth" ? t("linkError") : result.error);
    } finally {
      setPending(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}>
        {/* The note band: the same violet field the product leads with. It never inverts. */}
        <View style={[s.note, { paddingTop: insets.top + 24 }]}>
          <Guilloche variant="rosette" color={c.noteInk} lineWidth={0.5} opacity={0.3} style={s.rosette} />
          <Microprint text={tm("microprint")} color={c.noteLine} />
          <Serial value="CL 2026 000417 A" color={c.pesoLine} style={{ right: 24, bottom: 20 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityRole="header" accessibilityLabel="Cigua">
            <Seal size={32} />
            <Wordmark height={18} color={c.noteInk} />
          </View>
          <View style={{ gap: 12, marginTop: 28, maxWidth: 480 }}>
            <Text size="2xl" weight={700} width="semi" color={c.noteInk} tracking={-0.02}>
              {t("heroTitle")}
            </Text>
            <Text size="sm" color={c.noteInk} style={{ opacity: 0.9 }}>
              {t("heroBody")}
            </Text>
            <Text size="xs" color={c.noteInk} style={{ opacity: 0.75 }}>
              {t("heroFootnote")}
            </Text>
          </View>
        </View>

        <View style={s.paper}>
          <View style={{ gap: 4 }}>
            <Text size="2xl" weight={600} tracking={-0.025} accessibilityRole="header">
              {signingUp ? t("createTitle") : t("welcomeBack")}
            </Text>
            <Text size="sm" tone="muted">
              {signingUp ? t("createBody") : t("welcomeBody")}
            </Text>
          </View>

          <Button variant="outline" size="lg" block onPress={() => void social("google")} disabled={pending !== null} isLoading={pending === "google"}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <GoogleIcon />
              <Text weight={600} size="sm">
                {t("continueWithGoogle")}
              </Text>
            </View>
          </Button>

          {Platform.OS === "ios" && ENV.appleSignIn ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={signingUp ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={scheme === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={4}
              style={{ height: 44, width: "100%", opacity: pending !== null ? 0.5 : 1 }}
              onPress={() => pending === null && void social("apple")}
            />
          ) : null}

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text size="xs" tone="muted">
              {t("orContinueWith")}
            </Text>
            <View style={s.dividerLine} />
          </View>

          <Field label={t("email")}>
            <Input
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </Field>
          <Field label={t("password")} hint={signingUp ? t("passwordRules", { min: PASSWORD_MIN_LENGTH }) : undefined}>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              // "new-password" is what makes a password manager offer to generate one.
              autoComplete={signingUp ? "new-password" : "current-password"}
              textContentType={signingUp ? "newPassword" : "password"}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
            />
          </Field>
          <Button size="lg" block onPress={() => void onSubmit()} disabled={pending !== null} isLoading={pending === "form"}>
            {pending === "form" ? t("pleaseWait") : signingUp ? t("createAccount") : t("signIn")}
          </Button>
          <Button variant="link" onPress={() => setMode(signingUp ? "in" : "up")} style={{ alignSelf: "center" }}>
            {signingUp ? t("haveAccount") : t("needAccount")}
          </Button>

          <Text size="xs" tone="muted" align="center">
            {t.rich("termsAgreement", {
              terms: (chunks) => (
                <Text size="xs" tone="muted" style={s.link} accessibilityRole="link" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } })}>
                  {chunks}
                </Text>
              ),
              privacy: (chunks) => (
                <Text size="xs" tone="muted" style={s.link} accessibilityRole="link" onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } })}>
                  {chunks}
                </Text>
              ),
            })}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  note: { backgroundColor: c.note, paddingHorizontal: 28, paddingBottom: 40, overflow: "hidden" },
  rosette: { position: "absolute", right: -80, top: -40, width: 320, height: 320 },
  paper: { flex: 1, gap: 16, padding: 24, width: "100%", maxWidth: 480, alignSelf: "center" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  link: { textDecorationLine: "underline" },
}));
