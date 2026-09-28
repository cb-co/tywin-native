import { useCallback, useState } from "react";
import { View } from "react-native";
import { ArrowLeftRight, Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { TransactionWithRefs } from "@cigua/worker/api";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/screen";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { TransactionRow } from "~/components/transactions/transaction-row";
import { TransactionSheet } from "~/components/transactions/transaction-sheet";
import { useColors } from "~/theme/theme";

/** This account's latest movements, with add (pinned to the account), edit and delete. */
export function AccountActivity({ accountId, transactions }: { accountId: string; transactions: TransactionWithRefs[] }) {
  const t = useTranslations("AccountDetail");
  const c = useColors();
  const { playDelete, playError } = useFeedback();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TransactionWithRefs | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const onDelete = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        const result = await act("transactions", "deleteTransaction", id);
        if (result.error) {
          toast.error(result.error);
          playError();
          return;
        }
        toast.success(t("transactionDeleted"));
        playDelete();
      } finally {
        setDeleting(null);
      }
    },
    [t, playDelete, playError],
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text size="lg" weight={500} accessibilityRole="header">
          {t("recentActivity")}
        </Text>
        <Button size="sm" icon={Plus} onPress={() => setAdding(true)}>
          {t("addTransaction")}
        </Button>
      </View>
      {transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={24} color={c.foreground} />}
          title={t("noActivityTitle")}
          description={t("noActivityDescription")}
        />
      ) : (
        <Card flush style={{ paddingHorizontal: 20 }}>
          {transactions.map((txn, i) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              rule={i < transactions.length - 1}
              onEdit={setEditing}
              onDelete={onDelete}
              pending={deleting === txn.id}
              viewAccountId={accountId}
            />
          ))}
        </Card>
      )}
      <TransactionSheet open={adding} onClose={() => setAdding(false)} defaultAccountId={accountId} />
      <TransactionSheet open={!!editing} onClose={() => setEditing(null)} mode="edit" transaction={editing ?? undefined} />
    </View>
  );
}
