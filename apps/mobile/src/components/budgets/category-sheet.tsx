import { useEffect, useState } from "react";
import { View } from "react-native";
import { useForm } from "react-hook-form";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { NO_GROUP, toGroupId } from "@cigua/core/budgets/group-schema";
import { SWATCHES } from "@cigua/core/palette";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field, Label } from "~/components/ui/field";
import { FieldRow, FormText } from "~/components/ui/form";
import { Sheet } from "~/components/ui/overlay";
import { Select } from "~/components/ui/select";
import { SwatchPicker } from "~/components/ui/swatch-picker";
import { toast } from "~/components/ui/toast";

type Budgets = ScreenData<"budgets">;
type Category = Budgets["overview"]["rows"][number];
type Group = Budgets["groupOverview"]["rows"][number];
type Values = { name: string; emoji: string };

/** Add or edit a budget category. The group field shows only once a group exists. */
export function CategorySheet({
  mode = "create",
  category,
  groups = [],
  open,
  onClose,
}: {
  mode?: "create" | "edit";
  category?: Category;
  groups?: Group[];
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("CategoryDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [color, setColor] = useState<string>(category?.color ?? SWATCHES[0]);
  const [groupId, setGroupId] = useState<string>(category?.budget_group_id ?? NO_GROUP);
  const { control, handleSubmit, reset } = useForm<Values>({
    defaultValues: { name: category?.name ?? "", emoji: category?.emoji ?? "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ name: category?.name ?? "", emoji: category?.emoji ?? "" });
    setColor(category?.color ?? SWATCHES[0]);
    setGroupId(category?.budget_group_id ?? NO_GROUP);
    // Seeded on open only: a background refetch must not wipe a half-typed edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: Values) {
    if (!values.name.trim()) return;
    setPending(true);
    try {
      // The "no group" sentinel becomes a real null, or the uuid cast fails server-side.
      const payload = { ...values, color, budget_group_id: toGroupId(groupId) };
      const result =
        mode === "edit" && category
          ? await act("budgets", "updateCategory", category.category_id, payload)
          : await act("budgets", "createCategory", payload);
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
          <FormText control={control} name="emoji" label={t("emojiLabel")} placeholder="🍔" style={{ textAlign: "center" }} />
        </View>
        <View style={{ flex: 1 }}>
          <FormText control={control} name="name" label={t("nameLabel")} placeholder={t("namePlaceholder")} required autoFocus={mode === "create"} />
        </View>
      </FieldRow>
      {groups.length > 0 ? (
        <Field label={t("groupLabel")} hint={t("groupHint")}>
          <Select
            value={groupId}
            onValueChange={setGroupId}
            title={t("groupLabel")}
            options={[
              { value: NO_GROUP, label: t("groupNone") },
              ...groups.map((g) => ({ value: g.budget_group_id, label: `${g.emoji ? `${g.emoji} ` : ""}${g.name}` })),
            ]}
          />
        </Field>
      ) : null}
      <View style={{ gap: 8 }}>
        <Label>{t("colorLabel")}</Label>
        <SwatchPicker value={color} onChange={setColor} labelFor={(sw) => t("colorSwatchAria", { color: sw })} />
      </View>
    </Sheet>
  );
}
