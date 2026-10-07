import { StyleSheet, View } from "react-native";
import { Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { Button } from "~/components/ui/button";
import { useQuickAdd } from "~/components/quick-add/quick-add";
import { useColors } from "~/theme/theme";

/** Height of the quick-add seal; the tab screens' bottom clearance is sized from it. */
export const FAB_SIZE = 56;

/** The one violet seal on the shell: quick-add is the signature action. Its float
 *  shadow is the brand button's own; a hairline of note line keeps its edge on dark paper. */
export function QuickAddFab({ bottom }: { bottom: number }) {
  const { setOpen } = useQuickAdd();
  const t = useTranslations("QuickAdd");
  const c = useColors();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Button
        variant="brand"
        size="icon-lg"
        icon={Plus}
        onPress={() => setOpen(true)}
        accessibilityLabel={t("title")}
        style={{ ...styles.fab, borderColor: c.noteLine }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16 },
  fab: { width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2 },
});
