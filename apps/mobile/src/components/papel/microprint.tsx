import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { Text } from "~/components/ui/text";

const INSET = 12;

/**
 * The microprinted border every banknote carries, here in both languages: four
 * strips of tiny repeated legend around a hairline frame. Purely ornamental; the
 * same words are on screen in full size.
 */
export function Microprint({ text, color }: { text: string; color: string }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };
  const run = text.repeat(12);
  const strip = (style: ViewStyle, length: number) => (
    <View style={[styles.strip, { width: length }, style]}>
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        width="expanded"
        weight={600}
        color={color}
        style={styles.micro}
        allowFontScaling={false}
      >
        {run}
      </Text>
    </View>
  );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[styles.frame, { borderColor: color }]}
    >
      {box ? (
        <>
          {strip({ top: -8, left: 0 }, box.w)}
          {strip({ bottom: -8, left: 0 }, box.w)}
          {strip({ left: -8 - box.h / 2 + 3, top: box.h / 2 - 3, transform: [{ rotate: "-90deg" }] }, box.h)}
          {strip({ right: -8 - box.h / 2 + 3, top: box.h / 2 - 3, transform: [{ rotate: "90deg" }] }, box.h)}
        </>
      ) : null}
    </View>
  );
}

/** A serial number in the note's corner. Decorative, like the real thing. */
export function Serial({ value, color, style }: { value: string; color: string; style?: ViewStyle }) {
  return (
    <View style={[{ position: "absolute" }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text size="2xs" weight={700} color={color} tracking={0.2} style={{ fontSize: 11.5 }} allowFontScaling={false}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: INSET,
    left: INSET,
    right: INSET,
    bottom: INSET,
    borderWidth: 1,
    opacity: 0.8,
  },
  strip: { position: "absolute", height: 6, overflow: "hidden" },
  micro: { fontSize: 5.5, lineHeight: 6, letterSpacing: 5.5 * 0.22 },
});
