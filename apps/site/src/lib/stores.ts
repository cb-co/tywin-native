export type StoreId = "appStore" | "googlePlay";
export type Badge = { id: StoreId; href: string | null };

const ORDER: StoreId[] = ["appStore", "googlePlay"];

/** One badge per store; an empty URL is "Coming soon". A URL without https:// fails the build. */
export function storeBadges(config: Record<StoreId, string>): Badge[] {
  return ORDER.map((id) => {
    const url = config[id].trim();
    if (!url) return { id, href: null };
    if (!url.startsWith("https://")) throw new Error(`STORE.${id} must be a full https:// URL, got "${url}"`);
    return { id, href: url };
  });
}
