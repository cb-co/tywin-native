/**
 * The Simple Icons set, addressable by slug.
 *
 * ~3,450 brand marks as single SVG paths on a 24×24 grid, optically balanced
 * against each other by the project — which is why callers can render any of
 * them at one size and trust the result. The package is CC0; the marks are still
 * their owners' trademarks, used here to identify a service someone told us they
 * pay for.
 *
 * The set is megabytes of path data, so it stays on the API: callers resolve a
 * slug here and send the app the one `path` it draws (lib/subscriptions/queries.ts).
 *
 * Imported dynamically and indexed on first lookup, so a cold isolate that never
 * shows a subscription logo never evaluates the set at all.
 */
export type BrandIcon = {
  slug: string;
  /** The `d` attribute of a single path on a 0 0 24 24 viewBox. */
  path: string;
  /** The brand's official colour as a 6-digit hex, with its leading `#`. */
  hex: string;
};

type RawIcon = { slug?: unknown; path?: unknown; hex?: unknown };

let index: Promise<Map<string, BrandIcon>> | null = null;

function bySlug(): Promise<Map<string, BrandIcon>> {
  index ??= import("simple-icons").then((icons) => build(icons));
  return index;
}

function build(icons: Record<string, unknown>): Map<string, BrandIcon> {
  const index = new Map<string, BrandIcon>();
  // Guarded rather than cast: the package's exports are all icons today, and a
  // future non-icon export should be skipped, not crash the accounts page.
  for (const raw of Object.values(icons) as RawIcon[]) {
    if (typeof raw?.slug !== "string" || typeof raw.path !== "string") continue;
    if (typeof raw.hex !== "string") continue;
    index.set(raw.slug, { slug: raw.slug, path: raw.path, hex: `#${raw.hex}` });
  }
  return index;
}

/**
 * Looks up one mark. Returns null for an unknown slug, which is the normal case
 * rather than an error: it is how a model's invented slug is rejected, and how a
 * service nobody has drawn a logo for falls back to its initial.
 */
export async function brandIcon(slug: string | null | undefined): Promise<BrandIcon | null> {
  const s = slug?.trim().toLowerCase();
  return s ? ((await bySlug()).get(s) ?? null) : null;
}

/** A synchronous lookup over the loaded set, for resolving many rows at once. */
export async function brandIcons(): Promise<(slug: string | null | undefined) => BrandIcon | null> {
  const map = await bySlug();
  return (slug) => {
    const s = slug?.trim().toLowerCase();
    return s ? (map.get(s) ?? null) : null;
  };
}
