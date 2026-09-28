import { StyleSheet, View, type ViewProps } from "react-native";
import { makeStyles } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/**
 * A sheet of paper framed by a hairline. No elevation: it separates from the
 * page by its rule, not by a shadow. `flush` drops the padding for ledgers.
 */
export function Card({ style, flush, ...props }: ViewProps & { flush?: boolean }) {
  const s = useStyles();
  return <View style={[s.card, flush ? null : s.padded, style]} {...props} />;
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.card,
    borderColor: c.paperLine,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sheet,
    overflow: "hidden",
  },
  padded: { padding: 16 },
}));
