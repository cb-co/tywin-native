import { TransactionSheet } from "~/components/transactions/transaction-sheet";
import { useQuickAdd } from "./quick-add";

/** Quick add: the compact transaction form, opened by the seal on the shell. */
export function QuickAddSheet() {
  const { open, setOpen } = useQuickAdd();
  return <TransactionSheet open={open} onClose={() => setOpen(false)} compact />;
}
