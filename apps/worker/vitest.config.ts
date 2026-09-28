import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";

/** Mirrors wrangler's `Text` rule for `*.md`, so tests see the same string the Worker bundles. */
const markdownAsText: Plugin = {
  name: "markdown-as-text",
  load(id) {
    if (!id.endsWith(".md")) return null;
    return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
  },
};

/** Mirrors wrangler's `Data` rule for the bundled font files: their bytes, as an ArrayBuffer. */
const fontAsBytes: Plugin = {
  name: "font-as-bytes",
  load(id) {
    if (!/\.(pfb|ttf)$/.test(id)) return null;
    const b64 = readFileSync(id, "base64");
    return `export default Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0)).buffer;`;
  },
};

export default defineConfig({
  plugins: [markdownAsText, fontAsBytes],
  test: {
    globals: true,
  },
});
