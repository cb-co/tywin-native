import { useEffect, useRef } from "react";
import { act } from "~/lib/query";

/**
 * Resolves face colours for cards that predate card art, once, off the render
 * path. Inert whenever nothing is pending, which is every visit after the first.
 */
export function useCardArtBackfill(pending: number): void {
  const started = useRef(false);
  useEffect(() => {
    if (pending === 0 || started.current) return;
    started.current = true;
    // Fire and forget: the cards already wear the default colour, a finished state.
    act("accounts", "backfillCardArt").catch(() => {});
  }, [pending]);
}
