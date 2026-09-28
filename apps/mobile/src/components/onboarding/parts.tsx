import { Pressable, View } from "react-native";
import { ArrowLeft, ArrowRight, type LucideIcon } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { CurrencyRow } from "@cigua/worker/api";
import { keys, queryClient } from "~/lib/query";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/select";
import { Text } from "~/components/ui/text";
import { LedgerRow } from "~/components/papel/ledger";
import { Stamp } from "~/components/papel/stamp";
import { makeStyles } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/** Re-reads what onboarding has saved, so a Back never offers to create it twice. */
export function refreshWelcome() {
  return queryClient.invalidateQueries({ queryKey: keys.screen("welcome") });
}

/** Title and one line of why, the same on every step. */
export function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text size="3xl" weight={600} tracking={-0.025} accessibilityRole="header">
        {title}
      </Text>
      <Text size="sm" tone="muted">
        {body}
      </Text>
    </View>
  );
}

type Action = { label: string; onPress: () => void; disabled?: boolean; pending?: boolean };

/**
 * Back on the left, the way forward on the right. A step with nothing added yet
 * offers only "Not now", so nothing reads as being saved.
 */
export function StepFooter({ onBack, primary, skip }: { onBack?: () => void; primary?: Action; skip?: Action }) {
  const t = useTranslations("Welcome");
  const busy = !!primary?.pending || !!skip?.pending;
  return (
    <View style={{ marginTop: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Button variant="ghost" icon={ArrowLeft} onPress={onBack} disabled={!onBack || busy} style={onBack ? undefined : { opacity: 0 }}>
        {t("backButton")}
      </Button>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        {skip ? (
          <Button variant={primary ? "ghost" : "outline"} onPress={skip.onPress} disabled={busy || skip.disabled} isLoading={skip.pending}>
            {skip.label}
          </Button>
        ) : null}
        {primary ? (
          <Button icon={ArrowRight} iconEnd onPress={primary.onPress} disabled={busy || primary.disabled} isLoading={primary.pending}>
            {primary.label}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/** One thing already set up: a card, a loan, a bill. */
export function SavedRow({
  icon,
  color,
  title,
  subtitle,
  trailing,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  const s = useStyles();
  return (
    <View style={s.saved}>
      <LedgerRow rule={false} lead={<Stamp color={color} icon={icon} size="sm" />} title={title} subtitle={subtitle} meta={trailing} />
    </View>
  );
}

export function CurrencySelect({
  value,
  onChange,
  currencies,
  compact = false,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  currencies: CurrencyRow[];
  /** Closed, shows only the code, for a narrow column. */
  compact?: boolean;
  label?: string;
}) {
  const options = currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
  return (
    <Select
      value={value}
      onValueChange={onChange}
      title={label}
      accessibilityLabel={label}
      options={compact ? options.map((o) => ({ ...o, label: o.value })) : options}
    />
  );
}

/** One of the person's accounts; the label carries the currency, since the account decides it. */
export function AccountSelect({
  value,
  onChange,
  accounts,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  accounts: { id: string; name: string; currency: string }[];
  label?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      title={label}
      accessibilityLabel={label}
      options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
    />
  );
}

/** A choice with a line of explanation under it (pay frequency). */
export function ChoiceCard({ on, title, hint, onPress }: { on: boolean; title: string; hint?: string; onPress: () => void }) {
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [s.choice, on ? s.choiceOn : null, pressed && !on ? s.choicePressed : null]}
    >
      <Text size="sm" weight={600}>
        {title}
      </Text>
      {hint ? (
        <Text size="xs" tone="muted">
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  saved: { borderRadius: 4, borderWidth: 1, borderColor: c.paperLine },
  choice: {
    flex: 1,
    minWidth: "45%",
    gap: 2,
    borderRadius: radius.sheet + 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceOn: { borderColor: c.primary, backgroundColor: c.brandMuted },
  choicePressed: { borderColor: c.foreground },
}));
