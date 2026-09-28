/**
 * How a recommendation feels, which is the only thing about it the UI can
 * colour. The model chooses it alongside the text so the tile agrees with the
 * sentence, rather than being inferred from keywords in it.
 */
export const TONES = ["good", "watch", "neutral"] as const;
export type Tone = (typeof TONES)[number];

/**
 * Tokens that already exist in `app/globals.css` for both themes. Nothing new
 * is introduced here — `watch` borrows the same amber budgets already use for
 * "approaching", which is the same idea in a different place.
 */
const TONE_COLOR: Record<Tone, string> = {
  good: "var(--success)",
  watch: "var(--warning)",
  neutral: "var(--brand)",
};

export function asTone(value: string): Tone {
  return (TONES as readonly string[]).includes(value) ? (value as Tone) : "neutral";
}

export function toneColor(tone: string): string {
  return TONE_COLOR[asTone(tone)];
}
