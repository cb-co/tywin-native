import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "#/env";

/** The model every structured-output call uses unless OWNER_MODEL applies. */
export function defaultModelId(): string {
  return env("GOOGLE_MODEL") ?? "gemini-3.5-flash-lite";
}

/** A Gemini model, authenticated with the Worker's API key. */
export function gemini(modelId: string) {
  return createGoogleGenerativeAI({ apiKey: env("GOOGLE_GENERATIVE_AI_API_KEY") })(modelId);
}
