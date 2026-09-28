/**
 * Colour maths for surfaces whose fill comes from user data.
 *
 * A stored account or category colour is an arbitrary hex — the user picked it,
 * and it may predate the palette brightening. Anything rendering text on top of
 * one has to measure rather than assume.
 */

const INK = "#14141c";
const PAPER = "#ffffff";

/**
 * A 6-digit hex — the only shape the maths below parses correctly.
 *
 * Lives here rather than beside any one feature because every caller that
 * stores an inferred colour has to validate it before the colour reaches
 * `channels()`: a 3-digit "#FFF" parses as rgb(0, 15, 255) instead of white,
 * silently measuring contrast against a colour nothing will ever render.
 */
export const HEX6 = /^#[0-9a-f]{6}$/i;

/**
 * A model's idea of "a 6-digit hex", turned into one this file can parse — or
 * null if it cannot be.
 *
 * The leading `#` is the whole reason this exists. Asked for "a 6-digit hex
 * like #D97706", Gemini returns `#D97706` for some names and a bare `D97706`
 * for others, and it is stable per name rather than random — so a card or
 * subscription whose name drew the bare form was rejected by HEX6 and had its
 * colour silently discarded on EVERY attempt, for good. That looked exactly
 * like a model that could not place the name, which is what made it hard to
 * see: the gate re-ran, got the same bare hex, and dropped it again.
 *
 * Tightening the prompt was not enough on its own. A prompt is a request, not a
 * guarantee, and a colour is far too small a thing to lose to one character —
 * so the value is normalised here and validated after, rather than being held
 * to a shape the model was merely asked for.
 *
 * Everything else still has to pass HEX6 unchanged. `navy` is not a colour this
 * can use, and `#FFF` is worse than useless: it parses as rgb(0, 15, 255)
 * rather than white, so it would render and measure as a colour nobody chose.
 */
export function normalizeHex6(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  const hashed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX6.test(hashed) ? hashed : null;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white or near-black reads better on `background`. */
export function readableForeground(background: string): typeof PAPER | typeof INK {
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background) ? PAPER : INK;
}

/* --- OKLCH -----------------------------------------------------------------
   The card gradient shifts lightness and hue, and doing that in sRGB gives
   muddy midtones and unpredictable steps — a fixed multiplier that looks right
   on orange looks wrong on blue. OKLCH is perceptually uniform, so one formula
   holds across every accent the LLM can return. */

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

type Oklch = { l: number; c: number; h: number };

export function toOklch(hex: string): Oklch {
  const [R, G, B] = channels(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: L,
    c: Math.hypot(a, b2),
    h: ((Math.atan2(b2, a) * 180) / Math.PI + 360) % 360,
  };
}

function oklchChannels({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S,
  ];
}

export function fromOklch(color: Oklch): string {
  // Walk chroma down until the colour fits sRGB. Clipping the channels instead
  // would shift the hue, which is the one thing the gradient must preserve.
  let { c } = color;
  while (c > 0.001 && !oklchChannels({ ...color, c }).every((v) => v >= -0.001 && v <= 1.001)) {
    c -= 0.002;
  }
  return `#${oklchChannels({ ...color, c })
    .map((v) => linearToSrgb(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * How the far corner differs from the accent. Fixed by design.
 *
 * The lift is 0.11, not the 0.15 it started at. That ceiling is set by
 * legibility, not taste: a bigger lift pushes mid-lightness accents — a mid
 * blue like Amex's #2557D6 is the worst case — into a band where NEITHER white
 * nor near-black clears 3:1 once the gloss is on top. Clamping accents out of
 * that band was tried and rejected; it turned a magenta card neon and a silver
 * one grey, destroying the real card colours this feature exists to reproduce.
 * Lower lift, honest colours.
 *
 * It is a CEILING rather than the value every accent gets — see `liftFor`, which
 * scales it down at the dark end.
 *
 * There is deliberately NO hue rotation. An earlier version rotated +15°, which
 * looks like the reference art on warm accents but turns every blue into violet
 * — and the default accent is a navy, so the most common card in the app came
 * out purple. The reference's hue shifts are per-card decisions a designer
 * made, not a formula, and no single rotation is safe across the wheel. Lifting
 * lightness and easing chroma gives the same lit, moulded read on every hue.
 */
const LIFT = 0.11;

/**
 * What the far corner does to the accent's chroma. Below 1: it eases off.
 *
 * Raising this above 1 was tried, on the reasoning that a lit region shows more
 * of a material's colour rather than less. It does make a navy or a gold read
 * richer across the face. It went back because the sheen it shipped alongside
 * was rejected, and re-tuning colour at the same time would have made it
 * impossible to say which change did what. Worth revisiting on its own: it only
 * moves accents that have chroma to move, so it cannot affect a black, a white
 * or a silver at any value.
 */
const SOFTEN = 0.92;

/**
 * How much of the lift an accent actually gets, scaled by its own lightness.
 *
 * A FLAT lift is the reason black cards did not look black. It is an absolute
 * step in perceptual lightness, so the darker the accent the larger it is in
 * relative terms: a stored #1A1A1A — a real Visa Infinite — has L 0.218, and
 * +0.11 took its far corner to #353535. Two thirds of the face was then mid
 * grey, the specular band lifted it to #515151, and the card read as charcoal.
 * The accent was right all along; the ramp was spending it.
 *
 * It is also what a lit surface actually does. Light landing on a black lacquer
 * card does not turn it grey — a dark surface reflects little of what hits it,
 * and almost all of what you see on a real black card is the narrow specular,
 * which is a separate layer here and untouched by this. Scaling the ramp by
 * lightness is the physical behaviour, not a special case for dark cards.
 *
 * The floor of 0.25 is what keeps a black card from going FLAT, which reads as
 * a hole in the page rather than as an object. From L 0.6 up the scale reaches
 * 1 and nothing changes: mid and pale accents keep the exact ramp they had, so
 * this reclaims the dark end without re-tuning colours that were already right.
 */
function liftFor(l: number): number {
  return LIFT * (0.25 + 0.75 * Math.min(1, l / 0.6));
}

/** The two stops of a card's gradient: the accent, and the lit far corner. */
export function cardGradientStops(hex: string): { near: string; far: string } {
  const accent = toOklch(hex);
  return {
    near: hex,
    far: fromOklch({
      l: Math.min(0.97, accent.l + liftFor(accent.l)),
      c: accent.c * SOFTEN,
      h: accent.h,
    }),
  };
}

/**
 * Which way the light layers push. On a pale accent a white sheen is invisible,
 * so the highlight becomes a shadow instead. Measured, never assumed.
 */
export function sheenChannel(hex: string): 0 | 255 {
  return relativeLuminance(hex) > 0.45 ? 0 : 255;
}

/**
 * The strongest the light layers can get where they overlap.
 *
 * The specular band peaks at 0.11 and the ambient glow at 0.035, and they can
 * cross near the top-left, compositing to 1 − (1−0.11)(1−0.035) ≈ 0.14. This
 * number is NOT free to drift: it is what `cardForeground` measures contrast
 * against, so a gradient brighter than it claims here would pass every test and
 * fail on screen. Kept in step with the alphas in `gradientFrom`, and guarded by
 * color.test — the bound is tight, so raising one without the other fails.
 *
 * It is no longer a legibility CEILING, which is what it was originally set as.
 * That ceiling was measured against a flat lift; `liftFor` scaling the lift by
 * lightness pulled every far corner down and handed the headroom back. Measured
 * across the guarded accents, 0.20 still clears 3.47:1 and even 0.25 clears
 * 3.14:1. So a brighter sheen is available if one is ever wanted — this sits at
 * 0.14 because that is how bright the CURRENT gradient is, not because it is as
 * bright as it may be.
 */
const SHEEN_PEAK = 0.14;

/** `base` with a flat white or black wash over it at `alpha`. */
function composite(base: string, channel: 0 | 255, alpha: number): string {
  const mixed = channels(base).map((c) => Math.round(c * (1 - alpha) + channel * alpha));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Whichever of white or near-black stays readable across a WHOLE card face.
 *
 * Not `readableForeground(accent)` — that was a real bug. The accent is only
 * the top-left corner, and the face lightens by a full lift toward the bottom
 * right, which is exactly where the holder name and number sit. A mid-tone
 * accent could pick white on the strength of its darkest corner and then put
 * white text on a much paler one. A silver Amex card did precisely that.
 *
 * Four surfaces are tested, not two: both ends of the ramp, and both ends again
 * under the brightest the specular and ambient layers can stack to. The gloss
 * is what makes the face look like an object, but it is also lightening the
 * very region the text sits on, so it has to be part of the contrast question
 * rather than something applied afterwards and hoped about.
 *
 * The winner is whichever has the better WORST case, so the answer holds
 * everywhere on the face rather than at one favourable corner.
 */
export function cardForeground(hex: string): typeof PAPER | typeof INK {
  const { near, far } = cardGradientStops(hex);
  const channel = sheenChannel(hex);
  const surfaces = [
    near,
    far,
    composite(near, channel, SHEEN_PEAK),
    composite(far, channel, SHEEN_PEAK),
  ];
  const worst = (fg: string) => Math.min(...surfaces.map((s) => contrastRatio(fg, s)));
  return worst(PAPER) >= worst(INK) ? PAPER : INK;
}

/** Every surface the face can present, for tests and contrast checks. */
export function cardSurfaces(hex: string): string[] {
  const { near, far } = cardGradientStops(hex);
  const channel = sheenChannel(hex);
  return [near, far, composite(near, channel, SHEEN_PEAK), composite(far, channel, SHEEN_PEAK)];
}

/**
 * The card-face background derived from a single accent, so one stored value
 * yields a complete card.
 *
 * The GEOMETRY is fixed and the accent is the only variable — every card in the
 * app is lit the same way, which is what makes a wall of them read as a set
 * rather than as unrelated rectangles.
 *
 * Three layers, listed top to bottom because that is CSS background order.
 *
 * 1. A SPECULAR BAND — a single soft diagonal streak of light across the face,
 *    and the layer that does most of the work of looking like laminated
 *    plastic. It is tilted off both axes (105°) because a band square to the
 *    card looks printed on rather than reflected.
 *
 *    A brighter, narrower TWIN streak was tried here — bright core, dip, second
 *    softer band — on the theory that a hard-edged reflection reads as a surface
 *    where a soft wide one reads as haze. It is a real effect and it made silver
 *    look like brushed metal, but on a card face at this size it read as an
 *    effect rather than as light, which is the failure mode this whole treatment
 *    exists to avoid. One soft band is the restrained answer and it is the one
 *    that survived looking at both on a phone.
 * 2. An AMBIENT GLOW at the top-left, the soft fill light around the specular.
 * 3. The BASE RAMP, accent to a lighter, slightly softer version of itself.
 *    Note it brightens toward the far corner rather than darkening: that is
 *    what gives the face a lit, moulded look instead of the flat vignette a
 *    darkening ramp produces.
 *
 * Both light layers are deliberately weak — they composite to SHEEN_PEAK at
 * most, and everything about how bright they may be is written on that
 * constant. They flip to shadow on a pale accent, where a white highlight would
 * be invisible. `cardForeground` accounts for both.
 */
export function gradientFrom(hex: string): string {
  const { far } = cardGradientStops(hex);
  const s = sheenChannel(hex) === 0 ? "0, 0, 0" : "255, 255, 255";
  return [
    `linear-gradient(105deg, transparent 26%, rgba(${s}, 0.03) 36%, rgba(${s}, 0.11) 44%, rgba(${s}, 0.08) 48%, rgba(${s}, 0.02) 56%, transparent 68%)`,
    `radial-gradient(115% 85% at 18% 0%, rgba(${s}, 0.035) 0%, rgba(${s}, 0.012) 42%, transparent 70%)`,
    `linear-gradient(135deg, ${hex} 0%, ${far} 100%)`,
  ].join(", ");
}
