import { useTranslations } from "use-intl";
import { ACCOUNT_GROUPS, accountOptionLabel, accountTypeMeta, type AccountType } from "@cigua/core/accounts/meta";
import type { SelectOption } from "~/components/ui/select";

const GROUP_TITLE = {
  cash: "groupCashTitle",
  cards: "groupCardsTitle",
  loans: "groupLoansTitle",
  assets: "groupAssetsTitle",
} as const;

/**
 * Accounts as select options, grouped into the same four sections as the
 * Accounts screen (cash, cards, loans, assets) so a long list is never one
 * undifferentiated block. Every label carries the currency.
 */
export function useAccountOptions() {
  const t = useTranslations("Accounts");
  return (list: { id: string; name: string; currency: string; type: string }[]): SelectOption[] =>
    ACCOUNT_GROUPS.flatMap((g) =>
      list
        .filter((a) => accountTypeMeta(a.type as AccountType).group === g.key)
        .map((a) => ({ value: a.id, label: accountOptionLabel(a), group: t(GROUP_TITLE[g.key]) })),
    );
}
