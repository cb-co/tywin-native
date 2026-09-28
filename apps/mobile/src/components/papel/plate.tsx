import { View, type ViewStyle } from "react-native";
import { Card } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";

/** A chart's printed plate: a hairline sheet with a captioned head. `basis` says how it counts money. */
export function Plate({
  figLabel,
  title,
  basis,
  style,
  children,
}: {
  figLabel: string;
  title: string;
  basis?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const s = useStyles();
  return (
    <Card flush style={style}>
      <View style={s.head}>
        <Text legend accessibilityRole="header" style={{ fontSize: 11, flexShrink: 1 }}>
          <Text legend tone="muted" style={{ fontSize: 11 }}>
            {figLabel} ·{" "}
          </Text>
          {title}
        </Text>
        {basis ? (
          <Text size="xs" tone="muted">
            {basis}
          </Text>
        ) : null}
      </View>
      <View style={s.body}>{children}</View>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  head: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: c.rule,
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 12,
  },
  body: { padding: 16 },
}));
