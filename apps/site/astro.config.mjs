import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://cigua.quantcoresolutions.com",
  output: "static",
  // privacy.astro → privacy.html, served at /privacy (no trailing slash).
  build: { format: "file" },
  trailingSlash: "never",
});
