import { isInstallmentSection } from "@cigua/core/statements/line-name";

export interface CardAccountOption {
  id: string;
  name: string;
  currency: string;
  credit_limit: number | null;
  statement_closing_day?: number | null;
  payment_due_day?: number | null;
}

/** Heuristic pre-fill only — the user confirms in the mapping dialog.
 *  Never trusted to route money silently (spec §2.2). */
export function suggestAccountId(
  section: { currency: string; creditLimitCents: number | null },
  options: CardAccountOption[],
): string | null {
  const sameCurrency = options.filter((o) => o.currency === section.currency);
  if (sameCurrency.length === 0) return null;
  if (sameCurrency.length === 1) return sameCurrency[0].id;
  if (section.creditLimitCents === null) return null;
  const target = section.creditLimitCents / 100;
  return sameCurrency
    .slice()
    .sort(
      (a, b) =>
        Math.abs((a.credit_limit ?? Infinity) - target) -
        Math.abs((b.credit_limit ?? Infinity) - target),
    )[0].id;
}

/**
 * `suggestAccountId` per section, but run so the sections can see each other's
 * picks — called independently, two same-currency sections both reach for the
 * one line that fits. A card with a DOP line but no cuotas line yet has
 * exactly one DOP-currency option, and consumos and cuotas are both DOP, so
 * both independently "win" it: one silently, the other left stuck unmapped
 * with its only option already taken, instead of prompting to add the cuotas
 * line it actually needs.
 *
 * Installments are suggested last so a lone same-currency line goes to the
 * everyday section first, leaving cuotas to ask for a line of its own rather
 * than borrow one. A section already in `saved` keeps that mapping and claims
 * its account before anything is suggested, so a prior explicit choice always
 * wins over a fresh guess.
 */
export function suggestAccountMappings(
  sections: { sectionKey: string; currency: string; creditLimitCents: number | null }[],
  saved: Map<string, string>,
  options: CardAccountOption[],
): Map<string, string | null> {
  const claimed = new Set(
    sections.map((s) => saved.get(s.sectionKey)).filter((id): id is string => !!id),
  );
  const suggestions = new Map<string, string | null>();
  const ordered = [...sections].sort(
    (a, b) => Number(isInstallmentSection(a.sectionKey)) - Number(isInstallmentSection(b.sectionKey)),
  );
  for (const s of ordered) {
    if (saved.get(s.sectionKey)) continue;
    const pick = suggestAccountId(
      s,
      options.filter((o) => !claimed.has(o.id)),
    );
    if (pick) claimed.add(pick);
    suggestions.set(s.sectionKey, pick);
  }
  return suggestions;
}
