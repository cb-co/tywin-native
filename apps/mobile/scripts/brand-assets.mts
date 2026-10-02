/**
 * Draws the app icon, the Android adaptive foreground, the launch splash image
 * and the logo files in packages/core/design/logo from the brand geometry in
 * @cigua/core, so they can be redrawn here instead of in the retired web app
 * (which rendered them with next/og). The icon and the logo files are the mark
 * (@cigua/core/papel/medallion), the same drawing as the app header and the site.
 *
 *   node apps/mobile/scripts/brand-assets.mts
 *
 * The themed (monochrome) Android icon is not drawn here; it is kept as is.
 * sharp is not a dependency of this app: it comes in with the site workspace
 * (Astro), hoisted to the root node_modules.
 * Icons and splash only change with a new native build, not an OTA update.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// @cigua/core imports its own modules without extensions (bundler resolution);
// plain Node needs the `.ts`, so relative imports get it added on a miss.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".")) return next(`${specifier}.ts`, context);
      throw err;
    }
  },
});
const { MEDALLION, medallionSeal, medallionSvg } = await import("@cigua/core/papel/medallion");
const { ROSETTE_LAYERS, rosettePoints } = await import("@cigua/core/papel/rosette");

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "assets");
const LOGO = join(HERE, "..", "..", "..", "packages", "core", "design", "logo");
const SIZE = 1024;

// `note`, `note-ink` and light `foreground` in packages/core/design/tokens.json
// and apps/mobile/src/theme/tokens.ts.
const DISC = "#4a1f8c";
const INK = "#f8f5ff";
const PAPER_INK = "#1b1530";

/** The guilloche plate, one path per layer, in the canvas's own units
 *  (a 176 radius, so 352 across). */
const PLATE_LAYERS = ROSETTE_LAYERS.map((layer) => {
  const pts = rosettePoints(layer);
  let d = "";
  for (let i = 0; i < pts.length; i += 2) {
    d += `${i === 0 ? "M" : "L"}${pts[i].toFixed(2)} ${pts[i + 1].toFixed(2)}`;
  }
  return d;
});

/** The mark centred on the tile, sized so the seal takes `seal` of it. */
function mark(seal: number, ring = INK): string {
  const side = (SIZE * seal) / MEDALLION.seal;
  const at = (SIZE - side) / 2;
  return medallionSvg({ plate: ring, disc: DISC, ink: INK, size: "print", attrs: `x="${at}" y="${at}" width="${side}" height="${side}"` });
}

/** The splash's plate, as the in-app splash drew it: layer alphas 0.9/0.55 under 60%.
 *  Lines are heavier than the canvas's 0.7px, because an icon is seen small. */
function plate(size: number): string {
  const s = size / 352;
  const paths = PLATE_LAYERS.map((d, i) => `<path d="${d}" opacity="${i === 0 ? 0.9 : 0.55}"/>`).join("");
  return `<g transform="translate(${SIZE / 2} ${SIZE / 2}) scale(${s})" fill="none" stroke="${INK}" stroke-width="1" stroke-linejoin="round" opacity="0.6">${paths}</g>`;
}

/** The mark's seal (the same drawing as the logo), its disc filled so the
 *  plate stops at its edge. */
function seal(size: number): string {
  const o = SIZE / 2 - size / 2;
  return `<g transform="translate(${o} ${o}) scale(${size / 64})">${medallionSeal({ disc: DISC, ink: INK, size: "print" })}</g>`;
}

function svg(body: string, background: boolean): string {
  const bg = background ? `<rect width="${SIZE}" height="${SIZE}" fill="${DISC}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${bg}${body}</svg>`;
}

/** Share of the tile the seal takes; the ring follows at MEDALLION's ratio. */
export const LAYOUT = {
  // iOS and the store listing: the OS rounds the corners itself.
  icon: { seal: 0.54 },
  // Android crops the adaptive foreground to its own shape and keeps about
  // the middle two thirds, so the whole mark stays inside that circle.
  foreground: { seal: 0.4 },
  // The launch image, shown `imageWidth` points wide (app.json) on the note
  // violet: the full three-layer plate fills it and the seal takes 0.3 of it (90 of 300 points).
  splash: { plate: 0.98, seal: 0.3 },
} as const;

async function write(path: string, markup: string, alpha: boolean) {
  let img = sharp(Buffer.from(markup));
  if (!alpha) img = img.flatten({ background: DISC }).removeAlpha();
  writeFileSync(path, await img.png({ compressionLevel: 9 }).toBuffer());
  console.log(`wrote ${path}`);
}

const { icon, foreground, splash } = LAYOUT;
await write(join(ASSETS, "icon.png"), svg(mark(icon.seal), true), false);
await write(join(ASSETS, "android-icon-foreground.png"), svg(mark(foreground.seal), true), true);
await write(join(ASSETS, "splash-icon.png"), svg(plate(SIZE * splash.plate) + seal(SIZE * splash.seal), false), true);

// Logo files: the mark alone on a transparent ground, the ring in ink for light
// backgrounds and in note ink for dark or violet ones, as SVG and 1024px PNG.
// On dark the ring is a little stronger, so it reads as silver, not grey.
mkdirSync(LOGO, { recursive: true });
for (const [name, ring, plateOpacity] of [["cigua-logo", PAPER_INK, MEDALLION.plateOpacity], ["cigua-logo-on-dark", INK, 0.7]] as const) {
  const file = medallionSvg({ plate: ring, disc: DISC, ink: INK, size: "print", plateOpacity, attrs: `xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"` });
  writeFileSync(join(LOGO, `${name}.svg`), file + "\n");
  console.log(`wrote ${join(LOGO, `${name}.svg`)}`);
  await write(join(LOGO, `${name}.png`), file, true);
}
