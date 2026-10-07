import { getTranslations } from "#/i18n";
import { isLimitFeature, PLAN_LIMIT_SQLSTATE } from "@cigua/core/plans";

/** The shape Supabase/PostgREST returns for a database failure. */
type DbError = {
  code?: string | null;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

/* Postgres SQLSTATE codes worth translating into something a person can act
 * on. Everything else is a bug or a schema problem, and its message names
 * tables, columns and constraints, so it stays on the server. */
const FRIENDLY_BY_CODE: Record<string, string> = {
  "23505": "errorDuplicate", // unique_violation
  "23503": "errorReference", // foreign_key_violation
  "23502": "errorRequired", // not_null_violation
  "23514": "errorInvalidValue", // check_violation
  "22P02": "errorInvalidValue", // invalid_text_representation
  "22003": "errorInvalidValue", // numeric_value_out_of_range
};

/**
 * Turns a database error into a message that is safe to send to the app.
 *
 * Raw PostgREST messages read like `duplicate key value violates unique
 * constraint "banks_user_id_name_key"`, which hands an attacker the schema and
 * tells an ordinary user nothing. The error is logged server-side under `where`
 * (without its row values) so debugging does not get harder; only the generic
 * or mapped text crosses the wire.
 *
 * Supabase Auth errors are deliberately NOT routed through here. They are
 * written for end users, reveal nothing about the schema, and replacing
 * "Invalid login credentials" with a generic string would make sign-in
 * impossible to reason about.
 */
export async function dbError(error: DbError, where: string): Promise<string> {
  /* A plan limit is not a failure: it is the answer, and it says how to get
     more. The feature rides in HINT and the limit in DETAIL (see
     supabase/migrations/20261006120200_plans_and_quotas.sql). */
  if (error.code === PLAN_LIMIT_SQLSTATE && isLimitFeature(error.hint)) {
    const t = await getTranslations("Plan");
    const limit = Number(error.details) || 0;
    return t(`limit_${error.hint}`, { limit });
  }

  /* `details` is left out on purpose: Postgres puts row VALUES there
     ("Key (user_id, name)=(…, Banreservas Visa) already exists"), and a log is
     no place for someone's finances. Code, message and hint are enough to find
     the bug. */
  console.error(`[db:${where}]`, {
    code: error.code,
    message: error.message,
    hint: error.hint,
  });

  const t = await getTranslations("Common");
  const key = (error.code && FRIENDLY_BY_CODE[error.code]) || "errorGeneric";
  return t(key as "errorGeneric");
}
