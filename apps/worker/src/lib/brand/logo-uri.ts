/**
 * What goes in `subscriptions.logo_url`.
 *
 * The column has always been `text` and, until now, always empty — nothing read
 * it and nothing wrote it. Rather than fill it with a remote image URL, it holds
 * a URI naming a mark this app already ships:
 *
 *     simple-icons:netflix
 *
 * A real URI with a private scheme, not a slug in a field named for a URL. That
 * distinction is what keeps the column honest later: an `https://` value in the
 * same column would be an uploaded or user-supplied logo, and callers can tell
 * the two apart by scheme instead of by guessing at the shape of a string.
 *
 * Storing a reference rather than a URL is the whole privacy argument for this
 * feature. A logo CDN would mean the phone announcing every service a person
 * subscribes to, one request per card, to a third party who was never asked. The
 * artwork here is a path string in the bundle, so the page makes no request at
 * all and works offline, behind any CSP, and after the vendor whose logo it is
 * has redesigned their site.
 *
 * This module deliberately imports NOTHING. It is the half of the brand-icon
 * story that is safe in a client component; the lookup that turns a slug into
 * artwork lives in ./simple-icon, which is server-only and 26MB of dependency.
 */

export const SIMPLE_ICON_SCHEME = "simple-icons:";

/** Slugs are the project's own: lowercase alphanumerics, dots and dashes. */
const SLUG = /^[a-z0-9.\-+]+$/;

export function simpleIconUri(slug: string): string {
  return `${SIMPLE_ICON_SCHEME}${slug}`;
}

/**
 * The slug inside a `simple-icons:` URI, or null for anything else — an empty
 * column, an `https://` logo, or a value that does not parse. Callers treat all
 * of those the same way: no glyph, fall back to the initial.
 */
export function simpleIconSlug(uri: string | null | undefined): string | null {
  if (!uri || !uri.startsWith(SIMPLE_ICON_SCHEME)) return null;
  const slug = uri.slice(SIMPLE_ICON_SCHEME.length).trim().toLowerCase();
  return SLUG.test(slug) ? slug : null;
}
