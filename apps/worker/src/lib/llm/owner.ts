import { env } from "#/env";

/**
 * Who gets the better model.
 *
 * Every LLM feature here runs on `gemini-3.5-flash-lite` because the key's
 * quota is shared by all of them and lite is what survives a day of real use
 * (see `GOOGLE_ASK_MODEL` in .env.example for the version of this that bit).
 * That trade-off is worth revisiting one account at a time rather than all at
 * once, so the account doing the revisiting — mine — runs on the current model
 * while everyone else stays on the one the quota supports.
 *
 * Identity is an env var, not a constant and not a column: a constant puts an
 * address in git and needs a deploy to change, and a column needs a migration
 * against the live database for a flag exactly one row will ever set.
 *
 * With OWNER_EMAIL unset — which is every environment that has not opted in —
 * `isOwner` is false for everyone and every call site keeps its existing model.
 */

/**
 * The model the owner's calls use.
 *
 * `gemini-3.7-flash`, GA since 2026-08-13, same tool support as 3.6. Overridable
 * without a deploy for the same reason `GOOGLE_ASK_MODEL` is: if this one starts
 * hitting quota on the /ask loop's seven-calls-a-question, the fix should be an
 * env change, not a release.
 */
export function ownerModel(): string {
  return env("OWNER_MODEL") ?? "gemini-3.7-flash";
}

/**
 * Case-insensitive because Supabase stores what the person typed at signup and
 * an env var is typed by hand months later; nothing else about the comparison
 * is forgiving, and it should not be — this decides which model a request gets,
 * so a near-match is a miss.
 */
export function isOwner(email: string | null | undefined): boolean {
  const owner = env("OWNER_EMAIL")?.trim();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner.toLowerCase();
}

/** The model for this request: the owner's, or whatever the caller already used. */
export function modelForUser(email: string | null | undefined, fallback: string): string {
  return isOwner(email) ? ownerModel() : fallback;
}
