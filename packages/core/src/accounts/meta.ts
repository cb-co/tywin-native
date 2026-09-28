import { SWATCHES } from "../palette";
export const ACCOUNT_TYPE_VALUES = [
  "checking",
  "savings",
  "cash",
  "investment",
  "asset",
  "credit_card",
  "loan",
] as const;

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];
export type GroupKey = "cash" | "assets" | "cards" | "loans";

/** A Lucide glyph name. The app maps it to the icon component, so this module stays platform-free. */
export type AccountIconName =
  | "Landmark"
  | "PiggyBank"
  | "Wallet"
  | "TrendingUp"
  | "Home"
  | "CreditCard"
  | "HandCoins";

type Meta = { label: string; icon: AccountIconName; group: GroupKey; color: string };

/* Per-type identity colour for the tile Stamp draws when an account has
   no colour of its own (the common case — accounts have no colour picker).
   Picked from the shared SWATCHES palette so an account's tile always clears
   the same contrast bar as a category's or goal's. Distinct from `account.color`,
   which still wins whenever a row has one set. */
export const ACCOUNT_TYPE_META: Record<AccountType, Meta> = {
  checking: { label: "Checking", icon: "Landmark", group: "cash", color: SWATCHES[2] },
  savings: { label: "Savings", icon: "PiggyBank", group: "cash", color: SWATCHES[0] },
  cash: { label: "Cash", icon: "Wallet", group: "cash", color: SWATCHES[1] },
  investment: { label: "Investment", icon: "TrendingUp", group: "cash", color: SWATCHES[11] },
  asset: { label: "Asset", icon: "Home", group: "assets", color: SWATCHES[4] },
  credit_card: { label: "Credit card", icon: "CreditCard", group: "cards", color: SWATCHES[7] },
  loan: { label: "Loan", icon: "HandCoins", group: "loans", color: SWATCHES[3] },
};

export const CREATABLE_TYPES: AccountType[] = [...ACCOUNT_TYPE_VALUES];

/* Ordered by how often you act on a section: accounts, then the debts you
   service monthly, then property last. Assets are held for completeness of
   net worth rather than day-to-day use, and their value is a hand-maintained
   estimate rather than a balance derived from transactions, so they neither
   belong beside spendable cash nor deserve space above the fold. */
export const ACCOUNT_GROUPS: { key: GroupKey; title: string; blurb: string }[] = [
  { key: "cash", title: "Accounts", blurb: "Banks, cash, and investments." },
  { key: "cards", title: "Credit cards", blurb: "Reconciled balances and utilization." },
  { key: "loans", title: "Loans", blurb: "Outstanding balance and payoff progress." },
  { key: "assets", title: "Property & assets", blurb: "Estimated values you keep up to date." },
];

/** How an account is labelled in any picker or filter.
 *
 *  Always includes the currency. Names alone are not unique in practice: the
 *  same card or account is commonly held in two currencies ("Visa Infinite"
 *  in DOP and USD), and a list of identical names is unusable. Centralised
 *  because it previously drifted, with the transaction form showing the
 *  currency while the subscription form and ledger filter did not. */
export function accountOptionLabel(account: {
  name: string;
  currency: string;
}): string {
  return `${account.name} · ${account.currency}`;
}

export const isCard = (t: AccountType) => t === "credit_card";
export const isLoan = (t: AccountType) => t === "loan";
export const accountTypeMeta = (t: AccountType) => ACCOUNT_TYPE_META[t];

/** Transfer tax and network fee model money leaving a bank account via wire/ACH. */
export const isBankAccount = (t: AccountType) => t === "checking" || t === "savings";
/** Where transfer-fee settings are configurable: bank accounts plus investment accounts. */
export const hasTransferFees = (t: AccountType) => isBankAccount(t) || t === "investment";
