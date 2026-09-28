import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import type { ScreenData } from "@cigua/worker/api";
import { STEPS, type Step } from "@cigua/core/onboarding/resume";
import { Perforation } from "~/components/papel/perforation";
import { useReduceMotion } from "~/components/papel/guilloche";
import { Text } from "~/components/ui/text";
import { makeStyles } from "~/theme/theme";
import { StepAbout } from "./step-about";
import { StepAccount } from "./step-account";
import { StepBills } from "./step-bills";
import { StepCards } from "./step-cards";
import { StepDone } from "./step-done";
import { StepIncome } from "./step-income";
import { StepLoans } from "./step-loans";
import type { StepProps } from "./types";

/** Counted steps; the closing summary is not one of them. */
const COUNTED = STEPS.length - 1;

const LABEL_KEY = {
  about: "stepAbout",
  account: "stepAccount",
  cards: "stepCards",
  income: "stepIncome",
  loans: "stepLoans",
  bills: "stepBills",
  done: "stepDone",
} as const;

/** Each step rises in once as it arrives. */
function Rise({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const p = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(p, { toValue: 1, duration: 380, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true }).start();
  }, [p, reduce]);
  return (
    <Animated.View style={{ opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * Onboarding that leaves the app configured: who you are, where your money is,
 * your cards and their statements, when you are paid, your loans and your fixed
 * bills. Every step writes through the API as it is passed and re-reads what
 * exists, so Back shows it rather than creating it again. Only the first two
 * steps are required.
 */
export function WelcomeFlow({ welcome }: { welcome: ScreenData<"welcome"> }) {
  const t = useTranslations("Welcome");
  const s = useStyles();
  const [step, setStep] = useState(welcome.initialStep);
  // Tracked here as well as saved, so later steps default to a just-picked currency.
  const [baseCurrency, setBaseCurrency] = useState(welcome.initialCurrency);

  const current = STEPS[step];
  const label = t(LABEL_KEY[current]);
  const goTo = (target: Step) => setStep(STEPS.indexOf(target));
  const props: StepProps = {
    data: welcome.data,
    currencies: welcome.currencies,
    baseCurrency,
    onNext: () => setStep((x) => Math.min(x + 1, STEPS.length - 1)),
    onBack: step > 0 ? () => setStep((x) => x - 1) : undefined,
  };

  return (
    <View style={{ width: "100%", maxWidth: 448, alignSelf: "center" }}>
      {/* Progress: a perforated strip that punches out as steps pass. */}
      <Perforation decorative total={COUNTED} paid={Math.min(step + 1, COUNTED)} label={label} />
      <Text size="xs" weight={500} tone="muted" style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
        {current === "done" ? (
          label
        ) : (
          <>
            <Text legend size="xs" figure style={{ fontSize: 12 }}>
              {step + 1} / {COUNTED}
            </Text>
            {` · ${label}`}
          </>
        )}
      </Text>

      <Rise key={step}>
        <View style={s.sheet}>
          {current === "about" ? (
            <StepAbout {...props} initialName={welcome.initialName || (welcome.email.split("@")[0] ?? "")} onCurrencyChange={setBaseCurrency} />
          ) : current === "account" ? (
            <StepAccount {...props} />
          ) : current === "cards" ? (
            <StepCards {...props} />
          ) : current === "income" ? (
            <StepIncome {...props} />
          ) : current === "loans" ? (
            <StepLoans {...props} />
          ) : current === "bills" ? (
            <StepBills {...props} />
          ) : (
            <StepDone {...props} goTo={goTo} />
          )}
        </View>
      </Rise>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { marginTop: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: c.paperLine, backgroundColor: c.card, padding: 20 },
}));
