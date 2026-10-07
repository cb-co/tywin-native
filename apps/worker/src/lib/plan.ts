import { parsePlanStatus, FREE_STATUS, type PlanStatus, type QuotaFeature } from "@cigua/core/plans";
import { createClient } from "#/lib/supabase/server";

/**
 * The caller's plan and where they stand against each limit. Never fails: a
 * status that cannot be read is Free, which shows ads and the lower limits. The
 * database enforces the real limits either way.
 */
export async function getPlanStatus(): Promise<PlanStatus> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("plan_status");
    if (error) {
      console.error("[plan] status failed:", error.code, error.message);
      return FREE_STATUS;
    }
    return parsePlanStatus(data);
  } catch {
    return FREE_STATUS;
  }
}

/**
 * Spends one use of an AI quota for the caller. True if the call may go ahead.
 *
 * Fails closed: if the quota cannot be checked, the model is not called. Each of
 * these is a paid call on the project's key, and an outage of the counter must
 * not become an unmetered window.
 *
 * Call it right before the model, after every cheap check, so a request that
 * was going to be refused anyway costs nothing.
 */
export async function takeQuota(feature: QuotaFeature): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("consume_quota", { p_feature: feature });
    if (error) {
      console.error("[plan] quota failed:", feature, error.code, error.message);
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}
