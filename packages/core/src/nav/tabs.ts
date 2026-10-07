/**
 * The bottom band: six cells, one per page, in a fixed order. Nothing hides
 * behind a sheet, and no cell moves when another is chosen, so a page is always
 * in the same place under the thumb.
 *
 * The band names are short forms of the page titles ("Ledger" for
 * Transactions, "Plan" for Budgets & Goals) because six cells share the width
 * of the narrowest phone. `tabs.test.ts` measures every name in every language
 * against the app's own font, so a name that would crowd its neighbours fails
 * the build rather than the band.
 */
export const TABS = [
  { route: "index", key: "overview" },
  { route: "accounts", key: "wallet" },
  { route: "transactions", key: "ledger" },
  { route: "recurring", key: "recurring" },
  { route: "budgets", key: "plan" },
  { route: "insights", key: "insights" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** Tab names are set at this size, in the semibold cut the current tab uses. */
export const TAB_LABEL_SIZE = 11;

/** The narrowest phone the band is drawn for (iPhone SE, mini). */
export const TAB_MIN_SCREEN = 375;

/** The least room between two neighbouring names at TAB_LABEL_SIZE. */
export const TAB_MIN_GAP = 12;

/**
 * Each name's box is inset this much per side. At large accessibility text
 * sizes a name that would outgrow its box shrinks to fit instead, so even then
 * two names keep at least twice this apart.
 */
export const TAB_LABEL_INSET = 3;
