/**
 * The app header's mark: the app icon at chrome size. A deep-violet tile
 * (`note-deep`) with rounded corners, the guilloche plate engraved in its
 * centre, and the note-violet seal on top. Both are fixed colours, the way a
 * note never goes dark, so it reads on paper and on the dark ground alike.
 * The site draws the same plate and seal without the tile
 * (apps/site/src/lib/medallion.ts).
 *
 * Shares of the tile's side, drawn in a 64 box.
 */
export const BRAND_TILE = {
  /** Corner radius. */
  radius: 0.24,
  /** Plate diameter. */
  plate: 0.94,
  /** Seal diameter. Large enough for the bird to read at 32px. */
  seal: 0.6,
  /** Only the plate's outer layer (ROSETTE_LAYERS[0]): all three merge into a
   *  flat lavender band at this size, one still reads as engraved line work. */
  plateLayers: 1,
  plateOpacity: 0.55,
  /** Plate line width in the 64 box. At 32px that is about a third of a pixel. */
  plateLine: 0.7,
} as const;
