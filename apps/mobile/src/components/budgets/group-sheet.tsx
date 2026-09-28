import { useEffect, useState } from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { SWATCHES } from "@cigua/core/palette";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/field";
import { FieldRow, FormText } from "~/components/ui/form";
import { Sheet } from "~/components/ui/overlay";
import { SwatchPicker } from "~/components/ui/swatch-picker";
import { toast } from "~/components/ui/toast";

type Group = ScreenData<"budgets">["groupOverview"]["rows"][number];
type Values = { name: string; emoji: string };

/**
 * Add or edit a budget group. A near-copy of CategorySheet on purpose: a group
 * never gets a group field, because groups do not nest.
 */
export function GroupSheet({
  mode = "create",
  group,
  open,
  onClose,
}: {
  mode?: "create" | "edit";
  group?: Group;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("BudgetGroupDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [color, setColor] = useState<string>(group?.color ?? SWATCHES[0]);
  const { control, handleSubmit, reset } = useForm<Values>({
    defaultValues: { name: group?.name ?? "", emoji: group?.emoji ?? "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: group?.name ?? "", emoji: group?.emoji ?? "" });
    setColor(group?.color ?? SWATCHES[0]);
    // Seeded on open only: a background refetch must not wipe a half-typed edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: Values) {
    if (!values.name.trim()) return;
    setPending(true);
    try {
      const payload = { ...values, color };
      const result =
        mode === "edit" && group
          ? await act("budgetGroups", "updateBudgetGroup", group.budget_group_id, payload)
          : await act("budgetGroups", "createBudgetGroup", payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      playSuccess();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === "edit" ? t("editTitle") : t("addTitle")}
      footer={
        <Button disabled={pending} isLoading={pending} onPress={handleSubmit(onSubmit)}>
          {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
        </Button>
      }
    >
      <FieldRow>
        <View style={{ width: 72 }}>
          <FormText control={control} name="emoji" label={t("emojiLabel")} placeholder="🏠" style={{ textAlign: "center" }} />
        </View>
        <View style={{ flex: 1 }}>
          <FormText control={control} name="name" label={t("nameLabel")} placeholder={t("namePlaceholder")} required autoFocus={mode === "create"} />
        </View>
      </FieldRow>
      <View style={{ gap: 8 }}>
        <Label>{t("colorLabel")}</Label>
        <SwatchPicker value={color} onChange={setColor} labelFor={(sw) => t("colorSwatchAria", { color: sw })} />
      </View>
    </Sheet>
  );
}
