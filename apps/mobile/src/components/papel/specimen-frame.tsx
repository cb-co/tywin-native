import { View, type ViewStyle } from "react-native";
import { useTranslations } from "use-intl";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/** Frames illustrative UI (help mocks, empty-state previews) so a specimen is never mistaken for real figures. */
export function SpecimenFrame({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTranslations("Papel");
  const c = useColors();
  return (
    <View
      style={[
        { borderRadius: radius.sheet, borderWidth: 1, borderStyle: "dashed", borderColor: c.inkSoft, padding: 12, paddingTop: 24 },
        style,
      ]}
    >
      <Text legend tone="muted" style={{ position: "absolute", left: 12, top: 6, fontSize: 9 }}>
        {t("specimen")}
      </Text>
      {children}
    </View>
  );
}
