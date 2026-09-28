import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

const LAST_UPDATED = "July 20, 2026";
const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

type Section = { title: string; body: React.ReactNode[] };

function useLink() {
  const s = useStyles();
  return (label: React.ReactNode, onPress: () => void) => (
    <Text size="base" tone="muted" style={s.link} accessibilityRole="link" onPress={onPress}>
      {label}
    </Text>
  );
}

function useTerms(): { title: string; sections: Section[] } {
  const t = useTranslations("Terms");
  const link = useLink();
  const n = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
  return {
    title: t("title"),
    sections: n.map((i) => ({
      title: t(`s${i}Title`),
      body: [
        i === 6
          ? t.rich("s6Body", { privacyLink: (chunks) => link(chunks, () => router.replace({ pathname: "/legal/[doc]", params: { doc: "privacy" } })) })
          : i === 9
            ? t.rich("s9Body", { email: CONTACT_EMAIL, link: (chunks) => link(chunks, () => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)) })
            : t(`s${i}Body`),
      ],
    })),
  };
}

function usePrivacy(): { title: string; sections: Section[] } {
  const t = useTranslations("Privacy");
  const link = useLink();
  return {
    title: t("title"),
    sections: [
      { title: t("s1Title"), body: [t("s1Body1"), t("s1Body2")] },
      ...([2, 3, 4, 5, 6, 7] as const).map((i) => ({ title: t(`s${i}Title`), body: [t(`s${i}Body`)] })),
      {
        title: t("s8Title"),
        body: [t.rich("s8Body", { email: CONTACT_EMAIL, link: (chunks) => link(chunks, () => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)) })],
      },
    ],
  };
}

/** Terms and Privacy: public, readable signed out, in the app's own type. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const t = useTranslations("Legal");
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const terms = useTerms();
  const privacy = usePrivacy();
  const page = doc === "privacy" ? privacy : terms;

  return (
    <>
      <Stack.Screen options={{ title: page.title }} />
      <ScrollView contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 48 }]}>
        <Text legend size="lg" accessibilityRole="header" style={s.title}>
          {page.title}
        </Text>
        <Text size="sm" tone="muted" style={{ marginTop: 4 }}>
          {t("updated", { date: LAST_UPDATED })}
        </Text>
        <View style={{ marginTop: 32, gap: 32 }}>
          {page.sections.map((sec) => (
            <View key={sec.title}>
              <Text legend style={{ fontSize: 11, marginBottom: 8 }} accessibilityRole="header">
                {sec.title}
              </Text>
              <View style={{ gap: 12 }}>
                {sec.body.map((p, i) => (
                  <Text key={i} size="base" tone="muted" style={{ lineHeight: 25 }}>
                    {p}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  page: { paddingHorizontal: 24, paddingTop: 16, width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { borderBottomWidth: 2, borderBottomColor: c.rule, paddingBottom: 8 },
  link: { textDecorationLine: "underline" },
}));
