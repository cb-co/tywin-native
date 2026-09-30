import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST = join(import.meta.dirname, "..", "dist");
const SITE = "https://cigua.quantcoresolutions.com";

/** URL path → built file. /es may be es.html or es/index.html depending on Astro's output. */
function fileFor(path: string): string {
  const candidates = path === "/" ? ["index.html"] : [`${path.slice(1)}.html`, `${path.slice(1)}/index.html`];
  const hit = candidates.map((c) => join(DIST, c)).find(existsSync);
  if (!hit) throw new Error(`no built file for ${path} (tried ${candidates.join(", ")})`);
  return hit;
}

const PAGES = [
  { path: "/", lang: "en", en: "/", es: "/es" },
  { path: "/privacy", lang: "en", en: "/privacy", es: "/es/privacy" },
  { path: "/terms", lang: "en", en: "/terms", es: "/es/terms" },
  { path: "/es", lang: "es", en: "/", es: "/es" },
  { path: "/es/privacy", lang: "es", en: "/privacy", es: "/es/privacy" },
  { path: "/es/terms", lang: "es", en: "/terms", es: "/es/terms" },
] as const;

describe.each(PAGES)("$path", ({ path, lang, en, es }) => {
  const html = readFileSync(fileFor(path), "utf8");

  it("declares its language and both alternates", () => {
    expect(html).toContain(`<html lang="${lang}"`);
    expect(html).toContain(`hreflang="en" href="${new URL(en, SITE).href}"`);
    expect(html).toContain(`hreflang="es" href="${new URL(es, SITE).href}"`);
    expect(html).toContain(`rel="canonical" href="${new URL(path, SITE).href}"`);
  });

  it("links nowhere the web app used to be", () => {
    expect(html).not.toMatch(/href="\/(login|help|welcome)/);
  });

  it("prints no raw ICU placeholder", () => {
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
    expect(text).not.toMatch(/\{(n|total|date|email)\b/);
  });

  if (lang === "es") {
    it("keeps internal links in Spanish (except the language toggle)", () => {
      const internal = [...html.matchAll(/<a [^>]*href="(\/[^"#]*)"[^>]*>/g)]
        .filter((m) => !m[0].includes('hreflang="en"'))
        .map((m) => m[1]);
      for (const href of internal) expect(href.startsWith("/es")).toBe(true);
    });
  }
});

describe("landing page", () => {
  const html = readFileSync(fileFor("/"), "utf8");

  it("ships the specimen in its finished state", () => {
    expect(html).toContain("data-specimen");
    expect(html).not.toMatch(/data-specimen[^>]*data-play/);
  });

  it("has the store badge target", () => {
    expect(html).toContain('id="get-the-app"');
  });
});

describe("404", () => {
  it("exists and is not indexed", () => {
    const html = readFileSync(join(DIST, "404.html"), "utf8");
    expect(html).toContain('name="robots" content="noindex"');
  });
});
