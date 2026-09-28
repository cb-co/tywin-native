import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banknote, CreditCard, HandCoins, Landmark, Receipt, type LucideIcon } from "~/components/ui/icons";
import { useTranslations } from "use-intl";
import type { Step } from "@cigua/core/onboarding/resume";
import { semimonthlyStarts } from "@cigua/core/period/cycle";
import { act } from "~/lib/query";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { toast } from "~/components/ui/toast";
import { makeStyles, useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";
import { StepFooter, StepHeading } from "./parts";
import { isMainAccount, type StepProps } from "./types";

/**
 * What the flow set up, one row per step, each with a way back to change it.
 * Finishing stamps the profile; the app opens on its own once it is.
 */
export function StepDone({ data, onBack, goTo }: StepProps & { goTo: (step: Step) => void }) {
  const t = useTranslations("Welcome");
  const c = useColors();
  const s = useStyles();
  const [pending, setPending] = useState(false);
  const finishing = useRef(false);

  const cards = data.accounts.filter((a) => a.type === "credit_card");
  const cycleKey = { semimonthly: "doneCycleSemimonthly", monthly: "doneCycleMonthly", weekly: "doneCycleWeekly" } as const;
  const [first, second] = semimonthlyStarts(data.payAnchorDay);
  const cycle = t(cycleKey[data.payCycle as keyof typeof cycleKey] ?? "doneCycleMonthly", { first, second });

  const rows: { step: Step; icon: LucideIcon; title: string; subtitle?: string }[] = [
    { step: "account", icon: Landmark, title: t("doneAccounts", { count: data.accounts.filter(isMainAccount).length }) },
    {
      step: "cards",
      icon: CreditCard,
      title: t("doneCards", { count: cards.length }),
      subtitle: cards.length ? t("doneCardsImported", { count: cards.filter((x) => x.imported).length }) : undefined,
    },
    { step: "income", icon: Banknote, title: data.income?.name ?? t("doneIncomeNone"), subtitle: t("donePeriod", { cycle }) },
    { step: "loans", icon: HandCoins, title: t("doneLoans", { count: data.accounts.filter((a) => a.type === "loan").length }) },
    { step: "bills", icon: Receipt, title: t("doneBills", { count: data.bills.length }) },
  ];

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setPending(true);
    try {
      const done = await act("onboarding", "finishOnboarding");
      if (done.error) {
        finishing.current = false;
        toast.error(done.error);
        return;
      }
      toast.success(t("toastReady"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <View style={{ gap: 20 }}>
        <StepHeading title={t("doneTitle")} body={t("doneBody")} />
        <View style={s.list}>
          {rows.map(({ step, icon: Icon, title, subtitle }, i) => (
            <View key={step} style={[s.row, i < rows.length - 1 ? s.rule : null]}>
              <Icon size={16} color={c.mutedForeground} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" weight={500} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text size="xs" tone="muted">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Button size="sm" variant="ghost" onPress={() => goTo(step)}>
                {t("doneChange")}
              </Button>
            </View>
          ))}
        </View>
      </View>
      <StepFooter onBack={onBack} primary={{ label: t("finishButton"), onPress: () => void finish(), pending }} />
    </>
  );
}

const useStyles = makeStyles((c) => ({
  list: { borderRadius: radius.sheet + 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
}));
