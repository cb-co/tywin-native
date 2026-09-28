import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { DEFAULT_BASE_CURRENCY } from "@cigua/core/profile";
import { callAction } from "~/lib/api";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/field";
import { Select } from "~/components/ui/select";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";

/**
 * The three questions a card cannot be created without: its name, its currency
 * and, optionally, its last four digits. The limit, closing day and due day are
 * left to the first statement, which backfills exactly those. Standalone: the
 * import sheet and onboarding both mount it.
 */
export function ImportCardStubStep({
  onCreated,
  submitLabel,
  defaultCurrency,
}: {
  onCreated: (accountId: string) => void;
  submitLabel: string;
  /** "" means no preference: the profile's base currency once the list loads. */
  defaultCurrency: string;
}) {
  const t = useTranslations("Statements");
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [last4, setLast4] = useState("");
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [currenciesFailed, setCurrenciesFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void callAction("statements", "listStubCurrencies")
      .then((result) => {
        if (cancelled) return;
        setCurrencies(result.currencies);
        setCurrency((c) => c || result.baseCurrency);
      })
      .catch(() => {
        if (cancelled) return;
        // Degraded, not stuck: the app-wide default stands in so the form still works.
        setCurrenciesFailed(true);
        setCurrency((c) => c || DEFAULT_BASE_CURRENCY);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options =
    !currency || currencies.some((c) => c.code === currency) ? currencies : [{ code: currency, name: currency }, ...currencies];
  const trimmed = name.trim();

  async function submit() {
    if (!trimmed || !currency) return;
    setPending(true);
    try {
      const result = await act("accounts", "createCardStub", { name: trimmed, currency, last4: last4 || undefined });
      if (!result.id) {
        if (result.error) toast.error(result.error);
        playError();
        return;
      }
      playSuccess();
      onCreated(result.id);
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text size="sm" weight={500}>
          {t("stubHeading")}
        </Text>
        <Text size="xs" tone="muted">
          {t("stubHint")}
        </Text>
      </View>
      <Field label={t("stubNameLabel")}>
        <Input
          value={name}
          autoFocus
          placeholder={t("stubNamePlaceholder")}
          maxLength={80}
          onChangeText={setName}
          returnKeyType="next"
        />
      </Field>
      <Field label={t("stubCurrencyLabel")} error={currenciesFailed ? t("currenciesFailed") : null}>
        <Select
          value={currency || null}
          onValueChange={setCurrency}
          title={t("stubCurrencyLabel")}
          options={options.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
        />
      </Field>
      <Field label={t("stubLast4Label")}>
        {/* Digits that identify rather than count: leading zeroes matter. */}
        <Input
          keyboardType="number-pad"
          maxLength={4}
          placeholder={t("stubLast4Placeholder")}
          value={last4}
          onChangeText={(v) => setLast4(v.replace(/\D/g, "").slice(0, 4))}
        />
      </Field>
      <Button onPress={submit} disabled={pending || !trimmed || !currency} isLoading={pending}>
        {submitLabel}
      </Button>
    </View>
  );
}
