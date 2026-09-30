import type { APIRoute } from "astro";
import sharp from "sharp";
import { medallionSvg } from "../lib/medallion";

/* PNG fallback for browsers without SVG favicons. It cannot follow the tab
   bar's theme, so the ring takes note-line, which reads on light and dark. */
export const GET: APIRoute = async () => {
  const svg = medallionSvg({
    plate: "#a488ec",
    disc: "#4a1f8c",
    ink: "#f8f5ff",
    attrs: 'xmlns="http://www.w3.org/2000/svg" width="64" height="64"',
  });
  const png = await sharp(Buffer.from(svg), { density: 288 }).resize(64, 64).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
