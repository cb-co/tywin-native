import type { Actions, ActionModule, ScreenData, ScreenName, StatementPreviewResult } from "@cigua/worker/api";
import { ENV } from "./env";
import { currentLocale } from "./i18n";
import { auth } from "./supabase";

/**
 * The API client: one typed function per kind of call, built from the API's own
 * signatures (`@cigua/worker/api`), so a renamed action or a changed screen shape
 * is a compile error here rather than a crash on a phone.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API ${status}: ${code}`);
  }
}

/** Sends the session's bearer token and the app's language. On a 401, refreshes once and retries. */
export async function authedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const {
    data: { session },
  } = await auth.getSession();
  if (!session) throw new ApiError(401, "unauthorized");

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${session.access_token}`);
  headers.set("accept-language", currentLocale());

  const res = await fetch(`${ENV.apiUrl}${path}`, { ...init, headers });
  if (res.status === 401 && retry) {
    const { error } = await auth.refreshSession();
    if (!error) return authedFetch(path, init, false);
    // The session is gone for good: signing out sends the app back to sign-in.
    await auth.signOut();
  }
  return res;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? "error");
  }
  return (await res.json()) as T;
}

type Params = Record<string, string | number | null | undefined>;

function query(params?: Params): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number] => e[1] !== undefined && e[1] !== null && e[1] !== "",
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
}

/** One screen's data, in one round trip. */
export async function loadScreen<K extends ScreenName>(
  name: K,
  params?: Params,
  signal?: AbortSignal,
): Promise<ScreenData<K>> {
  const res = await authedFetch(`/v1/screens/${name}${query(params)}`, { signal });
  return (await json<{ data: ScreenData<K> }>(res)).data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
export type ActionName<M extends ActionModule> = {
  [K in keyof Actions[M]]: Actions[M][K] extends AnyFn ? K : never;
}[keyof Actions[M]] &
  string;
type ActionFn<M extends ActionModule, F extends ActionName<M>> = Extract<Actions[M][F], AnyFn>;
export type ActionResult<M extends ActionModule, F extends ActionName<M>> = Awaited<ReturnType<ActionFn<M, F>>>;

/** Runs one server action as the signed-in person. */
export async function callAction<M extends ActionModule, F extends ActionName<M>>(
  module: M,
  fn: F,
  ...args: Parameters<ActionFn<M, F>>
): Promise<ActionResult<M, F>> {
  const res = await authedFetch(`/v1/actions/${module}/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  return (await json<{ data: ActionResult<M, F> }>(res)).data;
}

/** A picked PDF, as React Native's FormData takes a file. */
export type PickedFile = { uri: string; name: string; mimeType?: string | null };

/** The import dialog's parse step: the PDF and the account it belongs to. */
export async function parseStatement(input: {
  file: PickedFile;
  accountId: string;
  password?: string;
}): Promise<StatementPreviewResult> {
  const form = new FormData();
  form.append("file", {
    uri: input.file.uri,
    name: input.file.name,
    type: input.file.mimeType ?? "application/pdf",
  } as unknown as Blob);
  form.append("account_id", input.accountId);
  if (input.password) form.append("password", input.password);
  const res = await authedFetch("/v1/statements/parse", { method: "POST", body: form });
  return json<StatementPreviewResult>(res);
}

/** The import dialog's confirm step: the echoed preview plus the section mappings. */
export async function confirmStatement(fields: Record<string, string>): Promise<{
  error?: string;
  importId?: string;
  uncategorized?: number;
}> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await authedFetch("/v1/statements/confirm", { method: "POST", body: form });
  return json(res);
}

/** Regenerates today's take if it is stale. Fired and forgotten when Overview opens. */
export async function refreshRecommendation(): Promise<{ refreshed: boolean }> {
  return json(await authedFetch("/v1/recommendation", { method: "POST" }));
}
