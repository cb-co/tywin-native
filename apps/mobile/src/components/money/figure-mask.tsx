import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { formatMoney, type MoneyOpts } from "@cigua/core/format";
import { prefs, PREF } from "~/lib/storage";

/**
 * Masks a formatted money string by swapping each digit for a bullet, e.g.
 * "$1,234.56" -> "$•,•••.••". Keeps the currency symbol, grouping separators,
 * sign and decimal point in place so the result still reads as a number of
 * roughly the right size, rather than a fixed-width stand-in like "****".
 */
export function maskFigure(formatted: string): string {
  return formatted.replace(/\d/g, "•");
}

type FigureMaskValue = { masked: boolean; toggle: () => void };
const Ctx = createContext<FigureMaskValue | null>(null);

/** Privacy mode: every figure prints as bullets until toggled back. Remembered on this device. */
export function FigureMaskProvider({ children }: { children: React.ReactNode }) {
  const [masked, setMasked] = useState(() => prefs.getBoolean(PREF.figuresMasked, false));
  const toggle = useCallback(() => {
    setMasked((m) => {
      prefs.setBoolean(PREF.figuresMasked, !m);
      return !m;
    });
  }, []);
  const value = useMemo(() => ({ masked, toggle }), [masked, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFigureMask(): FigureMaskValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFigureMask must be used within FigureMaskProvider");
  return ctx;
}

/** `formatMoney`, masked while figure masking is on: for axes, captions and other plain strings. */
export function useMaskedFormatMoney() {
  const { masked } = useFigureMask();
  return useCallback(
    (amount: number, currency: string, opts?: MoneyOpts) => {
      const formatted = formatMoney(amount, currency, opts);
      return masked ? maskFigure(formatted) : formatted;
    },
    [masked],
  );
}
