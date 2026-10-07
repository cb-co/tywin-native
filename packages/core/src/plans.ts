/**
 * Free and Cigua Pro.
 *
 * The numbers live in the database (`public.plan_limits`), not here, so a limit
 * changes with an UPDATE rather than a release. This module only knows the
 * vocabulary: which plans and features exist, how to read the status the
 * database reports, and what follows from it (ads, an upgrade prompt).
 */

export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

/** Things a person may have a limited number of. */
export const LIMIT_FEATURES = ["accounts", "credit_cards", "loans", "goals", "subscriptions"] as const;
export type LimitFeature = (typeof LIMIT_FEATURES)[number];

/** AI features with a per-day or per-month quota. */
export const QUOTA_FEATURES = ["ask", "statement_parse", "recommendation", "card_art"] as const;
export type QuotaFeature = (typeof QUOTA_FEATURES)[number];

export type PlanFeature = LimitFeature | QuotaFeature;

export type FeatureStatus = {
  /** Null: unlimited. */
  limit: number | null;
  /** Null for a count of things; "day" or "month" for a quota. */
  period: "day" | "month" | null;
  used: number;
};

export type PlanStatus = {
  plan: Plan;
  /** When a Pro plan lapses back to Free; null for Free or a plan that does not lapse. */
  expiresAt: string | null;
  features: Partial<Record<PlanFeature, FeatureStatus>>;
};

export const FREE_STATUS: PlanStatus = { plan: "free", expiresAt: null, features: {} };

const isPlan = (v: unknown): v is Plan => (PLANS as readonly unknown[]).includes(v);

function featureStatus(v: unknown): FeatureStatus | null {
  if (!v || typeof v !== "object") return null;
  const { limit, period, used } = v as Record<string, unknown>;
  return {
    limit: typeof limit === "number" ? limit : null,
    period: period === "day" || period === "month" ? period : null,
    used: typeof used === "number" ? used : 0,
  };
}

/**
 * Reads `public.plan_status()`'s JSON. Anything unreadable is Free: the safe
 * reading for ads and limits alike, since the database enforces the real ones.
 */
export function parsePlanStatus(json: unknown): PlanStatus {
  if (!json || typeof json !== "object") return FREE_STATUS;
  const raw = json as Record<string, unknown>;
  const features: PlanStatus["features"] = {};
  if (raw.features && typeof raw.features === "object") {
    for (const [key, value] of Object.entries(raw.features as Record<string, unknown>)) {
      const status = featureStatus(value);
      if (status) features[key as PlanFeature] = status;
    }
  }
  return {
    plan: isPlan(raw.plan) ? raw.plan : "free",
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : null,
    features,
  };
}

/** Free accounts see ads; Pro never does. */
export function showsAds(plan: Plan): boolean {
  return plan === "free";
}

/** True when one more of `feature` would be refused. */
export function atLimit(status: PlanStatus, feature: PlanFeature): boolean {
  const f = status.features[feature];
  return !!f && f.limit !== null && f.used >= f.limit;
}

/** What is left of a feature, or null when unlimited or unknown. */
export function remaining(status: PlanStatus, feature: PlanFeature): number | null {
  const f = status.features[feature];
  if (!f || f.limit === null) return null;
  return Math.max(0, f.limit - f.used);
}

/** The database's refusal: SQLSTATE CGLIM, the feature in HINT, the limit in DETAIL. */
export const PLAN_LIMIT_SQLSTATE = "CGLIM";

export function isLimitFeature(v: unknown): v is LimitFeature {
  return (LIMIT_FEATURES as readonly unknown[]).includes(v);
}
