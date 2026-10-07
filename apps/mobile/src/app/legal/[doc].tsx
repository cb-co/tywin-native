import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_NAMESPACE,
  LEGAL_VALUES,
  legalOutline,
  legalUpdatedLabel,
  type LegalDoc,
} from "@cigua/core/legal";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

type Section = { title: string; body: React.ReactNode[] };

function useLink() {
  const s = useStyles();
  return (label: React.ReactNode, onPress: () => void) => (
    <Text size="base" tone="muted" style={s.link} accessibilityRole="link" onPress={onPress}>
      {label}
    </Text>
  );
}

/**
 * One document, from the outline the website renders too
 * (packages/core/src/legal.ts), so the two never drift. Every paragraph gets
 * every value and tag; each uses the ones it needs.
 */
function useLegalDoc(doc: LegalDoc): { title: string; sections: Section[] } {
  const t = useTranslations(LEGAL_NAMESPACE[doc]) as unknown as {
    (key: string): string;
    rich: (key: string, values: Record<string, unknown>) => React.ReactNode;
  };
  const link = useLink();
  const open = (target: LegalDoc) => () => router.replace({ pathname: "/legal/[doc]", params: { doc: target } });
  const values = {
    ...LEGAL_VALUES,
    privacyLink: (chunks: React.ReactNode) => link(chunks, open("privacy")),
    termsLink: (chunks: React.ReactNode) => link(chunks, open("terms")),
    link: (chunks: React.ReactNode) => link(chunks, () => void Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}`)),
  };
  return {
    title: t("title"),
    sections: legalOutline(doc).map((section) => ({
      title: t(`${section.key}.title`),
      body: section.paragraphs.map((p) => t.rich(p, values)),
    })),
  };
}

/** Terms and Privacy: public, readable signed out, in the app's own type. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const t = useTranslations("Legal");
  const locale = useLocale();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const page = useLegalDoc(doc === "privacy" ? "privacy" : "terms");

  return (
    <>
      <Stack.Screen options={{ title: page.title }} />
      <ScrollView contentContainerStyle={[s.page, { paddingBottom: insets.bottom + 48 }]}>
        <Text legend size="lg" accessibilityRole="header" style={s.title}>
          {page.title}
        </Text>
        <Text size="sm" tone="muted" style={{ marginTop: 4 }}>
          {t("updated", { date: legalUpdatedLabel(locale) })}
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
