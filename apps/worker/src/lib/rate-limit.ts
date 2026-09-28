/**
 * A per-process sliding-window counter, one per budget.
 *
 * Best-effort by design. See lib/ask/rate-limit.ts for why this lives in memory
 * and not in a table. A Worker isolate serves many requests, so it
 * catches one person hammering one endpoint and undercounts across a fleet.
 * `now` is a parameter so windows can be tested without waiting.
 */
export function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  /** key -> timestamps of accepted requests inside the window. */
  const hits = new Map<string, number[]>();

  return {
    take(key: string, now: number): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }

      recent.push(now);
      hits.set(key, recent);

      /* Nothing else prunes this map, and an instance can outlive many sessions. */
      if (hits.size > 5_000) {
        for (const [k, times] of hits) {
          if (times.every((t) => t <= cutoff)) hits.delete(k);
        }
      }

      return true;
    },
    reset(): void {
      hits.clear();
    },
  };
}
