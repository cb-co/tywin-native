import { CreditCard, HandCoins, Home, Landmark, PiggyBank, TrendingUp, Wallet, type LucideIcon } from "~/components/ui/icons";
import { accountTypeMeta, type AccountIconName, type AccountType } from "@cigua/core/accounts/meta";

const ICONS: Record<AccountIconName, LucideIcon> = {
  Landmark,
  PiggyBank,
  Wallet,
  TrendingUp,
  Home,
  CreditCard,
  HandCoins,
};

/** The glyph an account type prints in its stamp. */
export function accountTypeIcon(type: AccountType): LucideIcon {
  return ICONS[accountTypeMeta(type).icon];
}
