import { z } from "zod";
import { generateObject } from "ai";
import { gemini, defaultModelId } from "#/lib/llm/gemini";
import { normalizeHex6 } from "@cigua/core/color";
import { usableBrandColor } from "@cigua/core/subscriptions/brand-color";
import { brandIcon } from "#/lib/brand/simple-icon";
import { simpleIconUri } from "#/lib/brand/logo-uri";
import { DEFERRED_INFERENCE_BUDGET_MS, inferenceSignal } from "#/lib/llm/budget";

/**
 * Who a subscription is with, inferred from what the person called it.
 *
 * The sibling of `lib/accounts/llm/card-art.ts`, and for the same reason: people
 * name a subscription after the real service — "Netflix", "Spotify", "Adobe
 * Creative Cloud" — and that name is enough for a model to recognise the
 * company. It is the one piece of brand identity available without asking anyone
 * to upload anything.
 *
 * The model returns two things, in ONE call. That matters more than it looks.
 * Colour used to be the only answer here, and the obvious way to add a logo
 * would have been a second inference; but this call costs ~600ms warm and up to
 * 70 SECONDS cold, so a second one would double the worst case to buy a field
 * the first call can return for free. The slug rides along instead.
 *
 * Neither answer is trusted as given:
 *
 *   - `slug` is looked up in the real Simple Icons set and dropped if absent, so
 *     an invented slug costs a missing glyph rather than a broken image. That
 *     check is the whole reason it is safe to ask a model for an identifier.
 *   - `color` is normalised before it is judged (see normalizeHex6), and is
 *     OVERRIDDEN by the icon's official hex whenever the slug resolved — an
 *     exact value from the brand's own artwork beats a recalled one, except
 *     where it is too pale to render as a filled mark.
 *
 * Same provider and call shape as card art and the statement extractor: Gemini
 * through the AI SDK with a schema-constrained response.
 *
 * The PROMPT is where this differs from card art, and the difference is not
 * cosmetic. A card accent has to stay mid-to-dark because it becomes a whole
 * card face with text across it; a brand colour fills a 40px avatar, so Spotify
 * green and Netflix red are exactly right there and would be wrong on a card.
 * The only real constraint is that the mark must not vanish into the surface it
 * sits on.
 */
export const BrandSchema = z.object({
  color: z
    .string()
    .describe("The brand's primary colour as a 6-digit hex, including the leading #, like #E50914."),
  slug: z
    .string()
    .describe(
      "The service's Simple Icons slug, lowercase, or an empty string if you do not know it.",
    ),
});

const SYSTEM_PROMPT = `You identify subscription services from the name a person gave the subscription in their own finance app.

Return two things.

color — the brand's primary colour, as a 6-digit hex INCLUDING the leading # (for example #E50914, never E50914).
- If you recognise the service, use its real brand colour. Netflix is its red, Spotify its green, Disney+ its deep navy blue.
- If the brand's primary colour is white or near-white, use the colour of its logo mark or its main secondary colour instead. Never return a near-white value (nothing lighter than #E8E8E8) — the colour becomes a small filled avatar, and a white one reads as a rendering failure rather than a brand.
- A near-black brand colour is fine; plenty of brands really are black.
- If you recognise only the parent company, use the parent's colour.
- If you recognise nothing, choose one plausible, confident colour for a service of that kind. Prefer a saturated colour over a muddy one. Do not return grey as a way of hedging.

slug — the service's identifier in the Simple Icons project: lowercase, no spaces or punctuation. Netflix is netflix, Spotify is spotify, Adobe Creative Cloud is adobecreativecloud, Amazon Prime Video is primevideo, American Express is americanexpress.
- Give the slug for the SPECIFIC service where one exists, otherwise the parent brand's slug.
- Return an empty string if you do not recognise the service, or if you are not confident the project has a mark for it. Empty is the correct answer far more often than a guess: a wrong slug puts another company's logo on someone's subscription.
- Never invent a slug to avoid answering empty.

Judge only from the name. Do not ask questions, do not explain.`;

export type BrandIdentity = {
  /** A 6-digit hex, or null when nothing usable was resolved. */
  color: string | null;
  /** A `simple-icons:` URI for `subscriptions.logo_url`, or null. */
  logoUri: string | null;
};

const UNRESOLVED: BrandIdentity = { color: null, logoUri: null };

/**
 * Resolves the brand identity for one subscription name. Never throws, and
 * returns nulls on any failure — an unresolved brand is a cosmetic gap the
 * theme's neutral accent and the name's initial already cover, so nothing here
 * is worth surfacing as an error or blocking a save for.
 *
 * The two fields resolve INDEPENDENTLY. A recognised colour with no icon is the
 * common case for smaller services and still improves the card; an icon whose
 * official colour is unusable keeps its glyph and takes the model's colour
 * instead. Requiring both would throw away most of what this call gets right.
 *
 * Deliberately not retried and not cached: it runs once per subscription, only
 * when that subscription has nothing resolved yet (see the callers in
 * subscriptions/actions.ts). A name the model cannot place stays unresolved and
 * renders neutral, rather than being written a wrong answer nothing would ever
 * revisit.
 *
 * A call that overruns DEFERRED_INFERENCE_BUDGET_MS aborts and is treated
 * exactly like a name the model could not place. The budget is generous because
 * this does not run inside the save — resolveSubscriptionBrand calls it after
 * the save has returned, so a cold call costs a late mark, not a spinner.
 */
export async function inferBrand(name: string): Promise<BrandIdentity> {
  const trimmed = name.trim();
  if (!trimmed) return UNRESOLVED;

  try {
    const { object } = await generateObject({
      model: gemini(defaultModelId()),
      schema: BrandSchema,
      system: SYSTEM_PROMPT,
      prompt: trimmed,
      abortSignal: inferenceSignal(DEFERRED_INFERENCE_BUDGET_MS),
    });

    /* The schema constrains the shape, not the contents: `color` is a string,
       and the model can still hand back "red" or "#FFF". Normalised before it is
       judged, because the one thing it gets wrong most often is the leading `#`
       — see normalizeHex6. Anything that still would not survive the contrast
       maths is dropped rather than stored. */
    const modelColor = normalizeHex6(object.color);
    const icon = await brandIcon(object.slug);

    return {
      color: icon && usableBrandColor(icon.hex) ? icon.hex : modelColor,
      logoUri: icon ? simpleIconUri(icon.slug) : null,
    };
  } catch {
    return UNRESOLVED;
  }
}
