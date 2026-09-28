import { ProofMark } from "~/components/papel/proof-mark";
import { Mark } from "~/components/transactions/mark";

type BudgetStatus = "within" | "approaching" | "over";

/** Budget state as a glyph or a tag, never a colour: nothing within, a tag when near, a flag when over. */
export function BudgetStatusMark({ status, overLabel, nearLabel }: { status: BudgetStatus; overLabel: string; nearLabel: string }) {
  if (status === "over") return <ProofMark tone="flag">{overLabel}</ProofMark>;
  if (status === "approaching") return <Mark>{nearLabel}</Mark>;
  return null;
}
