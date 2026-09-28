import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { AccountWithStatus, BankRow, CardGroupSibling, CurrencyRow } from "@cigua/worker/api";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/overlay";
import { toast } from "~/components/ui/toast";
import { AccountFormSheet } from "./account-form-sheet";
import { useColors } from "~/theme/theme";

export function AccountDetailActions({
  account,
  currencies,
  banks,
  baseCurrency,
  effectiveBonus,
  anchoredTo,
}: {
  account: AccountWithStatus;
  currencies: CurrencyRow[];
  banks: BankRow[];
  baseCurrency: string;
  effectiveBonus?: CardGroupSibling | null;
  anchoredTo?: string | null;
}) {
  const t = useTranslations("AccountDetail");
  const tc = useTranslations("Common");
  const c = useColors();
  const { playSuccess, playDelete, playError } = useFeedback();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onArchive() {
    setPending(true);
    try {
      const result = await act("accounts", "archiveAccount", account.id, !account.is_archived);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(account.is_archived ? t("accountRestored") : t("accountArchived"));
      playSuccess();
      router.navigate("/accounts");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    setPending(true);
    try {
      const result = await act("accounts", "deleteAccount", account.id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("accountDeleted"));
      playDelete();
      setConfirmOpen(false);
      router.navigate("/accounts");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <Button variant="outline" size="sm" icon={Pencil} onPress={() => setEditOpen(true)}>
        {tc("edit")}
      </Button>
      <Button variant="ghost" size="sm" icon={account.is_archived ? ArchiveRestore : Archive} onPress={onArchive} disabled={pending} isLoading={pending}>
        {account.is_archived ? t("restore") : t("archive")}
      </Button>
      <Button variant="ghost" size="sm" icon={Trash2} textColor={c.destructive} onPress={() => setConfirmOpen(true)}>
        {tc("delete")}
      </Button>

      <AccountFormSheet
        mode="edit"
        account={account}
        currencies={currencies}
        banks={banks}
        baseCurrency={baseCurrency}
        effectiveBonus={effectiveBonus}
        anchoredTo={anchoredTo}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        footer={
          <>
            <Button variant="outline" onPress={() => setConfirmOpen(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onPress={onDelete} disabled={pending} isLoading={pending}>
              {pending ? t("deleting") : tc("delete")}
            </Button>
          </>
        }
      />
    </View>
  );
}
