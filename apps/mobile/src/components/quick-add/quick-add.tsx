import { createContext, useContext, useMemo, useState } from "react";

type QuickAddValue = { open: boolean; setOpen: (v: boolean) => void };
const Ctx = createContext<QuickAddValue | null>(null);

/** Whether the quick-add sheet is open. The seal on the shell and Overview's actions open it. */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuickAdd(): QuickAddValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}
