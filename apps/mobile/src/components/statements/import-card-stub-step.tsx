import { useState } from "react";
import { View } from "react-native";
import { useTranslations } from "use-intl";
import { CARD_CURRENCIES, isCardCurrency, type CardCurrency } from "@cigua/core/accounts/card-lines";
import { act } from "~/lib/query";
import { useFeedback } from "~/lib/feedback";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/field";
import { Segmented } from "~/components/ui/segmented";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";

/**
 * The three questions a card cannot be created without: its name, its currency
 * (DOP or USD) and, optionally, its last four digits. The limit, closing day and
 * due day are left to the first statement, which backfills exactly those, and
 * adds the card's other lines if the statement prints them. Standalone: the
 * import sheet and onboarding both mount it.
 */
export function ImportCardStubStep({
  onCreated,
  submitLabel,
  defaultCurrency,
}: {
  onCreated: (accountId: string) => void;
  submitLabel: string;
  /** The profile's base currency, when known. A card is DOP unless that says USD. */
  defaultCurrency?: string;
}) {
  const t = useTranslations("Statements");
  const { playSuccess, playError } = useFeedback();
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CardCurrency>(isCardCurrency(defaultCurrency) ? defaultCurrency : "DOP");
  const [last4, setLast4] = useState("");
  const trimmed = name.trim();

  async function submit() {
    if (!trimmed) return;
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
      <Field label={t("stubCurrencyLabel")}>
        <Segmented
          value={currency}
          onChange={setCurrency}
          items={CARD_CURRENCIES.map((c) => ({ value: c, label: c }))}
          accessibilityLabel={t("stubCurrencyLabel")}
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
      <Button onPress={submit} disabled={pending || !trimmed} isLoading={pending}>
        {submitLabel}
      </Button>
    </View>
  );
}
