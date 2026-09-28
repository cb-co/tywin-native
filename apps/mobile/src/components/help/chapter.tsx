import { View } from "react-native";
import type { LucideIcon } from "~/components/ui/icons";
import { Text } from "~/components/ui/text";
import { makeStyles, useColors } from "~/theme/theme";

export function HelpChapter({
  icon: Icon,
  index,
  title,
  intro,
  children,
  last,
}: {
  icon: LucideIcon;
  index: number;
  title: string;
  intro: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const c = useColors();
  const s = useStyles();
  return (
    <View style={[s.chapter, last ? null : s.rule]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={s.icon}>
          <Icon size={18} color={c.foreground} />
        </View>
        <View>
          <Text legend tone="muted" figure style={{ fontSize: 10 }}>
            Chapter {index}
          </Text>
          <Text legend size="base" accessibilityRole="header">
            {title}
          </Text>
        </View>
      </View>
      <Text size="sm" tone="muted" style={{ marginTop: 12, lineHeight: 22 }}>
        {intro}
      </Text>
      <View style={{ marginTop: 20, gap: 24 }}>{children}</View>
    </View>
  );
}

export function HelpCallout({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: string }) {
  const c = useColors();
  const s = useStyles();
  return (
    <View style={s.callout}>
      <Icon size={16} color={c.accentForeground} style={{ marginTop: 2 }} />
      <Text size="sm" color={c.accentForeground} style={{ flex: 1 }}>
        <Text size="sm" weight={600} color={c.accentForeground}>
          {title}
        </Text>{" "}
        {children}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  chapter: { paddingVertical: 40 },
  rule: { borderBottomWidth: 2, borderBottomColor: c.rule },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.rule },
  callout: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    borderLeftWidth: 2,
    borderLeftColor: c.rule,
    backgroundColor: c.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
}));
