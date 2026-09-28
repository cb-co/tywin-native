import type { CurrencyRow, ScreenData } from "@cigua/worker/api";

/** What onboarding has already saved, read fresh after every step. */
export type WelcomeData = ScreenData<"welcome">["data"];

/** Props every step receives from the flow. */
export type StepProps = {
  data: WelcomeData;
  currencies: CurrencyRow[];
  baseCurrency: string;
  onNext: () => void;
  onBack?: () => void;
};

export const isMainAccount = (a: { type: string }) => a.type !== "credit_card" && a.type !== "loan";
