import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { LOCALES, LOCALE_LABEL } from "@cigua/core/i18n/locale";
import { act } from "~/lib/query";
import { useAppLocale } from "~/lib/i18n";
import { Field, Input } from "~/components/ui/field";
import { Segmented } from "~/components/ui/segmented";
import { toast } from "~/components/ui/toast";
import { CurrencySelect, StepFooter, StepHeading } from "./parts";
import type { StepProps } from "./types";

/** Name, language and base currency on one screen. The language applies the moment it is tapped. */
export function StepAbout({
  currencies,
  baseCurrency,
  onNext,
  initialName,
  onCurrencyChange,
}: StepProps & { initialName: string; onCurrencyChange: (code: string) => void }) {
  const t = useTranslations("Welcome");
  const { locale, setLocale } = useAppLocale();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState(baseCurrency);

  async function submit() {
    if (!name.trim() || pending) return;
    setPending(true);
    try {
      const r = await act("settings", "updateDisplayName", name);
      if (r.error) return void toast.error(r.error);
      if (currency !== baseCurrency) {
        const c = await act("settings", "updateBaseCurrency", currency);
        if (c.error) return void toast.error(c.error);
        onCurrencyChange(currency);
      }
      onNext();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("aboutTitle")} body={t("aboutBody")} />
        <Field label={t("nameLabel")}>
          <Input
            autoFocus
            value={name}
            maxLength={40}
            autoComplete="name"
            textContentType="name"
            placeholder={t("namePlaceholder")}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
        </Field>
        <Field label={t("languageLabel")}>
          <Segmented stretch size="sm" value={locale} onChange={setLocale} items={LOCALES.map((l) => ({ value: l, label: LOCALE_LABEL[l] }))} />
        </Field>
        <Field label={t("currencyLabel")} hint={t("currencyHint")}>
          <CurrencySelect value={currency} onChange={setCurrency} currencies={currencies} label={t("currencyLabel")} />
        </Field>
      </View>
      <StepFooter
        primary={{ label: t("continueButton"), onPress: () => void submit(), disabled: !name.trim() || currency.length !== 3, pending }}
      />
    </>
  );
}
