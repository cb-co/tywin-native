/**
 * The pattern a merchant rule is stored under.
 *
 * Uppercase, single-spaced, trimmed — and nothing else. The temptation is to
 * strip the location tail Dominican issuers append (`SANTO DOMINGO-DO`,
 * `DISTRITO NACI-DO`) so a rule survives the same merchant at another branch.
 * Every regex that does it is greedy in the wrong place: `\s+[A-Z][A-Z ]*-[A-Z]{2}$`
 * reduces `IN&OUT CHARLES SUMMER SANTO DOMINGO-DO` to `IN&OUT`, which then matches
 * by substring against anything starting with those six characters.
 *
 * Rules are matched with `includes` (lib/statements/categorize.ts), so a full
 * description matches every repeat of that merchant — which, on real statements,
 * is all of them: descriptions arrive byte-identical. Someone who wants a broader
 * rule shortens the pattern by hand on the rules screen. An under-matching rule
 * costs one tap next month; an over-matching one mis-files money invisibly.
 */
export function merchantPattern(description: string): string {
  return description.replace(/\s+/g, " ").trim().toUpperCase();
}
