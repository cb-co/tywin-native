/**
 * The signature `ask_query` checks before it runs a statement:
 * hex(HMAC-SHA256(secret, userId + "\n" + sql)).
 *
 * The database recomputes the same thing from `auth.uid()` and the Vault secret
 * (supabase/migrations/20261006120000_ask_query_signed.sql), so only statements
 * this Worker produced, for this caller, run. Sign only what guardSql returned:
 * signing is the Worker vouching for the statement.
 */
export async function signAskSql(secret: string, userId: string, sql: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${userId}\n${sql}`));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}
