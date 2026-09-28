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

export default defineConfig({
  plugins: [markdownAsText],
  test: {
    globals: true,
  },
});
