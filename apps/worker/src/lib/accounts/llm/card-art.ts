import { z } from "zod";
import { generateObject } from "ai";
import { gemini, defaultModelId } from "#/lib/llm/gemini";
import { CARD_NETWORKS, type CardNetwork } from "@cigua/core/accounts/network";
import { normalizeHex6 } from "@cigua/core/color";
import { BLOCKING_INFERENCE_BUDGET_MS, inferenceSignal } from "#/lib/llm/budget";

/**
 * Card art inferred from the name a person gave their card.
 *
 * People name cards after the real product — "Amex Platinum", "Chase Sapphire
 * Reserve", "BHD León Visa Infinite". That name is enough for a model to
 * recognise the actual card and report what colour it is, which is the one
 * piece of card art we can get without asking anyone to upload anything.
 *
 * Same provider and call shape as the statement extractor
 * (`lib/statements/llm/extract.ts`): Gemini through the AI SDK with a
 * schema-constrained response, so the model cannot return a shape we then have
 * to defend against.
 */
export const CardArtSchema = z.object({
  accent: z
    .string()
    .describe(
      "The dominant colour of the physical card as a 6-digit hex, including the leading #, like #1B4B8F.",
    ),
  network: z
    .enum(CARD_NETWORKS)
    .nullable()
    .describe("The payment network, or null if the name does not make it certain."),
});

export type CardArt = { accent: string; network: CardNetwork | null };

const SYSTEM_PROMPT = `You identify consumer credit and debit cards from the name a person gave the card in their own finance app.

Return two things.

1. accent — the dominant colour of the PHYSICAL card, as a 6-digit hex INCLUDING the leading # (for example #1B4B8F, never 1B4B8F).
   - If you recognise the specific card product, use that card's real colour. An Amex Platinum is bright silver, an Amex Gold is warm gold, a Chase Sapphire Reserve is deep blue, a Visa Infinite black card is near-black.
   - Give the colour the card ACTUALLY is, at full strength. Premium cards are defined by their finish: a platinum card is a light metallic silver around #E5E4E2, and a black card is a true near-black around #101010. Do not lighten a black card toward grey or darken a silver one toward grey — grey is what both look like when hedged, and it is the one answer that makes them indistinguishable.
   - If you recognise only the issuing bank, use that bank's primary brand colour.
   - If you recognise neither, choose a plausible, sober card colour. Never invent a wildly bright or novelty colour for a card you do not recognise.
   - Prefer a saturated, confident colour over a muddy one. Only pure white (#FFFFFF) is out of range; everything else is fair, and the app measures its own text contrast against whatever you return.

2. network — the payment network, ONLY when the name makes it certain.
   - Return null if you are not sure. A wrong network mark on someone's card is worse than no mark at all.
   - The card's issuing bank is not the network. "BHD León" alone does not tell you the network; "BHD León Visa" does.
   - An Amex-branded card is always the amex network.

Judge only from the name. Do not ask questions, do not explain.`;

/**
 * Resolves art for one card name. Returns null on any failure — a missing
 * accent is a cosmetic gap that the default colour covers, so nothing here is
 * worth surfacing as an error or blocking a save for.
 *
 * Deliberately not retried and not cached: it runs once per card, only when the
 * card has no accent yet (see the callers in accounts/actions.ts). A card whose
 * name the model cannot place stays unresolved and simply gets the default,
 * rather than being written a wrong colour that nothing would ever revisit.
 *
 * A call that overruns BLOCKING_INFERENCE_BUDGET_MS aborts and is treated
 * exactly like a card the model could not place. This still runs INSIDE the
 * account save, so the budget is set to protect the save rather than to win the
 * answer — see lib/llm/budget for why no single number does both.
 */
export async function inferCardArt(name: string): Promise<CardArt | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  try {
    const { object } = await generateObject({
      model: gemini(defaultModelId()),
      schema: CardArtSchema,
      system: SYSTEM_PROMPT,
      prompt: trimmed,
      abortSignal: inferenceSignal(BLOCKING_INFERENCE_BUDGET_MS),
    });

    /* The schema constrains the shape, not the contents: `accent` is a string,
       and the model can still hand back "navy" or "#FFF". Normalised before it
       is judged, because the one thing it gets wrong most often is the leading
       `#` — see normalizeHex6. Anything that still would not survive the colour
       maths is dropped rather than stored. */
    const accent = normalizeHex6(object.accent);
    if (!accent) return null;

    return { accent, network: object.network };
  } catch {
    return null;
  }
}
