/**
 * Live exchange rates, fetched once per base currency per 12 hours and shared by
 * every request in a data centre.
 *
 * Uses open.er-api.com (free, no API key, no rate limit) rather than frankfurter.dev —
 * frankfurter only covers the ~30 currencies in the ECB reference rates and is missing
 * DOP, which this app seeds by default.
 *
 * The conversions themselves live in @cigua/core/fx and are re-exported here, so
 * server code has one import for rates and arithmetic.
 */
export { convertToBase, baseRate, crossRate, unconvertedCurrencies } from "@cigua/core/fx";

const FX_ENDPOINT = "https://open.er-api.com/v6/latest";

/** How long a fetched rate table is reused. Rates move slowly enough that
 *  twice a day is plenty for balances and totals, and every caller shares the
 *  same entry, so this is the app's whole FX request budget. */
const TTL_SECONDS = 43200; // 12 hours

/** Isolate-local copy in front of the Cache API: a warm isolate skips the lookup. */
const memory = new Map<string, { rates: Record<string, number>; expires: number }>();

function cacheKey(base: string): string {
  return `https://fx.cigua.internal/v1/${encodeURIComponent(base)}`;
}

/**
 * Throws instead of returning {} on failure, and that is the point: whatever this
 * returns gets stored for the full TTL, so a cached {} would silently convert every
 * foreign amount at 1:1 for twelve hours. A rejection is never stored, so a failed
 * request is simply retried on the next call.
 */
async function fetchRates(base: string): Promise<Record<string, number>> {
  const res = await fetch(`${FX_ENDPOINT}/${base}`);
  if (!res.ok) throw new Error(`FX request failed: ${res.status}`);
  const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (data.result !== "success" || !data.rates) throw new Error("FX response malformed");
  // The API already echoes the base back at 1.0; asserting it makes that an
  // invariant callers (crossRate) can rely on instead of a happy accident.
  return { ...data.rates, [base]: 1 };
}

async function cachedRates(base: string): Promise<Record<string, number>> {
  const now = Date.now();
  const hit = memory.get(base);
  if (hit && hit.expires > now) return hit.rates;

  // Workers' shared cache for this data centre (absent in tests).
  const cache =
    typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  if (cache) {
    const stored = await cache.match(cacheKey(base));
    if (stored) {
      const rates = (await stored.json()) as Record<string, number>;
      const storedAt = Number(stored.headers.get("x-stored-at") ?? now);
      memory.set(base, { rates, expires: storedAt + TTL_SECONDS * 1000 });
      return rates;
    }
  }

  const rates = await fetchRates(base);
  memory.set(base, { rates, expires: now + TTL_SECONDS * 1000 });
  if (cache) {
    await cache.put(
      cacheKey(base),
      new Response(JSON.stringify(rates), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${TTL_SECONDS}`,
          "x-stored-at": String(now),
        },
      }),
    );
  }
  return rates;
}

/** Quote currency code -> units of that currency per 1 unit of `base`.
 *  Empty when the rate table is unavailable; every consumer treats a missing
 *  rate as 1:1 rather than dropping the amount. */
export async function getExchangeRates(base: string): Promise<Record<string, number>> {
  try {
    return await cachedRates(base);
  } catch {
    return {};
  }
}
