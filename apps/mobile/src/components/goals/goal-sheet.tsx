import { useEffect, useState } from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import type { GoalCardRow } from "@cigua/worker/api";
import { SWATCHES } from "@cigua/core/palette";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/field";
import { FieldRow, FormDate, FormText } from "~/components/ui/form";
import { Sheet } from "~/components/ui/overlay";
import { SwatchPicker } from "~/components/ui/swatch-picker";
import { toast } from "~/components/ui/toast";

type Values = { name: string; emoji: string; target_amount: string; target_date: string };

/** Add or edit a savings goal: name, target, an optional date, a colour. */
export function GoalSheet({
  mode = "create",
  goal,
  open,
  onClose,
}: {
  mode?: "create" | "edit";
  goal?: Pick<GoalCardRow, "id" | "name" | "emoji" | "color" | "target_amount" | "target_date">;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("GoalDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [color, setColor] = useState<string>(goal?.color ?? SWATCHES[0]);
  const defaults = (): Values => ({
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? "",
    target_amount: goal ? String(goal.target_amount) : "",
    target_date: goal?.target_date ?? "",
  });
  const { control, handleSubmit, reset } = useForm<Values>({ defaultValues: defaults() });

  useEffect(() => {
    if (!open) return;
    reset(defaults());
    setColor(goal?.color ?? SWATCHES[0]);
    // Seeded on open only: a background refetch must not wipe a half-typed edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: Values) {
    if (!values.name.trim() || !(Number(values.target_amount) > 0)) return;
    setPending(true);
    try {
      const payload = { ...values, color };
      const result = mode === "edit" && goal ? await act("goals", "updateGoal", goal.id, payload) : await act("goals", "createGoal", payload);
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
          <FormText control={control} name="emoji" label={t("emojiLabel")} placeholder="🏝️" style={{ textAlign: "center" }} />
        </View>
        <View style={{ flex: 1 }}>
          <FormText control={control} name="name" label={t("nameLabel")} placeholder={t("namePlaceholder")} required autoFocus={mode === "create"} />
        </View>
      </FieldRow>
      <FormText control={control} name="target_amount" label={t("targetLabel")} required numeric />
      <FormDate control={control} name="target_date" label={t("targetDateLabel")} hint={t("targetDateHint")} />
      <View style={{ gap: 8 }}>
        <Label>{t("colorLabel")}</Label>
        <SwatchPicker value={color} onChange={setColor} labelFor={(sw) => t("colorSwatchAria", { color: sw })} />
      </View>
    </Sheet>
  );
}
