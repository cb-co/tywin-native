import { View } from "react-native";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

/** A printed micro-tag: engraved caps in a hairline frame, never a filled pill. */
export function Mark({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: c.inkSoft,
        paddingHorizontal: 4,
        paddingVertical: 1,
        flexShrink: 0,
      }}
    >
      {icon}
      <Text legend tone="muted" numberOfLines={1} style={{ fontSize: 9, lineHeight: 11 }}>
        {children}
      </Text>
    </View>
  );
}
