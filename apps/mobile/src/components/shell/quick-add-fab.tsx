import { StyleSheet, View } from "react-native";
import { Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { Button } from "~/components/ui/button";
import { useQuickAdd } from "~/components/quick-add/quick-add";
import { useColors } from "~/theme/theme";

/** The one violet seal on the shell: quick-add is the signature action. */
export function QuickAddFab({ bottom }: { bottom: number }) {
  const { setOpen } = useQuickAdd();
  const t = useTranslations("QuickAdd");
  const c = useColors();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <View style={[styles.ring, { borderColor: c.noteLine, backgroundColor: c.background }]}>
        <Button
          variant="brand"
          size="icon"
          icon={Plus}
          onPress={() => setOpen(true)}
          accessibilityLabel={t("title")}
          style={styles.fab}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16 },
  ring: { borderRadius: 34, borderWidth: 2, padding: 2 },
  fab: { width: 60, height: 60, borderRadius: 30 },
});
