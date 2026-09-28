import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { periodProgress } from "@cigua/core/overview/period-progress";
import { Text } from "~/components/ui/text";

/**
 * The quincena engraved along the note's bottom edge: period start, today, payday.
 * One image for assistive tech; the today marker is a tall tick plus a caption,
 * never colour alone.
 */
export function QuincenaEdge({ start, end, today, color }: { start: string; end: string; today: string; color: string }) {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const { day, total, pos } = periodProgress({ start, end }, today);
  const short = (iso: string) => f.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const [width, setWidth] = useState(0);
  const [captionWidth, setCaptionWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Edge-aware caption: near either end it hangs off the marker instead of
  // centring on it, so it never overflows the note or meets the captions.
  const x = pos * width;
  const captionLeft = pos < 0.12 ? x : pos > 0.88 ? x - captionWidth : x - captionWidth / 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("quincenaEdgeLabel", { day, total, date: short(end) })}
      style={{ marginTop: 24, paddingTop: 26 }}
      onLayout={onLayout}
    >
      <View style={{ height: 12, borderBottomWidth: 1, borderBottomColor: color }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              bottom: 0,
              width: 1,
              opacity: 0.6,
              backgroundColor: color,
              left: `${total > 1 ? (i / (total - 1)) * 100 : 0}%`,
              height: i === 0 || i === total - 1 ? 12 : 6,
            }}
          />
        ))}
        <View style={{ position: "absolute", bottom: 0, height: 20, width: 2, backgroundColor: color, left: `${pos * 100}%` }} />
      </View>
      <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
        <Text legend color={color} style={{ fontSize: 11 }}>
          {short(start)}
        </Text>
        <Text legend color={color} style={{ fontSize: 11 }}>
          {short(end)}
        </Text>
      </View>
      <Text
        legend
        color={color}
        onLayout={(e) => setCaptionWidth(e.nativeEvent.layout.width)}
        style={{ position: "absolute", top: 0, left: width ? captionLeft : 0, fontSize: 11, lineHeight: 14, opacity: width ? 1 : 0 }}
      >
        {t("quincenaToday")}
      </Text>
    </View>
  );
}
