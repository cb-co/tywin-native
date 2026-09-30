import { defineConfig } from "vitest/config";

/* Runs against dist/, so `npm run build` must come first (see `verify`). */
export default defineConfig({ test: { include: ["tests/dist.test.ts"] } });
