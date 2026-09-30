import type { APIRoute } from "astro";
import sharp from "sharp";
import { medallionSvg } from "@cigua/core/papel/medallion";

/* The home-screen icon: the app icon's layout, the mark on note violet (iOS
   rounds the corners and fills transparency black, so the tile is opaque). */
const SIZE = 180;
const MARK = 0.9;

export const GET: APIRoute = async () => {
  const side = SIZE * MARK;
  const at = (SIZE - side) / 2;
  const mark = medallionSvg({ plate: "#f8f5ff", disc: "#4a1f8c", ink: "#f8f5ff", size: "print", attrs: `x="${at}" y="${at}" width="${side}" height="${side}"` });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="#4a1f8c"/>${mark}</svg>`;
  const png = await sharp(Buffer.from(svg), { density: 288 }).resize(SIZE, SIZE).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
