import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ArrowUpRight } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Note } from "~/components/papel/note";
import { MoneyDisplay } from "~/components/money/money-display";
import { StatementImportSheet } from "~/components/statements/statement-import-sheet";
import { useColors } from "~/theme/theme";

/** Overview's only pitch for the importer, while the person has never imported or is overdue. */
export function ImportCallout({ state }: { state: "never" | "overdue" }) {
  const t = useTranslations("Overview");
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={{ borderLeftWidth: 2, borderLeftColor: c.ink, paddingLeft: 16 }}>
        <Text size="base" weight={500}>
          {t(state === "never" ? "importCalloutNeverTitle" : "importCalloutOverdueTitle")}
        </Text>
        <Text size="sm" tone="muted" style={{ marginTop: 4, maxWidth: 448 }}>
          {t(state === "never" ? "importCalloutNeverBody" : "importCalloutOverdueBody")}
        </Text>
        <Button style={{ marginTop: 12 }} onPress={() => setOpen(true)}>
          {t("importCalloutCta")}
        </Button>
      </View>
      <StatementImportSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** The empty Overview's one Note: import comes first; adding an account by hand is the quiet second action. */
export function EmptyOverviewNote({ currency }: { currency: string }) {
  const t = useTranslations("Overview");
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Note
        tone="violet"
        label={t("netWorth")}
        action={
          <>
            <Button onPress={() => setOpen(true)} style={{ backgroundColor: c.noteInk, borderColor: c.noteInk }} textColor={c.note}>
              {t("importCalloutCta")}
            </Button>
            <Button
              variant="outline"
              icon={ArrowUpRight}
              iconEnd
              onPress={() => router.navigate("/accounts")}
              style={{ borderColor: c.noteInk }}
              textColor={c.noteInk}
            >
              {t("addAccount")}
            </Button>
          </>
        }
      >
        <MoneyDisplay amount={0} currency={currency} size="hero" width="expanded" weight={800} color={c.noteInk} />
        <Text size="sm" color={c.noteInk} style={{ marginTop: 12, maxWidth: 448, opacity: 0.85 }}>
          {t("netWorthEmptyBody")}
        </Text>
      </Note>
      <StatementImportSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
