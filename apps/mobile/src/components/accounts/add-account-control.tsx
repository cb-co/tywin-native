import { useState } from "react";
import { Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { BankRow, CurrencyRow } from "@cigua/worker/api";
import { CREATABLE_TYPES, type AccountType } from "@cigua/core/accounts/meta";
import { Button } from "~/components/ui/button";
import { Menu } from "~/components/ui/menu";
import { AccountFormSheet } from "./account-form-sheet";
import { accountTypeIcon } from "./type-icon";

/**
 * "Add account" IS the type picker: choosing a type both sets it and opens the
 * form, which never asks for it again.
 */
export function AddAccountControl({
  currencies,
  banks,
  baseCurrency,
  label,
}: {
  currencies: CurrencyRow[];
  banks: BankRow[];
  baseCurrency: string;
  label: string;
}) {
  const tType = useTranslations("AccountTypes");
  const [pendingType, setPendingType] = useState<AccountType | null>(null);
  return (
    <>
      <Menu
        title={label}
        items={CREATABLE_TYPES.map((accType) => ({
          label: tType(accType),
          icon: accountTypeIcon(accType),
          onPress: () => setPendingType(accType),
        }))}
        trigger={(open) => (
          <Button icon={Plus} onPress={open}>
            {label}
          </Button>
        )}
      />
      <AccountFormSheet
        mode="create"
        currencies={currencies}
        banks={banks}
        baseCurrency={baseCurrency}
        initialType={pendingType ?? undefined}
        open={pendingType !== null}
        onClose={() => setPendingType(null)}
      />
    </>
  );
}
