/**
 * Draws the app icon, the Android adaptive foreground and the launch splash
 * image from the brand geometry in @cigua/core, so they can be redrawn here
 * instead of in the retired web app (which rendered them with next/og).
 *
 *   node apps/mobile/scripts/brand-assets.mts
 *
 * The themed (monochrome) Android icon is not drawn here; it is kept as is.
 * sharp is not a dependency of this app: it comes in with the site workspace
 * (Astro), hoisted to the root node_modules.
 * Icons and splash only change with a new native build, not an OTA update.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { BIRD_BODY, BIRD_WING } from "@cigua/core/papel/bird";
import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const SIZE = 1024;

// `note` and `note-ink` in packages/core/design/tokens.json.
const DISC = "#4a1f8c";
const INK = "#f8f5ff";

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

/** The plate as the in-app splash drew it: layer alphas 0.9/0.55 under 40%.
 *  Lines are heavier than the canvas's 0.7px, because an icon is seen small. */
function plate(size: number): string {
  const s = size / 352;
  const paths = PLATE_LAYERS.map((d, i) => `<path d="${d}" opacity="${i === 0 ? 0.9 : 0.55}"/>`).join("");
  return `<g transform="translate(${SIZE / 2} ${SIZE / 2}) scale(${s})" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" opacity="0.4">${paths}</g>`;
}

/** The Seal without its engraved ring, which only smears at icon sizes. The
 *  disc is filled so the plate stops at its edge. */
function seal(size: number): string {
  const s = size / 64;
  const o = SIZE / 2 - size / 2;
  return `<g transform="translate(${o} ${o}) scale(${s})" fill="none" stroke="${INK}">
    <circle cx="32" cy="32" r="32" fill="${DISC}" stroke="none"/>
    <circle cx="32" cy="32" r="30.5" stroke-width="1.8"/>
    <circle cx="32" cy="32" r="22" stroke-width="1.4"/>
    <g transform="translate(-0.8 0.2)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="${BIRD_WING}"/><path d="${BIRD_BODY}"/>
    </g>
  </g>`;
}

function svg(body: string, background: boolean): string {
  const bg = background ? `<rect width="${SIZE}" height="${SIZE}" fill="${DISC}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${bg}${body}</svg>`;
}

/** Share of the tile each part takes. */
export const LAYOUT = {
  // iOS and the store listing: the OS rounds the corners itself.
  icon: { plate: 0.9, seal: 0.54 },
  // Android crops the adaptive foreground to its own shape and keeps about
  // the middle two thirds, so the whole mark stays inside that circle.
  foreground: { plate: 0.68, seal: 0.4 },
  // The launch image, shown `imageWidth` points wide (app.json) on the note
  // violet: the plate fills it and the seal takes half of it.
  splash: { plate: 0.98, seal: 0.5 },
} as const;

async function write(name: string, markup: string, alpha: boolean) {
  let img = sharp(Buffer.from(markup));
  if (!alpha) img = img.flatten({ background: DISC }).removeAlpha();
  writeFileSync(join(ASSETS, name), await img.png({ compressionLevel: 9 }).toBuffer());
  console.log(`wrote assets/${name}`);
}

const { icon, foreground, splash } = LAYOUT;
await write("icon.png", svg(plate(SIZE * icon.plate) + seal(SIZE * icon.seal), true), false);
await write("android-icon-foreground.png", svg(plate(SIZE * foreground.plate) + seal(SIZE * foreground.seal), true), true);
await write("splash-icon.png", svg(plate(SIZE * splash.plate) + seal(SIZE * splash.seal), false), true);
