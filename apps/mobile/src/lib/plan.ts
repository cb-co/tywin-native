import { useCallback } from "react";
import { useTranslations } from "use-intl";
import { FREE_STATUS, type PlanStatus } from "@cigua/core/plans";
import { toast } from "~/components/ui/toast";
import { useScreen } from "./query";
import { useSession } from "./session";

/**
 * The signed-in person's plan and limits, from the session screen the root
 * navigator already loads (one cached query, no extra request).
 *
 * Until it arrives, and for a saved session screen from before plans existed,
 * this is Free. That only decides what the app shows; the database enforces
 * the real limits whatever the app believes.
 */
export function usePlan(): PlanStatus {
  const session = useSession();
  const { data } = useScreen("session", undefined, { enabled: session.status === "signedIn" });
  return (data as { plan?: PlanStatus } | undefined)?.plan ?? FREE_STATUS;
}

/**
 * What "upgrade" does. One place, so the purchase flow (App Store / Google Play
 * subscriptions, then a store webhook writing `entitlements`) replaces exactly
 * this when it exists. Until then it says Cigua Pro is coming.
 */
export function useUpgrade(): () => void {
  const t = useTranslations("Settings");
  return useCallback(() => toast.success(t("upgradeComingSoon")), [t]);
}
