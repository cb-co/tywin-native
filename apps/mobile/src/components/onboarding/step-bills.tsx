import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, Plus, Receipt } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import { BILL_PRESETS, billFromPreset, type BillPresetKey } from "@cigua/core/onboarding/bills";
import { SWATCHES } from "@cigua/core/palette";
import { act } from "~/lib/query";
import { Field, FieldError, Input } from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { MoneyDisplay } from "~/components/money/money-display";
import { makeStyles, useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";
import { AccountSelect, SavedRow, StepFooter, StepHeading, refreshWelcome } from "./parts";
import { isMainAccount, type StepProps } from "./types";

type Row = { name: string; amount: string; day: string; accountId: string; error?: string };

/**
 * Fixed monthly bills as recurring expense templates, from presets so the common
 * ones are a tap and an amount. Loans are not here: they are accounts, a step back.
 */
export function StepBills({ data, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const c = useColors();
  const s = useStyles();
  const [pending, setPending] = useState(false);
  // Bills can be paid from a card as easily as from the bank.
  const payFrom = data.accounts.filter((a) => isMainAccount(a) || a.type === "credit_card");
  const defaultAccount = payFrom[0]?.id ?? "";
  const [rows, setRows] = useState<Partial<Record<BillPresetKey, Row>>>({});

  const presetName = (key: BillPresetKey) => t(`billsPresets.${key}`);
  const saved = new Set(data.bills.map((b) => b.name.trim().toLowerCase()));
  const isSaved = (key: BillPresetKey) => key !== "other" && saved.has(presetName(key).toLowerCase());

  function toggle(key: BillPresetKey) {
    setRows((r) => {
      const next = { ...r };
      if (next[key]) delete next[key];
      else next[key] = { name: key === "other" ? "" : presetName(key), amount: "", day: "", accountId: defaultAccount };
      return next;
    });
  }

  const update = (key: BillPresetKey, patch: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...r[key]!, ...patch, error: undefined } }));

  const selected = BILL_PRESETS.filter((p) => rows[p.key]).map((p) => p.key);
  const rowValid = (r: Row) => !!r.name.trim() && Number(r.amount) > 0 && (r.day === "" || (Number(r.day) >= 1 && Number(r.day) <= 31));
  const allValid = selected.every((k) => rowValid(rows[k]!));

  /* One by one: a failure stays open with its error and a success leaves the
     form, so a retry never creates a bill twice. */
  async function save() {
    if (!allValid || pending) return;
    setPending(true);
    try {
      let failed = false;
      for (const key of selected) {
        const r = rows[key]!;
        const currency = data.accounts.find((a) => a.id === r.accountId)?.currency ?? baseCurrency;
        const res = await act("recurring", "createSubscription", billFromPreset({ preset: key, ...r, currency }, data.categories));
        if (res.error) {
          failed = true;
          setRows((x) => ({ ...x, [key]: { ...x[key]!, error: res.error } }));
        } else {
          setRows((x) => {
            const next = { ...x };
            delete next[key];
            return next;
          });
        }
      }
      await refreshWelcome();
      if (failed) toast.error(t("billsSaveFailed"));
      else onNext();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("billsTitle")} body={t("billsBody")} />
        {data.bills.length ? (
          <View style={{ gap: 8 }}>
            {data.bills.map((b) => (
              <SavedRow key={b.id} icon={Receipt} color={SWATCHES[5]} title={b.name} trailing={<MoneyDisplay amount={b.amount} currency={b.currency} size="inline" />} />
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {BILL_PRESETS.map(({ key }) => {
            const done = isSaved(key);
            const on = !!rows[key];
            const ink = on ? c.primaryForeground : c.foreground;
            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on || done, disabled: done }}
                accessibilityHint={done ? t("billsSaved") : undefined}
                disabled={done}
                onPress={() => toggle(key)}
                style={[s.chip, on ? s.chipOn : null, done ? { opacity: 0.5 } : null]}
              >
                {on || done ? <Check size={14} color={ink} /> : <Plus size={14} color={ink} />}
                <Text size="sm" weight={500} color={ink}>
                  {presetName(key)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selected.map((key) => {
          const r = rows[key]!;
          const currency = data.accounts.find((a) => a.id === r.accountId)?.currency ?? baseCurrency;
          return (
            <View key={key} style={s.bill} accessibilityLabel={presetName(key)}>
              {key === "other" ? (
                <Field label={t("billNameLabel")}>
                  <Input maxLength={60} value={r.name} placeholder={t("billNamePlaceholder")} onChangeText={(v) => update(key, { name: v })} />
                </Field>
              ) : (
                <Text size="sm" weight={600}>
                  {r.name}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label={`${t("billAmountLabel")} (${currency})`}>
                    <Input value={r.amount} placeholder="0.00" keyboardType="decimal-pad" figure onChangeText={(v) => update(key, { amount: v })} />
                  </Field>
                </View>
                <View style={{ width: 80 }}>
                  <Field label={t("billDayLabel")}>
                    <Input value={r.day} keyboardType="number-pad" figure onChangeText={(v) => update(key, { day: v })} />
                  </Field>
                </View>
              </View>
              {payFrom.length > 1 ? (
                <Field label={t("billAccountLabel")}>
                  <AccountSelect value={r.accountId} onChange={(id) => update(key, { accountId: id })} accounts={payFrom} label={t("billAccountLabel")} />
                </Field>
              ) : null}
              <FieldError message={r.error} />
            </View>
          );
        })}
      </View>
      <StepFooter
        onBack={onBack}
        skip={selected.length || !data.bills.length ? { label: t("skipButton"), onPress: onNext } : undefined}
        primary={
          selected.length
            ? { label: t("billsSave"), onPress: () => void save(), disabled: !allValid, pending }
            : data.bills.length
              ? { label: t("continueButton"), onPress: onNext }
              : undefined
        }
      />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { borderColor: c.primary, backgroundColor: c.primary },
  bill: { gap: 12, borderRadius: radius.sheet + 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 16 },
}));
