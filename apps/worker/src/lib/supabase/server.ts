import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@cigua/core/supabase/types";
import { currentRequest } from "#/context";
import { env } from "#/env";

export type Client = SupabaseClient<Database>;

/**
 * The Supabase client for this request, acting as the person who sent it.
 *
 * It carries the publishable key plus the caller's own access token, so row-level
 * security scopes every query to them exactly as it would from the phone. The API
 * holds no service-role key and can never read across users. It never stores or
 * refreshes the token; refreshing is the app's job.
 *
 * Built once per request and reused. `auth.getUser()` (a round trip to Supabase
 * Auth that verifies the token) is also answered once per request: a screen runs
 * several queries modules that each check the caller, and the answer cannot change
 * within one request.
 */
export async function createClient(): Promise<Client> {
  const ctx = currentRequest();
  if (ctx.supabase) return ctx.supabase;

  const client = createSupabaseClient<Database>(
    env("SUPABASE_URL")!,
    env("SUPABASE_PUBLISHABLE_KEY")!,
    {
      global: { headers: ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );

  const getUser = client.auth.getUser.bind(client.auth);
  let once: ReturnType<typeof getUser> | undefined;
  client.auth.getUser = ((jwt?: string) => {
    if (jwt) return getUser(jwt);
    once ??= getUser();
    return once;
  }) as typeof client.auth.getUser;

  ctx.supabase = client;
  return client;
}
