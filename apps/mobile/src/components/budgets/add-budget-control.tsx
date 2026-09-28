import { useState } from "react";
import { FolderPlus, Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { Button } from "~/components/ui/button";
import { Menu } from "~/components/ui/menu";
import { CategorySheet } from "./category-sheet";
import { GroupSheet } from "./group-sheet";

type Group = ScreenData<"budgets">["groupOverview"]["rows"][number];

/** The page's two "add" actions behind one button: choosing a kind opens its form. */
export function AddBudgetControl({ groups = [] }: { groups?: Group[] }) {
  const t = useTranslations("Budgets");
  const tg = useTranslations("BudgetGroups");
  const [pending, setPending] = useState<"category" | "group" | null>(null);
  return (
    <>
      <Menu
        title={t("addPlaceholder")}
        items={[
          { label: t("addCategory"), icon: Plus, onPress: () => setPending("category") },
          { label: tg("addGroup"), icon: FolderPlus, onPress: () => setPending("group") },
        ]}
        trigger={(open) => (
          <Button icon={Plus} onPress={open}>
            {t("addPlaceholder")}
          </Button>
        )}
      />
      <CategorySheet mode="create" groups={groups} open={pending === "category"} onClose={() => setPending(null)} />
      <GroupSheet mode="create" open={pending === "group"} onClose={() => setPending(null)} />
    </>
  );
}
