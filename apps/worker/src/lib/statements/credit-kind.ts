// A statement credit is cashback unless it undoes a charge. Classified at read time
// (like card-fees.ts) so already-imported statements are covered without re-importing.

export type CreditKind = "cashback" | "refund";

export type CreditLine = { description: string; mcc: string | null };

/** First word → second words seen after it (null when the description had only one). */
export type PurchaseIndex = ReadonlyMap<string, ReadonlySet<string | null>>;

const REWARD = [
  "CASHBACK", "CASH BACK", "REBATE", "BONIFICACION", "RECOMPENSA", "RECOMPENSAS",
  "PROMOCION", "PROMO", "BONO", "BONUS", "PUNTOS", "MILLAS", "REWARD", "REWARDS",
  "LEALTAD", "LOYALTY", "AHORRO POR COMPRA", "DINERO GANADO",
];

const UNDOES_A_CHARGE = [
  "REVERSO", "REVERSA", "REVERSAL", "ANULACION",
  "PAGO TOTAL", "PAGO OPORTUNO", "INTEREST REFUND",
  "DISPUTA", "DISPUTE", "CONTRACARGO", "CHARGEBACK", "PROVISIONAL",
  "DUPLICADO", "DUPLICADA", "DUPLICATE", "AJUSTE",
  "REEMBOLSO", "DEVOLUCION", "DEV", "REFUND", "RETURN",
];

const FILLER = new Set(["CREDITO", "CREDIT", "CR", "NC", "COMPRA", "PURCHASE", "POR", "DE", "DEL"]);

const words = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

const hasAny = (description: string, phrases: readonly string[]) => {
  const text = ` ${words(description).join(" ")} `;
  return phrases.some((p) => text.includes(` ${p} `));
};

/** The first two words that name the merchant, ignoring codes and refund filler. */
export function merchantWords(description: string): [string, string | null] | null {
  const ws = words(description).filter((w) => w.length > 1 && !/^\d+$/.test(w));
  while (ws.length > 0 && FILLER.has(ws[0])) ws.shift();
  return ws.length > 0 ? [ws[0], ws[1] ?? null] : null;
}

export function indexPurchases(descriptions: Iterable<string>): PurchaseIndex {
  const index = new Map<string, Set<string | null>>();
  for (const d of descriptions) {
    const m = merchantWords(d);
    if (!m) continue;
    const seconds = index.get(m[0]) ?? new Set<string | null>();
    seconds.add(m[1]);
    index.set(m[0], seconds);
  }
  return index;
}

function boughtFrom(purchases: PurchaseIndex, description: string): boolean {
  const m = merchantWords(description);
  const seconds = m ? purchases.get(m[0]) : undefined;
  if (!m || !seconds) return false;
  return m[1] === null || seconds.has(null) || seconds.has(m[1]);
}

/** The verdict vocabulary and MCC alone can give; null means purchase history decides. */
export function precheckCredit(line: CreditLine): CreditKind | null {
  if (hasAny(line.description, REWARD)) return "cashback";
  if (hasAny(line.description, UNDOES_A_CHARGE)) return "refund";
  if (line.mcc?.trim()) return "refund";
  return null;
}

export function classifyCredit(line: CreditLine, purchases: PurchaseIndex): CreditKind {
  return precheckCredit(line) ?? (boughtFrom(purchases, line.description) ? "refund" : "cashback");
}

export type StoredCreditLine = CreditLine & { id: string; account_id: string };

/** Kind per line id. A purchase only explains a credit on the same card. */
export function resolveCreditKinds(
  lines: readonly StoredCreditLine[],
  purchases: readonly { account_id: string; description: string }[],
): Map<string, CreditKind> {
  const byAccount = new Map<string, string[]>();
  for (const p of purchases) {
    const list = byAccount.get(p.account_id) ?? [];
    list.push(p.description);
    byAccount.set(p.account_id, list);
  }
  const none = indexPurchases([]);
  const indexes = new Map([...byAccount].map(([id, ds]) => [id, indexPurchases(ds)]));
  return new Map(lines.map((l) => [l.id, classifyCredit(l, indexes.get(l.account_id) ?? none)]));
}
