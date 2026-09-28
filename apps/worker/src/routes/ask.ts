import { z } from "zod";
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { gemini } from "#/lib/llm/gemini";
import { env } from "#/env";
import { getLocale } from "#/i18n";
import { createClient } from "#/lib/supabase/server";
import { CHAT_INFERENCE_BUDGET_MS, inferenceSignal } from "#/lib/llm/budget";
import { modelForUser } from "#/lib/llm/owner";
import { systemPrompt, LANGUAGE } from "#/lib/ask/prompt";
import { collectAskContext } from "#/lib/ask/context";
import { askTools, CHAT_MAX_STEPS } from "#/lib/ask/tools";
import { takeAskToken } from "#/lib/ask/rate-limit";
import { MAX_MESSAGES, stillTooLarge, trimHistory } from "#/lib/ask/history";

/**
 * The model that answers.
 *
 * `gemini-3.5-flash-lite` by default: an interactive box can burn up to seven
 * calls a question, and a feature that stops answering by lunchtime is worse
 * than one that writes clumsier SQL. Expect that clumsiness to show up as wasted
 * queries rather than wrong answers — `calls_left` and the query budget in
 * lib/ask/tools.ts exist to absorb it. `GOOGLE_ASK_MODEL` overrides it without a
 * deploy, and the owner's questions run on `OWNER_MODEL` (lib/llm/owner.ts).
 */
function askModel(email: string | null | undefined) {
  return gemini(modelForUser(email, env("GOOGLE_ASK_MODEL") ?? "gemini-3.5-flash-lite"));
}

/**
 * What the app may send.
 *
 * Asserts the three fields a UIMessage must have for `convertToModelMessages` to
 * read it, and stays loose about everything else: that schema belongs to the SDK
 * and moves with it. Size is bounded by trimming the transcript, not by a
 * per-message cap — a replayed transcript with tool rows in it is legitimately
 * large. See lib/ask/history.ts.
 */
const BodySchema = z.object({
  messages: z
    .array(
      z.looseObject({
        id: z.string(),
        role: z.string(),
        parts: z.array(z.looseObject({ type: z.string() })),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});

/**
 * `POST /v1/ask`: one turn of the conversation, streamed as AI SDK UI messages.
 *
 * Status codes are the contract (the body is plain text): 401 signed out, 429 too
 * many questions, 400 malformed, 413 transcript too large even after trimming.
 */
export async function ask(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  if (!takeAskToken(user.id, Date.now())) {
    return new Response("Too many questions", { status: 429 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });

  const history = trimHistory(parsed.data.messages);
  if (stillTooLarge(history)) {
    return new Response("Question too large", { status: 413 });
  }

  /* Both reads together: the person waits on the later of the two, not the sum.
     `context` is the accounts, categories and date range the model would
     otherwise burn an inference turn discovering; it never fails the request. */
  const [{ data: profile }, context] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    collectAskContext(),
  ]);

  const locale = await getLocale();

  const result = streamText({
    model: askModel(user.email),
    system: systemPrompt({
      today: new Date().toISOString().slice(0, 10),
      baseCurrency: profile?.base_currency ?? "DOP",
      language: LANGUAGE[locale] ?? LANGUAGE.en,
      context,
    }),
    messages: await convertToModelMessages(history as unknown as UIMessage[]),
    tools: askTools(),
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    abortSignal: inferenceSignal(CHAT_INFERENCE_BUDGET_MS),
  });

  return result.toUIMessageStreamResponse({
    /* Without this the SDK replaces every failure with "An error occurred." and
       the app cannot tell a timeout from a broken key. An aborted stream is the
       budget expiring; nothing else is. The sentinels are not prose: the app
       owns the wording, in whichever language is being read. */
    onError: (error) => (isAbort(error) ? "ASK_TIMEOUT" : "ASK_ERROR"),
  });
}

/** An aborted call, however the SDK or the runtime chose to spell it. */
function isAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError";
}
