import type { APIRoute } from "astro";
import { medallionSvg } from "../lib/medallion";

/* The logo as the favicon. The ring is ink on a light tab bar and note ink on a
   dark one; the seal keeps its fixed note colours. */
export const GET: APIRoute = () =>
  new Response(
    medallionSvg({
      plate: "#1b1530",
      disc: "#4a1f8c",
      ink: "#f8f5ff",
      attrs: 'xmlns="http://www.w3.org/2000/svg" width="64" height="64"',
      style: "@media (prefers-color-scheme: dark) { .plate { stroke: #f8f5ff; } }",
    }),
    { headers: { "Content-Type": "image/svg+xml" } },
  );
