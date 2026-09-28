import { Pressable, View } from "react-native";
import { Check } from "~/components/ui/icons";
import { SWATCHES } from "@cigua/core/palette";
import { useColors } from "~/theme/theme";

/**
 * The sixteen swatches as a row of discs. Selection is a white tick inside the
 * disc plus a foreground ring, never a ring alone: the first swatch is close to
 * brand violet and a violet ring around it would vanish.
 */
export function SwatchPicker({
  value,
  onChange,
  labelFor,
}: {
  value: string;
  onChange: (color: string) => void;
  labelFor: (color: string) => string;
}) {
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {SWATCHES.map((sw) => {
        const on = value === sw;
        return (
          <Pressable
            key={sw}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={labelFor(sw)}
            hitSlop={4}
            onPress={() => onChange(sw)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: sw,
              borderWidth: 2,
              borderColor: on ? c.foreground : "transparent",
            }}
          >
            {on ? <Check size={16} strokeWidth={3} color="#ffffff" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
