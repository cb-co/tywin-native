import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { readableForeground } from "@cigua/core/color";
import { hasBrandColor } from "@cigua/core/subscriptions/brand-color";
import { BrandGlyph } from "~/components/brand/brand-glyph";
import { Text } from "~/components/ui/text";
import { useColors } from "~/theme/theme";

const SIZE = 40;

/**
 * The service's mark: its logo where there is one, its initial where not, on
 * its brand colour either way (the theme's accent when none was resolved). The
 * glyph's ink is measured from the fill, never assumed, and a hairline keeps a
 * pale brand colour from dissolving into the paper.
 */
export const BrandMark = memo(function BrandMark({ name, color, logoPath }: { name: string; color: string | null; logoPath: string | null }) {
  const c = useColors();
  const branded = hasBrandColor(color);
  const bg = branded ? color! : c.accent;
  const fg = branded ? readableForeground(color!) : c.accentForeground;
  return (
    <View
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.rule,
      }}
    >
      {logoPath ? (
        <BrandGlyph path={logoPath} size={Math.round(SIZE * 0.55)} color={fg} />
      ) : (
        <Text size="sm" weight={600} color={fg}>
          {name[0]?.toUpperCase()}
        </Text>
      )}
    </View>
  );
});
