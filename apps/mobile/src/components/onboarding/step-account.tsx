import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { ACCOUNT_TYPE_META, type AccountType } from "@cigua/core/accounts/meta";
import { act } from "~/lib/query";
import { Field, Input } from "~/components/ui/field";
import { FieldRow, Half } from "~/components/ui/form";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { accountTypeIcon } from "~/components/accounts/type-icon";
import { ChoiceCard, CurrencySelect, SavedRow, StepFooter, StepHeading, refreshWelcome } from "./parts";
import { isMainAccount, type StepProps } from "./types";

/** One plain balance account. Cards and loans have steps of their own. */
const STARTER_TYPES = ["checking", "savings", "cash", "investment"] as const;
type StarterType = (typeof STARTER_TYPES)[number];

export function StepAccount({ data, currencies, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const tType = useTranslations("AccountTypes");
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<StarterType>("checking");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [balance, setBalance] = useState("");

  // Back here after it exists shows what was made; editing happens on Accounts later.
  const existing = data.accounts.filter(isMainAccount);

  async function submit() {
    if (existing.length) return onNext();
    if (!name.trim() || pending) return;
    setPending(true);
    try {
      const created = await act("accounts", "createAccount", {
        name: name.trim(),
        type,
        currency,
        starting_balance: Number(balance || 0),
        transfer_tax_rate: 0.002,
        network_fee_amount: 0,
        network_fee_optional: true,
        current_balance: 0,
      });
      if (created.error) return void toast.error(created.error);
      await refreshWelcome();
      onNext();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("accountTitle")} body={t("accountBody")} />
        {existing.length ? (
          <>
            <View style={{ gap: 8 }}>
              {existing.map((a) => {
                const meta = ACCOUNT_TYPE_META[a.type as AccountType];
                return (
                  <SavedRow
                    key={a.id}
                    icon={accountTypeIcon(a.type as AccountType)}
                    color={meta.color}
                    title={a.name}
                    subtitle={`${tType(a.type as AccountType)} · ${a.currency}`}
                  />
                );
              })}
            </View>
            <Text size="xs" tone="muted">
              {t("accountDone")}
            </Text>
          </>
        ) : (
          <>
            <Field label={t("accountTypeLabel")}>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {STARTER_TYPES.map((x) => (
                  <ChoiceCard key={x} on={type === x} title={tType(x)} onPress={() => setType(x)} />
                ))}
              </View>
            </Field>
            <Field label={t("accountNameLabel")}>
              <Input autoFocus value={name} maxLength={80} placeholder={t("accountNamePlaceholder")} onChangeText={setName} returnKeyType="next" />
            </Field>
            <FieldRow>
              <Half>
                <Field label={t("accountCurrencyLabel")}>
                  <CurrencySelect value={currency} onChange={setCurrency} currencies={currencies} compact label={t("accountCurrencyLabel")} />
                </Field>
              </Half>
              <Half>
                <Field label={t("accountBalanceLabel")}>
                  <Input
                    value={balance}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    figure
                    onChangeText={setBalance}
                    returnKeyType="done"
                    onSubmitEditing={() => void submit()}
                  />
                </Field>
              </Half>
            </FieldRow>
          </>
        )}
      </View>
      <StepFooter
        onBack={onBack}
        primary={{ label: t("continueButton"), onPress: () => void submit(), disabled: !existing.length && !name.trim(), pending }}
      />
    </>
  );
}
