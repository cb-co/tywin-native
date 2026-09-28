import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "~/theme/theme";

const PITCH = 14;
const HOLE = 5;

/**
 * A slip torn from a pad: a row of punched holes along the top edge. Dialogs,
 * sheets and toasts are paper slips, not floating cards.
 */
export function Perforated({
  children,
  holeColor,
}: {
  children: React.ReactNode;
  /** What shows through the holes. Defaults to the page's paper. */
  holeColor?: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const count = Math.max(0, Math.floor(width / PITCH));
  return (
    <View onLayout={onLayout}>
      {children}
      {width > 0 ? (
        <Svg
          pointerEvents="none"
          width={width}
          height={HOLE}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {Array.from({ length: count }, (_, i) => (
            <Circle key={i} cx={PITCH / 2 + i * PITCH} cy={0} r={HOLE / 2} fill={holeColor ?? c.background} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
