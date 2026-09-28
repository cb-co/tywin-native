import { useTranslations } from "use-intl";
import type { TransactionWithRefs } from "@cigua/worker/api";
import { Sheet } from "~/components/ui/overlay";
import { Text } from "~/components/ui/text";
import { useScreen } from "~/lib/query";
import { TransactionForm } from "./transaction-form";

/** Add or edit a transaction in a sheet. The form mounts only while open, so its defaults reflect the latest data. */
export function TransactionSheet({
  open,
  onClose,
  mode = "create",
  transaction,
  defaultAccountId,
  compact,
}: {
  open: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  transaction?: TransactionWithRefs;
  defaultAccountId?: string;
  compact?: boolean;
}) {
  const t = useTranslations("TransactionForm");
  const tq = useTranslations("QuickAdd");
  const { data } = useScreen("quickAdd");
  const title = compact ? tq("title") : mode === "edit" ? t("dialogEditTitle") : t("dialogAddTitle");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <Text legend size="sm" accessibilityRole="header">
          {title}
        </Text>
      }
    >
      {open && data ? (
        <TransactionForm
          data={data}
          mode={mode}
          transaction={transaction}
          defaultAccountId={defaultAccountId}
          compact={compact}
          onSuccess={onClose}
        />
      ) : null}
    </Sheet>
  );
}
