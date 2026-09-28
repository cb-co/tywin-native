import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { Text } from "~/components/ui/text";
import { refreshRecommendation } from "~/lib/api";
import { keys, queryClient } from "~/lib/query";
import { useColors } from "~/theme/theme";

type Rec = { headline: string; body: string };

/**
 * Today's take, stale-while-revalidate: this morning's sentence shows while this
 * evening's is written, and the only blank card is the first one ever. The
 * regeneration is fired and never awaited by anything the person is waiting on.
 */
export function RecommendationCard({ rec, stale }: { rec: Rec | null; stale: boolean }) {
  const t = useTranslations("Overview");
  const c = useColors();
  const [pending, setPending] = useState(stale && !rec);
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) return;
    started.current = true;
    let alive = true;
    setPending(!rec);
    void refreshRecommendation()
      .then(({ refreshed }) => {
        if (!alive) return;
        setPending(false);
        if (refreshed) void queryClient.invalidateQueries({ queryKey: keys.screen("overview") });
      })
      .catch(() => alive && setPending(false));
    return () => {
      alive = false;
    };
  }, [stale, rec]);

  if (rec) {
    return (
      <View style={{ borderLeftWidth: 2, borderLeftColor: c.ink, paddingLeft: 16 }} accessibilityLabel={t("recommendationTitle")}>
        <Text size="base" weight={500}>
          {rec.headline}
        </Text>
        <Text size="sm" tone="muted" style={{ marginTop: 4 }}>
          {rec.body}
        </Text>
      </View>
    );
  }

  if (pending) {
    const bar = (w: number | `${number}%`, h: number, mt = 0) => (
      <View style={{ backgroundColor: c.paperLine, height: h, width: w, borderRadius: 4, marginTop: mt }} />
    );
    return (
      <View
        style={{ borderLeftWidth: 2, borderLeftColor: c.paperLine, paddingLeft: 16 }}
        accessibilityState={{ busy: true }}
        accessibilityLabel={t("recommendationLoading")}
      >
        {bar(96, 12)}
        {bar(160, 16, 8)}
        {bar("100%", 12, 8)}
        {bar("66%", 12, 6)}
      </View>
    );
  }

  // Nothing cached and nothing coming: an absent take is a missing nicety, not an error.
  return null;
}
