import { memo, useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { medallionSvg } from "@cigua/core/papel/medallion";
import { useColors } from "~/theme/theme";

/**
 * The Cigua mark: the seal inside an outer guilloche ring, the same drawing as
 * the site's logo, the favicon and the app icon. The ring takes the text colour,
 * so it is ink on paper and light on the dark ground; the seal keeps note violet.
 */
export const Medallion = memo(function Medallion({ size = 32 }: { size?: number }) {
  const c = useColors();
  const xml = useMemo(
    () => medallionSvg({ plate: c.foreground, disc: c.note, ink: c.noteInk }),
    [c.foreground, c.note, c.noteInk],
  );
  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
});
