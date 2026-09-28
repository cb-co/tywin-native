import { useState } from "react";
import { View } from "react-native";
import { Check, CreditCard, Plus } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { ACCOUNT_TYPE_META } from "@cigua/core/accounts/meta";
import { Button } from "~/components/ui/button";
import { ImportCardStubStep } from "~/components/statements/import-card-stub-step";
import { StatementImportSheet } from "~/components/statements/statement-import-sheet";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";
import { SavedRow, StepFooter, StepHeading, refreshWelcome } from "./parts";
import type { StepProps } from "./types";

/**
 * Any number of cards, each a stub (name, currency, last 4): limit, closing day
 * and due day are what the first statement fills in. Adding one does not open
 * its import, since the PDF may not be at hand; the row's own button does.
 */
export function StepCards({ data, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const tStatements = useTranslations("Statements");
  const c = useColors();
  const cards = data.accounts.filter((a) => a.type === "credit_card");
  const [adding, setAdding] = useState(cards.length === 0);
  const [importFor, setImportFor] = useState<string | null>(null);
  const meta = ACCOUNT_TYPE_META.credit_card;

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("cardsTitle")} body={t("cardsBody")} />
        {cards.length ? (
          <View style={{ gap: 8 }}>
            {cards.map((card) => (
              <SavedRow
                key={card.id}
                icon={CreditCard}
                color={meta.color}
                title={card.last4 ? `${card.name} ·· ${card.last4}` : card.name}
                subtitle={card.imported ? t("cardImported") : t("cardNoStatement")}
                trailing={
                  card.imported ? (
                    <Check size={16} color={c.primary} />
                  ) : (
                    <Button size="sm" variant="outline" onPress={() => setImportFor(card.id)}>
                      {t("cardImport")}
                    </Button>
                  )
                }
              />
            ))}
          </View>
        ) : null}
        {adding ? (
          <View style={{ borderRadius: radius.sheet + 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16 }}>
            <ImportCardStubStep
              // Remounted per card so the form comes back empty for the next one.
              key={cards.length}
              onCreated={() => {
                setAdding(false);
                void refreshWelcome();
              }}
              submitLabel={tStatements("stubSubmit")}
              defaultCurrency={baseCurrency}
            />
          </View>
        ) : (
          <Button variant="outline" icon={Plus} onPress={() => setAdding(true)} style={{ alignSelf: "flex-start" }}>
            {cards.length ? t("cardsAddAnother") : t("cardsAdd")}
          </Button>
        )}
      </View>
      <StepFooter
        onBack={onBack}
        primary={cards.length ? { label: t("continueButton"), onPress: onNext } : undefined}
        skip={cards.length ? undefined : { label: t("skipButton"), onPress: onNext }}
      />
      <StatementImportSheet
        open={importFor !== null}
        onClose={() => setImportFor(null)}
        accountId={importFor ?? undefined}
        openTriage={false}
        onImported={() => void refreshWelcome()}
      />
    </>
  );
}
