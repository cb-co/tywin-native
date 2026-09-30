# Astro Public Site and Web-App Teardown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Cigua's landing, privacy and terms pages as a static Astro site in `apps/site`, serve it from a Cloudflare Worker at `cigua.quantcoresolutions.com`, then retire the Next.js repo `cb-co/tywin`.

**Architecture:** `apps/site` is a static Astro build (no adapter, no Worker code) deployed as Workers static assets with a custom domain. Copy comes from `@cigua/core/messages` (legal, shared with the app) plus a site-only `Marketing` namespace, rendered through `use-intl`'s `createTranslator`. The landing page is a component-by-component port of the web app's React markup and its CSS module; decoration renders at build time except two tiny scripts (the wave field canvas and the statement specimen replay).

**Tech Stack:** Astro 7, TypeScript ~6.0, use-intl 4.13, Vitest 5, Wrangler 4, `@fontsource-variable/archivo`, `lucide-static`, `simple-icons`.

**Spec:** `docs/superpowers/specs/2026-09-29-astro-site-and-web-teardown-design.md`

## Global Constraints

- Site lives at `apps/site`, package name `@cigua/site`, npm workspace of this repo.
- Astro `output: "static"`, no adapter. No framework islands (no React/Preact in the site).
- Worker name `cigua-site`; route `{ pattern: "cigua.quantcoresolutions.com", custom_domain: true }`; `workers_dev: true`; assets `./dist`, `not_found_handling: "404-page"`.
- Locales `en` (default, unprefixed) and `es` (prefixed `/es`). No language auto-detect or redirect.
- Canonical URLs have no trailing slash: `/`, `/privacy`, `/terms`, `/es`, `/es/privacy`, `/es/terms`. (The spec's table wrote `/es/`; with `build.format: "file"` the canonical form is `/es`, and `/es/` redirects to it.)
- Legal copy comes only from `@cigua/core/messages/{en,es}.json` (`Legal`, `Privacy`, `Terms`). Never copy it into the site.
- `LAST_UPDATED = "July 20, 2026"`, `CONTACT_EMAIL = "info.quantcoresolutions@gmail.com"` — unchanged from the web and the app.
- No page may link to `/login`, `/help`, or `/welcome`.
- Store URLs live in `apps/site/src/config.ts`; empty = "Coming soon" non-link badge. Badge art is our own text + a simple-icons glyph, not Apple/Google official badge artwork.
- No Tailwind in the site.
- Before starting any local server: check the port (`ss -ltnp | grep 8790`), start with `run_in_background`, stop it in the same turn, and **ask the user before starting it**.
- Never touch Vercel. The user deletes the Vercel project and sets the Supabase Auth Site URL.
- `gh repo archive cb-co/tywin` only after the user confirms at that moment.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- RTK rewrites git output: verify branch/merge/test claims with `git --no-pager …` or `rtk proxy …`.

## Review Focus

1. **Language continuity:** a visitor on `/es/privacy` who follows the Terms→Privacy link, the back link, the brand link or a footer link stays in Spanish. Pinned by Task 5's legal test (`href="/es/privacy"`) and Task 7's dist test (Spanish pages link only to `/es…` pages, except the language toggle and hreflang).
2. **Unfilled ICU placeholders:** plurals (`cuotaLeft`), `{date}`, `{n}`/`{total}` must never reach the HTML raw. Pinned by Task 2's plural test and Task 7's dist test (no `{n`, `{total`, `{date`, `{email` in any page).
3. **Trailing-slash and bare-directory URLs:** `/privacy/`, `/es/`, `/es/terms/` must land on the page (via redirect), not 404. Pinned by Task 9's post-deploy `curl -L` checks.
4. **A mistyped store URL** (no `https://`, e.g. `apps.apple.com/…`) must fail the build, not ship a relative link. Pinned by Task 2's `storeBadges` test.
5. **No JS / reduced motion:** the statement specimen and the rosettes must read as finished without scripts or animation. The static HTML carries the finished state; animation only runs under `prefers-reduced-motion: no-preference` (CSS) or after the script sets `data-play`. Pinned by Task 7's dist test (specimen has no `data-play` in built HTML).

---

## File map (`apps/site`)

```
apps/site/
  package.json            scripts + deps
  astro.config.mjs        static, site URL, format "file", trailingSlash "never"
  tsconfig.json           extends astro strict
  vitest.config.ts        unit tests (src/**/*.test.ts)
  vitest.dist.config.ts   build-output tests (tests/dist.test.ts)
  wrangler.jsonc          static-assets Worker + custom domain
  public/                 favicon.png, apple-touch-icon.png, og.png
  src/
    config.ts             STORE urls, SITE_URL
    i18n/en.json          { Marketing: {...} }
    i18n/es.json
    i18n/t.ts             translator(locale, namespace)
    i18n/paths.ts         pathFor(locale, page), otherLocale(locale)
    lib/stores.ts         storeBadges(config)
    lib/icon.ts           icon(svgString, strokeWidth?)
    lib/rosette-svg.ts    rosetteLayerPaths()
    legal/sections.ts     legalDoc(locale, doc) → { title, sections }
    styles/tokens.ts      tokensCss()
    styles/global.css     reset, font var, focus ring, --ease-press
    styles/papel.module.css   port of the web module (landing only) + badge styles
    styles/ornament.module.css
    scripts/guilloche-field.ts   wave-field canvas
    scripts/specimen.ts          specimen play/replay
    layouts/Base.astro
    layouts/LegalLayout.astro
    components/{Seal,Logo,Wordmark,Guilloche,Microprint,Serial,CardFace,
                StatementSpecimen,StoreBadges,LocaleToggle}.astro
    views/Home.astro, views/LegalPage.astro
    pages/index.astro, privacy.astro, terms.astro, 404.astro
    pages/es/index.astro, es/privacy.astro, es/terms.astro
  tests/dist.test.ts
```

---

### Task 1: Scaffold `apps/site` and the Worker config

**Files:**
- Create: `apps/site/package.json`, `apps/site/astro.config.mjs`, `apps/site/tsconfig.json`, `apps/site/vitest.config.ts`, `apps/site/vitest.dist.config.ts`, `apps/site/wrangler.jsonc`, `apps/site/src/config.ts`, `apps/site/src/pages/index.astro` (placeholder, replaced in Task 4)
- Modify: `package.json` (root scripts)

**Interfaces:**
- Produces: `SITE_URL: string`, `STORE: { appStore: string; googlePlay: string }` from `src/config.ts`.

- [ ] **Step 1: Write `apps/site/package.json`**

```json
{
  "name": "@cigua/site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev --port 4321",
    "build": "astro build",
    "check": "astro check",
    "test": "vitest run",
    "test:dist": "vitest run --config vitest.dist.config.ts",
    "verify": "astro check && vitest run && astro build && vitest run --config vitest.dist.config.ts",
    "preview": "wrangler dev --port 8790",
    "deploy": "npm run verify && wrangler deploy"
  },
  "dependencies": {
    "@cigua/core": "*",
    "@fontsource-variable/archivo": "^5.3.0",
    "astro": "^7.3.5",
    "lucide-static": "^1.49.0",
    "simple-icons": "^16.33.0",
    "use-intl": "4.13.2"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "typescript": "~6.0.3",
    "vitest": "^5.0.2",
    "wrangler": "^4.142.0"
  }
}
```

`use-intl` is pinned to the mobile app's exact version so both read the ICU messages identically.

- [ ] **Step 2: Write `apps/site/astro.config.mjs`**

```js
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://cigua.quantcoresolutions.com",
  output: "static",
  // privacy.astro → privacy.html, served at /privacy (no trailing slash).
  build: { format: "file" },
  trailingSlash: "never",
});
```

- [ ] **Step 3: Write `tsconfig.json`, the two vitest configs, and `src/config.ts`**

`apps/site/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "resolveJsonModule": true },
  "include": [".astro/types.d.ts", "src/**/*", "tests/**/*"],
  "exclude": ["dist"]
}
```

`apps/site/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

`apps/site/vitest.dist.config.ts`:
```ts
import { defineConfig } from "vitest/config";

/* Runs against dist/, so `npm run build` must come first (see `verify`). */
export default defineConfig({ test: { include: ["tests/dist.test.ts"] } });
```

`apps/site/src/config.ts`:
```ts
export const SITE_URL = "https://cigua.quantcoresolutions.com";

/**
 * Store listings. Empty until the app is published: the badge then renders as
 * a non-link "Coming soon". Must be full https:// URLs (the build fails otherwise).
 */
export const STORE = {
  appStore: "",
  googlePlay: "",
};
```

- [ ] **Step 4: Write `apps/site/wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  // The public site: static files only, no Worker code.
  "name": "cigua-site",
  "compatibility_date": "2026-09-29",
  // Explicit: omitting it turns workers.dev off on every deploy (found on palmonte-site).
  "workers_dev": true,
  // Cloudflare creates the DNS record and certificate on deploy; the
  // quantcoresolutions.com zone is on this account.
  "routes": [{ "pattern": "cigua.quantcoresolutions.com", "custom_domain": true }],
  "assets": {
    "directory": "./dist",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  }
}
```

- [ ] **Step 5: Placeholder page and root scripts**

`apps/site/src/pages/index.astro`:
```astro
<html lang="en"><body>cigua</body></html>
```

Root `package.json` → add to `scripts`:
```json
"dev:site": "npm run dev -w @cigua/site",
"build:site": "npm run build -w @cigua/site",
"deploy:site": "npm run deploy -w @cigua/site"
```

- [ ] **Step 6: Install and build**

Run: `cd ~/projects/tywin-native && npm install && npm run build:site && ls apps/site/dist`
Expected: `index.html` listed. If `npm install` reports peer conflicts with the root `overrides` (react 19.2.3), they don't affect the site (no React); resolve by `npm install --workspace @cigua/site` only if the full install fails.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json apps/site
git commit -m "feat(site): scaffold the Astro site and its static-assets Worker"
```

---

### Task 2: Copy, translator, paths, store badges

**Files:**
- Create: `apps/site/src/i18n/en.json`, `apps/site/src/i18n/es.json`, `apps/site/src/i18n/t.ts`, `apps/site/src/i18n/paths.ts`, `apps/site/src/lib/stores.ts`
- Test: `apps/site/src/i18n/t.test.ts`, `apps/site/src/i18n/paths.test.ts`, `apps/site/src/lib/stores.test.ts`

**Interfaces:**
- Consumes: `Locale`, `LOCALES`, `LOCALE_LABEL` from `@cigua/core/i18n/locale`; `STORE` from `src/config.ts`.
- Produces:
  - `translator(locale: Locale, namespace: "Marketing" | "Legal" | "Privacy" | "Terms")` → use-intl translator (`t(key, values?)`, `t.markup(key, values)`).
  - `MARKETING: Record<Locale, Record<string, string>>` (for parity tests).
  - `type Page = "home" | "privacy" | "terms"`; `pathFor(locale: Locale, page: Page): string`; `otherLocale(locale: Locale): Locale`.
  - `type StoreId = "appStore" | "googlePlay"`; `type Badge = { id: StoreId; href: string | null }`; `storeBadges(config: Record<StoreId, string>): Badge[]`.

- [ ] **Step 1: Create the Marketing messages**

Build both files from the web app's copy, then apply the edits below:

```bash
cd ~/projects/tywin-native/apps/site
mkdir -p src/i18n
for l in en es; do
  python3 - "$l" <<'EOF'
import json, sys
l = sys.argv[1]
src = json.load(open(f"/home/cm-corp/projects/tywin/messages/{l}.json"))["Marketing"]
for k in ("logIn", "getStarted", "haveAccount", "helpLink"):
    src.pop(k)
new = {
  "en": {"getApp": "Get the app", "downloadOn": "Download on the", "getItOn": "Get it on",
         "appStore": "App Store", "googlePlay": "Google Play", "comingSoon": "Coming soon",
         "footerNav": "Legal links", "metaTitle": "Cigua · Personal Finance",
         "metaDescription": "Cigua reads your bank statement, sorts every charge, tracks your cuotas, and tells you what's safe to spend until payday."},
  "es": {"getApp": "Descarga la app", "downloadOn": "Descárgala en", "getItOn": "Disponible en",
         "appStore": "App Store", "googlePlay": "Google Play", "comingSoon": "Muy pronto",
         "footerNav": "Enlaces legales", "metaTitle": "Cigua · Finanzas personales",
         "metaDescription": "Cigua lee tu estado de cuenta, ordena cada cargo, sigue tus cuotas y te dice cuánto puedes gastar hasta la quincena."},
}[l]
src.update(new)
json.dump({"Marketing": src}, open(f"src/i18n/{l}.json", "w"), ensure_ascii=False, indent=2)
open(f"src/i18n/{l}.json", "a").write("\n")
EOF
done
```

- [ ] **Step 2: Write the failing tests**

`apps/site/src/i18n/t.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MARKETING, translator } from "./t";

describe("Marketing copy", () => {
  it("has the same keys in en and es", () => {
    expect(Object.keys(MARKETING.es).sort()).toEqual(Object.keys(MARKETING.en).sort());
  });

  it("dropped every web-login string", () => {
    for (const k of ["logIn", "getStarted", "haveAccount", "helpLink"]) {
      expect(MARKETING.en).not.toHaveProperty(k);
    }
  });
});

describe("translator", () => {
  it("interpolates values", () => {
    expect(translator("en", "Marketing")("cuotaBadge", { n: 4, total: 12 })).toBe("Cuota 4 of 12");
  });

  it("applies ICU plurals", () => {
    const t = translator("en", "Marketing");
    expect(t("cuotaLeft", { n: 1 })).toBe("1 cuota left");
    expect(t("cuotaLeft", { n: 8 })).toBe("8 cuotas left");
  });

  it("reads the legal namespaces from @cigua/core", () => {
    expect(translator("es", "Legal")("updated", { date: "X" })).toBe("Última actualización: X");
  });

  it("renders rich tags through markup", () => {
    const html = translator("en", "Terms").markup("s6Body", { privacyLink: (c) => `<a href="/privacy">${c}</a>` });
    expect(html).toContain('<a href="/privacy">');
  });

  it("throws on a missing key instead of printing it", () => {
    expect(() => translator("en", "Marketing")("noSuchKey" as never)).toThrow();
  });
});
```

`apps/site/src/i18n/paths.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { otherLocale, pathFor } from "./paths";

describe("pathFor", () => {
  it.each([
    ["en", "home", "/"],
    ["en", "privacy", "/privacy"],
    ["en", "terms", "/terms"],
    ["es", "home", "/es"],
    ["es", "privacy", "/es/privacy"],
    ["es", "terms", "/es/terms"],
  ] as const)("%s %s → %s", (locale, page, path) => {
    expect(pathFor(locale, page)).toBe(path);
  });

  it("flips the locale", () => {
    expect(otherLocale("en")).toBe("es");
    expect(otherLocale("es")).toBe("en");
  });
});
```

`apps/site/src/lib/stores.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { storeBadges } from "./stores";

describe("storeBadges", () => {
  it("renders an empty URL as a non-link", () => {
    expect(storeBadges({ appStore: "", googlePlay: "  " })).toEqual([
      { id: "appStore", href: null },
      { id: "googlePlay", href: null },
    ]);
  });

  it("links a set URL", () => {
    const url = "https://play.google.com/store/apps/details?id=x";
    expect(storeBadges({ appStore: "", googlePlay: url })[1]).toEqual({ id: "googlePlay", href: url });
  });

  it("fails the build on a URL without https://", () => {
    expect(() => storeBadges({ appStore: "apps.apple.com/app/id1", googlePlay: "" })).toThrow(/appStore/);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd apps/site && npx vitest run`
Expected: FAIL — cannot resolve `./t`, `./paths`, `./stores`.

- [ ] **Step 4: Implement**

`apps/site/src/i18n/t.ts`:
```ts
import { createTranslator } from "use-intl/core";
import coreEn from "@cigua/core/messages/en.json";
import coreEs from "@cigua/core/messages/es.json";
import type { Locale } from "@cigua/core/i18n/locale";
import siteEn from "./en.json";
import siteEs from "./es.json";

export type Namespace = "Marketing" | "Legal" | "Privacy" | "Terms";

/* Legal copy is the app's own (packages/core), so the site and the app's
   legal screens can't drift. Marketing is the site's alone. */
const MESSAGES = {
  en: { Legal: coreEn.Legal, Privacy: coreEn.Privacy, Terms: coreEn.Terms, Marketing: siteEn.Marketing },
  es: { Legal: coreEs.Legal, Privacy: coreEs.Privacy, Terms: coreEs.Terms, Marketing: siteEs.Marketing },
} as const;

export const MARKETING: Record<Locale, Record<string, string>> = {
  en: siteEn.Marketing,
  es: siteEs.Marketing,
};

export function translator<N extends Namespace>(locale: Locale, namespace: N) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace,
    timeZone: "America/Santo_Domingo",
    // A missing key or a bad argument fails the build instead of printing the key.
    onError(error) {
      throw error;
    },
  });
}
```

If `use-intl/core` is not an export path in 4.13.2, import `createTranslator` from `"use-intl"` instead (it is re-exported there); check with `node -e "console.log(Object.keys(require('use-intl/package.json').exports))"`.

`apps/site/src/i18n/paths.ts`:
```ts
import type { Locale } from "@cigua/core/i18n/locale";

export type Page = "home" | "privacy" | "terms";

const SLUG: Record<Page, string> = { home: "", privacy: "privacy", terms: "terms" };

/** English is unprefixed; every other locale lives under /<locale>. No trailing slash. */
export function pathFor(locale: Locale, page: Page): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  const slug = SLUG[page];
  if (!slug) return prefix || "/";
  return `${prefix}/${slug}`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "es" : "en";
}
```

`apps/site/src/lib/stores.ts`:
```ts
export type StoreId = "appStore" | "googlePlay";
export type Badge = { id: StoreId; href: string | null };

const ORDER: StoreId[] = ["appStore", "googlePlay"];

/** One badge per store; an empty URL is "Coming soon". A URL without https:// fails the build. */
export function storeBadges(config: Record<StoreId, string>): Badge[] {
  return ORDER.map((id) => {
    const url = config[id].trim();
    if (!url) return { id, href: null };
    if (!url.startsWith("https://")) throw new Error(`STORE.${id} must be a full https:// URL, got "${url}"`);
    return { id, href: url };
  });
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd apps/site && npx vitest run`
Expected: PASS (all tests in the three files).

- [ ] **Step 6: Commit**

```bash
git add apps/site/src/i18n apps/site/src/lib/stores.ts apps/site/src/lib/stores.test.ts
git commit -m "feat(site): bilingual copy, locale paths and store-badge config"
```

---

### Task 3: Styles, tokens, font, base layout, static assets

**Files:**
- Create: `apps/site/src/styles/tokens.ts`, `apps/site/src/styles/global.css`, `apps/site/src/styles/papel.module.css`, `apps/site/src/styles/ornament.module.css`, `apps/site/src/layouts/Base.astro`, `apps/site/public/{favicon.png,apple-touch-icon.png,og.png}`
- Test: `apps/site/src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: `pathFor`, `Page` (Task 2); `@cigua/core/tokens.json`.
- Produces: `tokensCss(): string`; `Base.astro` props `{ locale: Locale; page: Page; title: string; description: string }` with a default `<slot />`.

- [ ] **Step 1: Write the failing test**

`apps/site/src/styles/tokens.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import tokens from "@cigua/core/tokens.json";
import { tokensCss } from "./tokens";

describe("tokensCss", () => {
  const css = tokensCss();

  it("declares every fixed and light token on :root", () => {
    for (const [k, v] of Object.entries({ ...tokens.fixed, ...tokens.light })) {
      expect(css).toContain(`--${k}: ${v};`);
    }
  });

  it("swaps the paper tokens under a dark colour scheme, never the note", () => {
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(dark).toContain(`--paper: ${tokens.dark.paper};`);
    expect(dark).not.toContain("--note:");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/site && npx vitest run src/styles`
Expected: FAIL — cannot resolve `./tokens`.

- [ ] **Step 3: Implement `tokens.ts`**

```ts
import tokens from "@cigua/core/tokens.json";

const decl = (group: Record<string, string>) =>
  Object.entries(group).map(([k, v]) => `--${k}: ${v};`).join(" ");

/** The Papel tokens as CSS custom properties. The note fields ("fixed") never invert. */
export function tokensCss(): string {
  return (
    `:root { color-scheme: light dark; ${decl(tokens.fixed)} ${decl(tokens.light)} }\n` +
    `@media (prefers-color-scheme: dark) { :root { ${decl(tokens.dark)} } }`
  );
}
```

- [ ] **Step 4: Run to see it pass**

Run: `cd apps/site && npx vitest run src/styles`
Expected: PASS.

- [ ] **Step 5: Port the CSS modules**

```bash
cd ~/projects/tywin-native/apps/site
mkdir -p src/styles
# Lines 1–1180: everything up to the "── Auth (/login)" section, which is dropped with the login page.
sed -n '1,1180p' ~/projects/tywin/components/marketing/papel/papel.module.css > src/styles/papel.module.css
cp ~/projects/tywin/components/papel/ornament.module.css src/styles/ornament.module.css
grep -n ':global(.dark)' src/styles/papel.module.css
```

Then edit `src/styles/papel.module.css` by hand:

1. Each `:global(.dark) X { … }` rule (3 of them after the cut: `.safeFigure`, `.columnsDemo i`, `.perf i[data-paid]`) becomes
   ```css
   @media (prefers-color-scheme: dark) {
     X { … }
   }
   ```
2. The locale toggle renders links, not buttons. Replace the selectors `.localeToggle button` → `.localeToggle a`, `.localeToggle button[aria-pressed="true"]` → `.localeToggle a[aria-current="page"]`, delete the `.localeToggle[aria-busy="true"]` rule, and add to the `.localeToggle a` block:
   ```css
     display: inline-flex;
     align-items: center;
     justify-content: center;
     text-decoration: none;
   ```
3. Append the new rules:
   ```css
   /* ── Footer seal size (was a Tailwind class on the web) ─────────── */
   .footerLogo {
     width: 1.5rem;
     height: 1.5rem;
   }

   /* ── Store badges ─────────────────────────────────────────────── */
   .stores {
     display: flex;
     flex-wrap: wrap;
     justify-content: center;
     gap: 0.8rem;
     margin: 0;
     padding: 0;
     list-style: none;
   }
   .store {
     display: inline-flex;
     align-items: center;
     gap: 0.7rem;
     min-height: 3.4rem;
     padding: 0.55rem 1.3rem 0.55rem 1rem;
     border-radius: 0.8rem;
     background: var(--note-ink);
     color: var(--note);
     text-decoration: none;
     transition: transform 220ms var(--ease-press);
   }
   a.store:hover {
     transform: translateY(-2px);
   }
   .store[aria-disabled="true"] {
     background: transparent;
     color: var(--note-ink);
     box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--note-line) 70%, transparent);
   }
   .storeMark {
     width: 1.6rem;
     height: 1.6rem;
     flex-shrink: 0;
   }
   .storeText {
     display: flex;
     flex-direction: column;
     align-items: flex-start;
     line-height: 1.1;
   }
   .storeLine {
     font-size: 0.7rem;
     font-weight: 600;
   }
   .storeName {
     font-stretch: 112%;
     font-weight: 800;
     font-size: 1.1rem;
   }
   .soon {
     font-style: normal;
     font-stretch: 125%;
     font-weight: 700;
     font-size: 0.62rem;
     letter-spacing: 0.14em;
     text-transform: uppercase;
     color: var(--peso-line);
   }
   ```

- [ ] **Step 6: Write `global.css`**

```css
/* The site-wide base the web app's globals.css provided. Tokens come from tokens.ts. */
:root {
  --font-archivo: "Archivo Variable";
  --ease-press: cubic-bezier(0.16, 1, 0.3, 1);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-family: var(--font-archivo), system-ui, sans-serif;
  font-weight: 400;
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
}

h1,
h2,
h3,
p,
figure,
dl,
dd,
ol,
ul {
  margin: 0;
}

:where(a, button, summary):focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

- [ ] **Step 7: Check the font package exposes the width axis**

Run: `ls ~/projects/tywin-native/node_modules/@fontsource-variable/archivo/*.css`
Expected: a `wdth.css` (or `full.css`) alongside `index.css`. Use `wdth.css` if present, else `full.css`, in the next step. The landing page depends on `font-stretch: 112%/125%`; `index.css` (weight axis only) is not enough.

- [ ] **Step 8: Write `layouts/Base.astro`**

```astro
---
import "@fontsource-variable/archivo/wdth.css";
import "../styles/global.css";
import type { Locale } from "@cigua/core/i18n/locale";
import { pathFor, type Page } from "../i18n/paths";
import { tokensCss } from "../styles/tokens";

interface Props {
  locale: Locale;
  page: Page;
  title: string;
  description: string;
}

const { locale, page, title, description } = Astro.props;
const abs = (path: string) => new URL(path, Astro.site).href;
---

<!doctype html>
<html lang={locale}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={abs(pathFor(locale, page))} />
    <link rel="alternate" hreflang="en" href={abs(pathFor("en", page))} />
    <link rel="alternate" hreflang="es" href={abs(pathFor("es", page))} />
    <link rel="alternate" hreflang="x-default" href={abs(pathFor("en", page))} />
    <meta name="theme-color" content="#4a1f8c" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Cigua" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={abs(pathFor(locale, page))} />
    <meta property="og:locale" content={locale === "es" ? "es_DO" : "en_US"} />
    <meta property="og:image" content={abs("/og.png")} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Cigua" />
    <meta name="twitter:card" content="summary_large_image" />
    <style is:inline set:html={tokensCss()} />
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 9: Static assets**

```bash
cd ~/projects/tywin-native/apps/site && mkdir -p public
cp ~/projects/tywin/app/icon-192.png public/favicon.png
cp ~/projects/tywin/app/icon-192.png public/apple-touch-icon.png
# Render the web app's share image once (next/og), then keep it as a static file.
cd ~/projects/tywin
cat > .og-render.mts <<'EOF'
import { writeFileSync } from "node:fs";
import { renderBrandOgImage } from "@/lib/og-image";
const res = renderBrandOgImage();
writeFileSync(process.argv[2], Buffer.from(await res.arrayBuffer()));
EOF
npx tsx .og-render.mts ~/projects/tywin-native/apps/site/public/og.png; rm .og-render.mts
file ~/projects/tywin-native/apps/site/public/og.png
```
Expected: `PNG image data, 1200 x 630`.

- [ ] **Step 10: Commit**

```bash
cd ~/projects/tywin-native
git add apps/site/src/styles apps/site/src/layouts apps/site/public
git commit -m "feat(site): Papel tokens, ported landing CSS, base layout and share image"
```

---

### Task 4: Brand and ornament components

**Files:**
- Create: `apps/site/src/lib/icon.ts`, `apps/site/src/lib/rosette-svg.ts`, `apps/site/src/scripts/guilloche-field.ts`, `apps/site/src/components/{Seal,Logo,Wordmark,Guilloche,Microprint,Serial,CardFace}.astro`
- Test: `apps/site/src/lib/icon.test.ts`, `apps/site/src/lib/rosette-svg.test.ts`

**Interfaces:**
- Consumes: `@cigua/core/papel/rosette` (`ROSETTE_LAYERS`, `rosettePoints`, `rosettePath`), `@cigua/core/papel/bird` (`BIRD_BODY`, `BIRD_FEATHER`, `BIRD_WING`), `@cigua/core/papel/wordmark` (`WORDMARK_VIEWBOX`, `WORDMARK_PARTS`, `WORDMARK_STROKE`), `@cigua/core/color` (`gradientFrom`, `cardForeground`), `@cigua/core/accounts/card-art` (`DEFAULT_CARD_ACCENT`, `HEX6`), `ornament.module.css`.
- Produces:
  - `icon(svg: string, strokeWidth?: number): string` — a lucide-static SVG string with `aria-hidden="true"`, no `class`, optional stroke width.
  - `rosetteLayerPaths(): string[]` — one SVG path per rosette layer, centred on (0,0), within ±176.
  - Components (every one accepts `class` and spreads `...rest` onto its root, so a parent's scoped styles reach it):
    - `<Seal class? rosette? />`, `<Logo class? />`, `<Wordmark class? />`
    - `<Guilloche variant?="rosette"|"field" class? lineWidth?=0.7 duration?=1800 />`
    - `<Microprint text class? />`, `<Serial value class? />`
    - `<CardFace name last4 network: "visa"|"mastercard"|"amex" accent class? />`

- [ ] **Step 1: Add the icon package, write the failing tests**

Run: `cd ~/projects/tywin-native && npm ls lucide-static simple-icons -w @cigua/site` (installed in Task 1).

`apps/site/src/lib/icon.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Check } from "lucide-static";
import { icon } from "./icon";

describe("icon", () => {
  it("hides the glyph from assistive tech and drops lucide's class", () => {
    const svg = icon(Check);
    expect(svg).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(svg).not.toMatch(/<svg[^>]*class=/);
  });

  it("sets the stroke width", () => {
    expect(icon(Check, 3)).toContain('stroke-width="3"');
  });
});
```

`apps/site/src/lib/rosette-svg.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ROSETTE_LAYERS } from "@cigua/core/papel/rosette";
import { ROSETTE_EXTENT, rosetteLayerPaths } from "./rosette-svg";

describe("rosetteLayerPaths", () => {
  const paths = rosetteLayerPaths();

  it("draws one path per lathe layer", () => {
    expect(paths).toHaveLength(ROSETTE_LAYERS.length);
    for (const d of paths) expect(d.startsWith("M")).toBe(true);
  });

  it("stays inside the viewBox the canvas used (±176)", () => {
    for (const d of paths) {
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      expect(Math.max(...nums.map(Math.abs))).toBeLessThanOrEqual(ROSETTE_EXTENT);
    }
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `cd apps/site && npx vitest run src/lib`
Expected: FAIL — cannot resolve `./icon`, `./rosette-svg`.

- [ ] **Step 3: Implement the helpers**

`apps/site/src/lib/icon.ts`:
```ts
/** A lucide-static SVG string, decorative: hidden from assistive tech, lucide's class dropped. */
export function icon(svg: string, strokeWidth?: number): string {
  let out = svg.replace(/<svg([^>]*)>/, (_, attrs: string) => {
    const kept = attrs.replace(/\s+class="[^"]*"/, "");
    return `<svg${kept} aria-hidden="true" focusable="false">`;
  });
  if (strokeWidth !== undefined) out = out.replace(/stroke-width="[^"]*"/, `stroke-width="${strokeWidth}"`);
  return out;
}
```

`apps/site/src/lib/rosette-svg.ts`:
```ts
import { ROSETTE_LAYERS, rosettePoints } from "@cigua/core/papel/rosette";

/** The web canvas scaled the plate as min(w, h) / 2 / 176, so 176 is the half-width. */
export const ROSETTE_EXTENT = 176;

/** Each lathe layer as its own path, so layers keep their own opacity and cut speed. */
export function rosetteLayerPaths(): string[] {
  return ROSETTE_LAYERS.map((layer) => {
    const pts = rosettePoints(layer);
    let d = "";
    for (let i = 0; i < pts.length; i += 2) {
      d += `${i === 0 ? "M" : "L"}${pts[i].toFixed(1)} ${pts[i + 1].toFixed(1)}`;
    }
    return d;
  });
}
```

- [ ] **Step 4: Run to see them pass**

Run: `cd apps/site && npx vitest run src/lib`
Expected: PASS.

- [ ] **Step 5: Write `Seal.astro`, `Logo.astro`, `Wordmark.astro`**

`src/components/Seal.astro`:
```astro
---
import { BIRD_BODY, BIRD_FEATHER, BIRD_WING } from "@cigua/core/papel/bird";
import { rosettePath } from "@cigua/core/papel/rosette";

interface Props {
  class?: string;
  /** The engraved ring; its hairlines only resolve from about 80px up. */
  rosette?: boolean;
  [attr: string]: unknown;
}
const { class: className, rosette = false, ...rest } = Astro.props;
const RING = rosettePath(64);
---

<span class:list={["seal", className]} aria-hidden="true" {...rest}>
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor">
    {rosette && <path d={RING} stroke-width="0.35" opacity="0.55" />}
    <circle cx="32" cy="32" r="30.5" stroke-width="1.8" />
    <circle cx="32" cy="32" r="22" stroke-width="1.4" />
    <g transform="translate(-0.8 0.2)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d={BIRD_WING} />
      {rosette && <path d={BIRD_FEATHER} stroke-width="1" />}
      <path d={BIRD_BODY} />
    </g>
  </svg>
</span>

<style>
  .seal {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--note);
    color: var(--note-ink);
    user-select: none;
  }
  svg {
    width: 100%;
    height: 100%;
  }
</style>
```

`src/components/Logo.astro`:
```astro
---
import Seal from "./Seal.astro";

interface Props {
  class?: string;
}
const { class: className } = Astro.props;
---

<Seal rosette class={className} />
```

`src/components/Wordmark.astro`:
```astro
---
import { WORDMARK_PARTS, WORDMARK_STROKE, WORDMARK_VIEWBOX } from "@cigua/core/papel/wordmark";

interface Props {
  class?: string;
  [attr: string]: unknown;
}
const { class: className, ...rest } = Astro.props;
---

<svg role="img" aria-label="Cigua" viewBox={WORDMARK_VIEWBOX} class:list={["wordmark", className]} {...rest}>
  <g fill="none" stroke="currentColor" stroke-width={WORDMARK_STROKE} stroke-linecap="round" stroke-linejoin="round">
    {
      WORDMARK_PARTS.map((p) =>
        p.kind === "path" ? (
          <path d={p.d} transform={`translate(${p.x} 0)`} />
        ) : p.fill ? (
          <circle cx={p.cx} cy={p.cy} r={p.r} transform={`translate(${p.x} 0)`} fill="currentColor" stroke="none" />
        ) : (
          <circle cx={p.cx} cy={p.cy} r={p.r} transform={`translate(${p.x} 0)`} />
        ),
      )
    }
  </g>
</svg>

<style>
  .wordmark {
    display: inline-block;
    height: 1.1em;
    width: auto;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 6: Write `Guilloche.astro` and the field script**

`src/components/Guilloche.astro`:
```astro
---
import { ROSETTE_EXTENT, rosetteLayerPaths } from "../lib/rosette-svg";

interface Props {
  variant?: "rosette" | "field";
  class?: string;
  lineWidth?: number;
  duration?: number;
  [attr: string]: unknown;
}
const { variant = "rosette", class: className, lineWidth = 0.7, duration = 1800, ...rest } = Astro.props;
const paths = variant === "rosette" ? rosetteLayerPaths() : [];
const box = `${-ROSETTE_EXTENT} ${-ROSETTE_EXTENT} ${ROSETTE_EXTENT * 2} ${ROSETTE_EXTENT * 2}`;
---

{
  variant === "rosette" ? (
    <svg class:list={["guilloche", className]} viewBox={box} aria-hidden="true" style={`--dur: ${duration}ms`} {...rest}>
      <g class="lathe">
        {paths.map((d, i) => (
          <path d={d} pathLength="1" style={`--li: ${i}; opacity: ${i === 0 ? 0.9 : 0.55}; stroke-width: ${lineWidth}px`} />
        ))}
      </g>
    </svg>
  ) : (
    <canvas class={className} aria-hidden="true" data-guilloche-field data-line-width={lineWidth} data-duration={duration} {...rest} />
  )
}

<script>
  import "../scripts/guilloche-field";
</script>

<style>
  /* Engraved line work: a stack of hypotrochoids, the curve a geometric lathe cuts
     into a banknote plate. Stroke is currentColor, so callers tint it with color. */
  .guilloche path {
    fill: none;
    stroke: currentColor;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  /* The plate "cuts" itself once on load: a slow quarter-turn of the lathe while each
     layer draws in, later layers a little faster. Finished by default (no JS, reduced motion). */
  @media (prefers-reduced-motion: no-preference) {
    .guilloche .lathe {
      animation: lathe var(--dur) cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .guilloche path {
      stroke-dasharray: 1;
      animation: cut calc(var(--dur) / (1 + var(--li) * 0.15)) cubic-bezier(0.16, 1, 0.3, 1) both;
    }
  }
  @keyframes lathe {
    from {
      transform: rotate(-20deg);
    }
    to {
      transform: none;
    }
  }
  @keyframes cut {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
</style>
```

`src/scripts/guilloche-field.ts` — the web component's `field` branch, unchanged in behaviour:
```ts
/* Interfering waves: two sine terms per line, phase-shifted per line, so
   neighbouring lines weave through each other like a note's field. Its
   geometry depends on the element's size, so it is drawn at runtime. */
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

function mount(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const lineWidth = Number(canvas.dataset.lineWidth ?? 0.7);
  const duration = Number(canvas.dataset.duration ?? 1800);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let progress = reduce ? 1 : 0;
  let start = 0;

  function draw(p: number) {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    const lines = Math.max(18, Math.round(h / 9));
    const gap = h / lines;
    const reach = w * p;
    for (let j = 0; j <= lines; j++) {
      const y0 = j * gap;
      const ph = j * 0.42;
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(j * 0.7);
      ctx.beginPath();
      for (let x = 0; x <= reach; x += 4) {
        const y = y0 + gap * 1.6 * Math.sin(x / 58 + ph) + gap * 0.9 * Math.sin(x / 23 - ph * 1.7);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function tick(now: number) {
    if (!start) start = now;
    progress = easeOutExpo((now - start) / duration);
    draw(progress);
    if (progress < 1) requestAnimationFrame(tick);
  }

  if (reduce) draw(1);
  else requestAnimationFrame(tick);
  new ResizeObserver(() => draw(progress)).observe(canvas);
}

document.querySelectorAll<HTMLCanvasElement>("canvas[data-guilloche-field]").forEach(mount);
```

- [ ] **Step 7: Write `Microprint.astro`, `Serial.astro`, `CardFace.astro`**

`src/components/Microprint.astro`:
```astro
---
import s from "../styles/ornament.module.css";

interface Props {
  text: string;
  class?: string;
}
const { text, class: className } = Astro.props;
const run = text.repeat(12);
---

<div aria-hidden="true" class:list={[s.microprint, className]}>
  <span class={s.mpTop}>{run}</span>
  <span class={s.mpBottom}>{run}</span>
  <span class={s.mpLeft}>{run}</span>
  <span class={s.mpRight}>{run}</span>
</div>
```

`src/components/Serial.astro`:
```astro
---
import s from "../styles/ornament.module.css";

interface Props {
  value: string;
  class?: string;
}
const { value, class: className } = Astro.props;
---

<span aria-hidden="true" class:list={[s.serial, className]}>{value}</span>
```

`src/components/CardFace.astro` (the landing page only uses the wordmark variant, so the drawn network logo isn't ported):
```astro
---
import { cardForeground, gradientFrom } from "@cigua/core/color";
import { DEFAULT_CARD_ACCENT, HEX6 } from "@cigua/core/accounts/card-art";
import Guilloche from "./Guilloche.astro";

const NETWORK_WORDMARK = { visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX" } as const;

interface Props {
  name: string;
  last4: string;
  network: keyof typeof NETWORK_WORDMARK;
  accent: string;
  class?: string;
  [attr: string]: unknown;
}
const { name, last4, network, accent, class: className, ...rest } = Astro.props;
const base = HEX6.test(accent) ? accent : DEFAULT_CARD_ACCENT;
const fg = cardForeground(base);
---

<div class:list={["card", className]} style={`background-image: ${gradientFrom(base)}; color: ${fg}`} {...rest}>
  <Guilloche lineWidth={0.5} class="plate" />
  <span class="name">{name}</span>
  <span class="number">•••• {last4}</span>
  <span class="network">{NETWORK_WORDMARK[network]}</span>
</div>

<style>
  .card {
    position: relative;
    isolation: isolate;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    aspect-ratio: 1.7;
    width: 100%;
    max-width: 25rem;
    overflow: hidden;
    border-radius: 18px;
    padding: 1.3rem 1.4rem;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.25),
      0 26px 50px -24px rgb(20 10 40 / 0.7);
  }
  .plate {
    pointer-events: none;
    position: absolute;
    right: -95%;
    top: -75%;
    z-index: -10;
    aspect-ratio: 1;
    width: 150%;
    opacity: 0.35;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1.1rem;
    font-weight: 800;
    font-stretch: 112%;
  }
  .number {
    font-variant-numeric: tabular-nums lining-nums;
    font-weight: 600;
    letter-spacing: 0.14em;
  }
  .network {
    position: absolute;
    bottom: 1.2rem;
    right: 1.4rem;
    font-size: 0.95rem;
    font-weight: 900;
    font-style: italic;
    letter-spacing: 0.04em;
    font-stretch: 125%;
  }
</style>
```

- [ ] **Step 8: Type-check**

Run: `cd apps/site && npx astro check`
Expected: 0 errors. If `@cigua/core/color` or `…/card-art` pull in modules with React-only types, import only the named functions (they are pure) and add `"skipLibCheck": true` is already in astro's strict config; fix any genuine error before moving on.

- [ ] **Step 9: Commit**

```bash
git add apps/site/src/lib apps/site/src/scripts apps/site/src/components
git commit -m "feat(site): seal, wordmark, guilloche, microprint and card face as Astro components"
```

---

### Task 5: Legal pages

**Files:**
- Create: `apps/site/src/legal/sections.ts`, `apps/site/src/layouts/LegalLayout.astro`, `apps/site/src/views/LegalPage.astro`, `apps/site/src/pages/privacy.astro`, `apps/site/src/pages/terms.astro`, `apps/site/src/pages/es/privacy.astro`, `apps/site/src/pages/es/terms.astro`
- Test: `apps/site/src/legal/sections.test.ts`

**Interfaces:**
- Consumes: `translator`, `pathFor`, `Base.astro`, `Logo.astro`, `Wordmark.astro`, `icon`.
- Produces: `type LegalDoc = "privacy" | "terms"`; `type Section = { title: string; paragraphs: string[] }` (paragraphs are HTML, rendered with `set:html`); `legalDoc(locale: Locale, doc: LegalDoc): { title: string; sections: Section[] }`; `LAST_UPDATED`, `CONTACT_EMAIL`; `<LegalPage locale doc />`.

- [ ] **Step 1: Write the failing test**

`apps/site/src/legal/sections.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, legalDoc } from "./sections";

describe("legalDoc", () => {
  it("has the web and app's section counts", () => {
    expect(legalDoc("en", "terms").sections).toHaveLength(9);
    expect(legalDoc("en", "privacy").sections).toHaveLength(8);
    expect(legalDoc("en", "privacy").sections[0].paragraphs).toHaveLength(2);
  });

  it("links Terms → Privacy inside the reader's language", () => {
    expect(legalDoc("es", "terms").sections[5].paragraphs[0]).toContain('href="/es/privacy"');
    expect(legalDoc("en", "terms").sections[5].paragraphs[0]).toContain('href="/privacy"');
  });

  it("links the contact email", () => {
    expect(legalDoc("en", "terms").sections[8].paragraphs[0]).toContain(`href="mailto:${CONTACT_EMAIL}"`);
    expect(legalDoc("es", "privacy").sections[7].paragraphs[0]).toContain(`href="mailto:${CONTACT_EMAIL}"`);
  });

  it("leaves no ICU placeholder unfilled", () => {
    for (const locale of ["en", "es"] as const) {
      for (const doc of ["terms", "privacy"] as const) {
        for (const s of legalDoc(locale, doc).sections) {
          for (const p of s.paragraphs) expect(p).not.toMatch(/\{\w+/);
        }
      }
    }
  });

  it("escapes plain paragraphs", () => {
    for (const s of legalDoc("en", "privacy").sections.slice(1, 7)) {
      expect(s.paragraphs[0]).not.toMatch(/<(?!\/?a[\s>])/);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd apps/site && npx vitest run src/legal`
Expected: FAIL — cannot resolve `./sections`.

- [ ] **Step 3: Implement `sections.ts`** (mirrors `apps/mobile/src/app/legal/[doc].tsx`)

```ts
import type { Locale } from "@cigua/core/i18n/locale";
import { pathFor } from "../i18n/paths";
import { translator } from "../i18n/t";

export const LAST_UPDATED = "July 20, 2026";
export const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

export type LegalDoc = "privacy" | "terms";
/** Paragraphs are HTML (some carry a link), rendered with set:html. */
export type Section = { title: string; paragraphs: string[] };

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);
const mailto = (chunks: string) => `<a href="mailto:${CONTACT_EMAIL}">${chunks}</a>`;

export function legalDoc(locale: Locale, doc: LegalDoc): { title: string; sections: Section[] } {
  if (doc === "terms") {
    const t = translator(locale, "Terms");
    const k = t as unknown as (key: string) => string;
    const sections = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({
      title: esc(k(`s${i}Title`)),
      paragraphs: [
        i === 6
          ? t.markup("s6Body", { privacyLink: (c) => `<a href="${pathFor(locale, "privacy")}">${c}</a>` })
          : i === 9
            ? t.markup("s9Body", { email: CONTACT_EMAIL, link: mailto })
            : esc(k(`s${i}Body`)),
      ],
    }));
    return { title: t("title"), sections };
  }

  const t = translator(locale, "Privacy");
  const k = t as unknown as (key: string) => string;
  const sections: Section[] = [
    { title: esc(t("s1Title")), paragraphs: [esc(t("s1Body1")), esc(t("s1Body2"))] },
    ...[2, 3, 4, 5, 6, 7].map((i) => ({ title: esc(k(`s${i}Title`)), paragraphs: [esc(k(`s${i}Body`))] })),
    { title: esc(t("s8Title")), paragraphs: [t.markup("s8Body", { email: CONTACT_EMAIL, link: mailto })] },
  ];
  return { title: t("title"), sections };
}
```

(`title` fields are escaped because the view renders them with `set:html` alongside paragraphs; the page `<h1>` uses the raw `title` through normal `{}` escaping.)

- [ ] **Step 4: Run to see it pass**

Run: `cd apps/site && npx vitest run src/legal`
Expected: PASS.

- [ ] **Step 5: Write `LegalLayout.astro`, `LegalPage.astro`, and the four pages**

`src/layouts/LegalLayout.astro` (replaces `components/legal/legal-page.tsx`; its Tailwind becomes scoped CSS):
```astro
---
import { ArrowLeft } from "lucide-static";
import type { Locale } from "@cigua/core/i18n/locale";
import Base from "./Base.astro";
import Logo from "../components/Logo.astro";
import Wordmark from "../components/Wordmark.astro";
import { pathFor, type Page } from "../i18n/paths";
import { translator } from "../i18n/t";
import { icon } from "../lib/icon";

interface Props {
  locale: Locale;
  page: Page;
  title: string;
  updated: string;
}
const { locale, page, title, updated } = Astro.props;
const t = translator(locale, "Legal");
const home = pathFor(locale, "home");
---

<Base locale={locale} page={page} title={`${title} · Cigua`} description={title}>
  <main class="legal">
    <header class="bar">
      <a href={home} class="brand"><Logo /><Wordmark class="word" /></a>
    </header>
    <div class="sheet">
      <a href={home} class="back"><Fragment set:html={icon(ArrowLeft)} />{t("back")}</a>
      <h1>{title}</h1>
      <p class="updated">{t("updated", { date: updated })}</p>
      <div class="body"><slot /></div>
    </div>
  </main>
</Base>

<style>
  .legal {
    display: flex;
    min-height: 100dvh;
    flex-direction: column;
    background: var(--paper);
  }
  .bar {
    display: flex;
    height: 4rem;
    flex-shrink: 0;
    align-items: center;
    padding: 0 1.5rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: var(--ink);
    text-decoration: none;
  }
  .word {
    font-size: 1rem;
  }
  .sheet {
    width: 100%;
    max-width: 70ch;
    flex: 1;
    margin: 0 auto;
    padding: 1rem 1.5rem 4rem;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 2rem;
    font-size: 0.875rem;
    color: var(--ink-soft);
    text-decoration: none;
  }
  .back:hover {
    color: var(--ink);
  }
  .back :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  h1 {
    border-bottom: 2px solid var(--rule);
    padding-bottom: 0.5rem;
    font-size: 1.125rem;
    color: var(--ink);
    font-stretch: 125%;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .updated {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--ink-soft);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 2rem;
    font-size: 0.95rem;
    line-height: 1.625;
    color: var(--ink-soft);
  }
  .body :global(h2) {
    margin-bottom: 0.5rem;
    font-size: 11px;
    color: var(--ink);
    font-stretch: 125%;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }
  .body :global(p + p) {
    margin-top: 0.75rem;
  }
  .body :global(a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
```

`src/views/LegalPage.astro`:
```astro
---
import type { Locale } from "@cigua/core/i18n/locale";
import LegalLayout from "../layouts/LegalLayout.astro";
import { LAST_UPDATED, legalDoc, type LegalDoc } from "../legal/sections";

interface Props {
  locale: Locale;
  doc: LegalDoc;
}
const { locale, doc } = Astro.props;
const { title, sections } = legalDoc(locale, doc);
---

<LegalLayout locale={locale} page={doc} title={title} updated={LAST_UPDATED}>
  {
    sections.map((s) => (
      <section>
        <h2 set:html={s.title} />
        {s.paragraphs.map((p) => (
          <p set:html={p} />
        ))}
      </section>
    ))
  }
</LegalLayout>
```

The four pages (each one line of frontmatter + one element):

`src/pages/privacy.astro`:
```astro
---
import LegalPage from "../views/LegalPage.astro";
---

<LegalPage locale="en" doc="privacy" />
```
`src/pages/terms.astro`: same with `doc="terms"`.
`src/pages/es/privacy.astro`:
```astro
---
import LegalPage from "../../views/LegalPage.astro";
---

<LegalPage locale="es" doc="privacy" />
```
`src/pages/es/terms.astro`: same with `doc="terms"`.

- [ ] **Step 6: Build and look at the output**

Run: `cd apps/site && npx astro build && ls dist dist/es && grep -o '<h2>[^<]*' dist/es/terms.html | head -3`
Expected: `privacy.html terms.html` in `dist`, the same in `dist/es`, Spanish section titles printed.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src/legal apps/site/src/layouts/LegalLayout.astro apps/site/src/views/LegalPage.astro apps/site/src/pages
git commit -m "feat(site): privacy and terms in both languages, copy shared with the app"
```

---

### Task 6: The landing page

**Files:**
- Create: `apps/site/src/components/{StatementSpecimen,StoreBadges,LocaleToggle}.astro`, `apps/site/src/scripts/specimen.ts`, `apps/site/src/views/Home.astro`, `apps/site/src/pages/es/index.astro`, `apps/site/src/pages/404.astro`
- Modify: `apps/site/src/pages/index.astro` (replace the placeholder)

**Interfaces:**
- Consumes: everything from Tasks 2–4. `s` = `papel.module.css` classes (names identical to the web module).
- Produces: `<Home locale />`, `<StatementSpecimen locale />`, `<StoreBadges locale />`, `<LocaleToggle locale page />`.

- [ ] **Step 1: `LocaleToggle.astro`** (two links instead of a server action)

```astro
---
import { LOCALE_LABEL, LOCALES, type Locale } from "@cigua/core/i18n/locale";
import { pathFor, type Page } from "../i18n/paths";
import { translator } from "../i18n/t";
import s from "../styles/papel.module.css";

interface Props {
  locale: Locale;
  page: Page;
}
const { locale, page } = Astro.props;
const t = translator(locale, "Marketing");
---

<nav aria-label={t("languageLabel")} class={s.localeToggle}>
  {
    LOCALES.map((code) => (
      <a
        href={pathFor(code, page)}
        lang={code}
        hreflang={code}
        aria-label={LOCALE_LABEL[code]}
        aria-current={code === locale ? "page" : undefined}
      >
        {code.toUpperCase()}
      </a>
    ))
  }
</nav>
```

- [ ] **Step 2: `StoreBadges.astro`**

```astro
---
import { siApple, siGoogleplay } from "simple-icons";
import type { Locale } from "@cigua/core/i18n/locale";
import { STORE } from "../config";
import { translator } from "../i18n/t";
import { storeBadges, type StoreId } from "../lib/stores";
import s from "../styles/papel.module.css";

interface Props {
  locale: Locale;
}
const { locale } = Astro.props;
const t = translator(locale, "Marketing");
const MARK: Record<StoreId, string> = { appStore: siApple.path, googlePlay: siGoogleplay.path };
const LINE: Record<StoreId, string> = { appStore: t("downloadOn"), googlePlay: t("getItOn") };
const NAME: Record<StoreId, string> = { appStore: t("appStore"), googlePlay: t("googlePlay") };
---

<ul class={s.stores}>
  {
    storeBadges(STORE).map((b) => {
      const inner = (
        <>
          <svg class={s.storeMark} viewBox="0 0 24 24" aria-hidden="true">
            <path d={MARK[b.id]} fill="currentColor" />
          </svg>
          <span class={s.storeText}>
            <span class={s.storeLine}>{LINE[b.id]}</span>
            <span class={s.storeName}>{NAME[b.id]}</span>
            {!b.href && <em class={s.soon}>{t("comingSoon")}</em>}
          </span>
        </>
      );
      return (
        <li>
          {b.href ? (
            <a class={s.store} href={b.href} rel="noopener">
              {inner}
            </a>
          ) : (
            <span class={s.store} aria-disabled="true">
              {inner}
            </span>
          )}
        </li>
      );
    })
  }
</ul>
```

- [ ] **Step 3: `StatementSpecimen.astro` and `scripts/specimen.ts`**

`src/components/StatementSpecimen.astro`:
```astro
---
import { Car, Check, HeartPulse, RotateCcw, ShoppingCart, Smartphone, Sofa, Tv } from "lucide-static";
import type { Locale } from "@cigua/core/i18n/locale";
import { translator } from "../i18n/t";
import { icon } from "../lib/icon";
import s from "../styles/papel.module.css";

interface Props {
  locale: Locale;
}
const { locale } = Astro.props;
const t = translator(locale, "Marketing");
const k = t as unknown as (key: string, values?: Record<string, number>) => string;

/* Illustrative data only, labelled on the sheet as made up. The five RD$ lines add
   to the printed total, so the "matches the statement" seal is true of the example. */
const ROWS = [
  { date: "02/09", raw: "SUPERMERCADOS NACIONAL 0217", name: "Supermercados Nacional", cat: "Groceries", icon: ShoppingCart, color: "#0E6E60", amount: "4,382.10" },
  { date: "03/09", raw: "CLARO RECARGA *8093", name: "Claro", cat: "Phone", icon: Smartphone, color: "#1D4FB8", amount: "1,200.00" },
  { date: "05/09", raw: "LA SIRENA CUOTA 04/12", name: "La Sirena", cat: "Home", icon: Sofa, color: "#C4531A", amount: "3,250.00", cuota: [4, 12] as const },
  { date: "06/09", raw: "UBER *TRIP HELP.UBER", name: "Uber", cat: "Transport", icon: Car, color: "#5B2E91", amount: "486.50" },
  { date: "08/09", raw: "FARMACIA CAROL 0112", name: "Farmacia Carol", cat: "Health", icon: HeartPulse, color: "#A52A2A", amount: "22.50" },
  { date: "10/09", raw: "NETFLIX.COM 866-579", name: "Netflix", cat: "Subs", icon: Tv, color: "#B0144F", amount: "15.49", usd: true },
] as const;
---

<figure class={s.specimen} aria-label={t("specimenLabel")} data-specimen>
  <div class={s.statement} aria-hidden="true">
    <div class={s.statementHead}>
      <span class={s.legend}>{t("statementTitle")}</span>
      <span>{t("statementCard")}</span>
      <span>{t("statementCut")}</span>
    </div>
    <ol class={s.statementRows}>
      {
        ROWS.map((r, i) => (
          <li class={s.statementRow} style={`--i: ${i}`}>
            <span>{r.date}</span>
            <span class={s.statementRaw}>{r.raw}</span>
            <span class={s.num}>
              {"usd" in r ? "US$" : ""}
              {r.amount}
            </span>
          </li>
        ))
      }
    </ol>
    <div class={s.statementTotal}>
      <span>{t("statementTotal")}</span>
      <span class={s.num}>RD$ 9,341.10</span>
      <span class={s.num}>US$ 15.49</span>
    </div>
    <p class={s.sampleTag}>{t("sampleData")}</p>
  </div>

  <div class={s.ledger}>
    <p class={s.ledgerTitle}>{t("ledgerTitle")}</p>
    <ul class={s.ledgerRows}>
      {
        ROWS.map((r, i) => (
          <li class={s.ledgerRow} style={`--i: ${i}`}>
            <span class={s.tile} style={`background: ${r.color}`} set:html={icon(r.icon, 2.2)} />
            <span class={s.ledgerName}>
              <span>{r.name}</span>
              <span class={s.ledgerMeta}>
                {k(`cat${r.cat}`)}
                {"cuota" in r && <span class={s.cuota}>{t("cuotaBadge", { n: r.cuota[0], total: r.cuota[1] })}</span>}
              </span>
            </span>
            <span class={s.num}>
              <span class={s.cur}>{"usd" in r ? "US$" : "RD$"}</span> {r.amount}
            </span>
          </li>
        ))
      }
    </ul>
    <div class={s.ledgerFoot}>
      <span class={s.seal}><Fragment set:html={icon(Check, 3)} />{t("balanced")}</span>
      <span class={s.safe}>
        <span class={s.safeLabel}>{t("safeLabel")}</span>
        <span class={s.safeFigure}>RD$ 12,480</span>
      </span>
    </div>
  </div>

  <button type="button" class={s.replay} data-replay><Fragment set:html={icon(RotateCcw)} />{t("replay")}</button>
</figure>

<script>
  import "../scripts/specimen";
</script>
```

`src/scripts/specimen.ts`:
```ts
/* The built HTML is the finished state, so the specimen reads fully without JS
   and under reduced motion. Playing it drops data-play, forces a style flush and
   sets it again so the keyframes restart from the top. */
const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function play(el: HTMLElement) {
  if (reduce()) return;
  el.removeAttribute("data-play");
  void el.offsetWidth;
  el.setAttribute("data-play", "on");
}

document.querySelectorAll<HTMLElement>("[data-specimen]").forEach((el) => {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        play(el);
        io.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  io.observe(el);
  el.querySelector("[data-replay]")?.addEventListener("click", () => play(el));
});
```

- [ ] **Step 4: `views/Home.astro`** — a line-by-line port of `tywin/components/marketing/marketing-home.tsx`. Keep the `CONTRACT` comment, the `BILLS` and `CUOTAS` data and every class name. The only changes are the ones marked `CHANGED`.

```astro
---
import { ArrowRight, Check } from "lucide-static";
import type { Locale } from "@cigua/core/i18n/locale";
import Base from "../layouts/Base.astro";
import CardFace from "../components/CardFace.astro";
import Guilloche from "../components/Guilloche.astro";
import LocaleToggle from "../components/LocaleToggle.astro";
import Logo from "../components/Logo.astro";
import Microprint from "../components/Microprint.astro";
import Serial from "../components/Serial.astro";
import StatementSpecimen from "../components/StatementSpecimen.astro";
import StoreBadges from "../components/StoreBadges.astro";
import Wordmark from "../components/Wordmark.astro";
import { pathFor } from "../i18n/paths";
import { translator } from "../i18n/t";
import { icon } from "../lib/icon";
import s from "../styles/papel.module.css";

interface Props {
  locale: Locale;
}
const { locale } = Astro.props;

/* Direction contract, emitted into the markup so it survives the build. */
const CONTRACT = `<!--
THESIS: Money's own print language. The statement is re-issued as an engraved, checkable document; refuses the headline + phone mockup + feature-card grid.
OWN-WORLD: RD$50-note violet field, peso orange, intaglio ink on lilac security paper; live guilloche rosettes and wave fields, bilingual microprint frames, serial numbers; Archivo expanded caps and tabular numerals, one family; state as ink density.
STORY: A Dominican visitor sees their own estado de cuenta become a sorted ledger with cuotas and one Disponible figure, believes it reads their bank without typing, and gets the app.
FIRST VIEWPORT: Full-bleed violet note inside a microprint frame; two-line expanded headline left with Get the app CTA; statement sheet under a ledger sheet right, printing row by row over a rosette.
FORM: Papel Moneda (banknote security print), candidate 3 of 7, seed 101aa86f.
-->`;

const BILLS = [
  { day: 21, label: "Claro", amount: "1,200" },
  { day: 25, label: "La Sirena · 5/12", amount: "3,250" },
  { day: 27, label: "Netflix", amount: "US$15.49" },
];

const CUOTAS = [
  { name: "La Sirena", item: "cuotaItemFridge" as const, n: 4, total: 12, amount: "RD$ 3,250.00" },
  { name: "Plaza Lama", item: "cuotaItemLaptop" as const, n: 9, total: 18, amount: "US$ 62.50" },
];

const t = translator(locale, "Marketing");
const micro = t("microprint");
const home = pathFor(locale, "home");
---

<Base locale={locale} page="home" title={t("metaTitle")} description={t("metaDescription")}>
  <div class={s.page}>
    <Fragment set:html={CONTRACT} />
    <main>
      <section class={s.hero} aria-labelledby="hero-title">
        <Guilloche class={s.heroRosette} />
        <Guilloche variant="field" class={s.heroField} lineWidth={0.6} duration={2400} />
        <Microprint text={micro} />
        <Serial value="CL 2026 000417 A" class={s.serialTop} />
        <Serial value="CL 2026 000417 A" class={s.serialBottom} />

        <nav class={s.nav} aria-label={t("navLabel")}>
          <a href={home} class={s.brand}><Logo /><Wordmark /></a>
          <div class={s.navEnd}>
            <LocaleToggle locale={locale} page="home" />
            {/* CHANGED: was "Log in" → /login */}
            <a href="#get-the-app" class={s.navLink}>{t("getApp")}</a>
          </div>
        </nav>

        <div class={s.heroGrid}>
          <div class={s.heroCopy}>
            <h1 id="hero-title" class={s.display}>
              <span>{t("heroTitleA")}</span> <span class={s.displayB}>{t("heroTitleB")}</span>
            </h1>
            <p class={s.lede}>{t("heroBody")}</p>
            <div class={s.actions}>
              {/* CHANGED: was "Create a free account" → /login?mode=up, plus an "I have an account" link */}
              <a href="#get-the-app" class={s.cta}>{t("getApp")}<Fragment set:html={icon(ArrowRight)} /></a>
            </div>
          </div>
          <StatementSpecimen locale={locale} />
        </div>
      </section>

      <section class={s.paper} aria-labelledby="read-title">
        <div class={s.wrap}>
          <div class={s.sectionHead}>
            <h2 id="read-title" class={s.h2}>{t("readTitle")}</h2>
            <p class={s.sectionBody}>{t("readBody")}</p>
          </div>

          <div class={s.proofs}>
            <article class={s.proof}>
              <div class={s.proofDemo} aria-hidden="true">
                <div class={s.columnsDemo}>
                  <span>05/09<i>{t("colDate")}</i></span>
                  <span>LA SIRENA CUOTA 04/12<i>{t("colDesc")}</i></span>
                  <span class={s.num}>3,250.00<i>{t("colAmount")}</i></span>
                </div>
              </div>
              <h3 class={s.h3}>{t("col1Title")}</h3>
              <p>{t("col1Body")}</p>
            </article>

            <article class={s.proof}>
              <div class={s.proofDemo} aria-hidden="true">
                <dl class={s.redactDemo}>
                  <div><dt>{t("redactName")}</dt><dd><b></b></dd></div>
                  <div><dt>{t("redactEmail")}</dt><dd><b style="width: 72%"></b></dd></div>
                  <div><dt>{t("redactPhone")}</dt><dd><b style="width: 46%"></b></dd></div>
                </dl>
              </div>
              <h3 class={s.h3}>{t("col2Title")}</h3>
              <p>{t("col2Body")}</p>
            </article>

            <article class={s.proof}>
              <div class={s.proofDemo} aria-hidden="true">
                <dl class={s.sumDemo}>
                  <div><dt>{t("demoSum")}</dt><dd class={s.num}>9,341.10</dd></div>
                  <div><dt>{t("demoTotal")}</dt><dd class={s.num}>9,341.10</dd></div>
                  <div class={s.sumRule}>
                    <dt>{t("demoDiff")}</dt>
                    <dd class={s.num}>0.00 <Fragment set:html={icon(Check, 3)} /></dd>
                  </div>
                </dl>
              </div>
              <h3 class={s.h3}>{t("col3Title")}</h3>
              <p>{t("col3Body")}</p>
            </article>
          </div>
          <p class={s.note}>{t("pdfNote")}</p>
        </div>
      </section>

      <section class={s.peso} aria-labelledby="quincena-title">
        <Guilloche variant="field" class={s.pesoField} lineWidth={0.6} duration={2000} />
        <div class:list={[s.wrap, s.pesoGrid]}>
          <div>
            <h2 id="quincena-title" class={s.h2}>{t("quincenaTitle")}</h2>
            <p class={s.sectionBody}>{t("quincenaBody")}</p>
          </div>
          <figure class={s.denomination} aria-label={t("denominationLabel")}>
            <span class={s.denomLabel}>{t("availableLabel")}</span>
            <span class={s.denomFigure}><span class={s.denomCur}>RD$</span>12,480</span>
            <div class={s.timeline}>
              <div class={s.track}>
                <span class={s.pay} style="left: 0%">{t("payday15")}</span>
                <span class={s.today} style="left: 20%">{t("today")}</span>
                {
                  BILLS.map((b) => (
                    <span class={s.bill} style={`left: ${((b.day - 15) / 15) * 100}%`}>
                      <b>{b.day}</b>
                      <span class={s.billLabel}>{b.label}</span>
                      <em class={s.num}>{b.amount}</em>
                    </span>
                  ))
                }
                <span class={s.pay} style="left: 100%">{t("payday30")}</span>
              </div>
            </div>
            <figcaption class={s.sampleTagLight}>{t("sampleData")}</figcaption>
          </figure>
        </div>
      </section>

      <section class={s.paper} aria-labelledby="cards-title">
        <div class:list={[s.wrap, s.cardsGrid]}>
          <div class={s.wallet} aria-hidden="true">
            <CardFace name="Visa Oro" last4="4417" network="visa" accent="#e4b64a" class={s.cardGold} />
            <CardFace name="Mastercard Black" last4="0932" network="mastercard" accent="#2a2733" class={s.cardBlack} />
            <p class={s.sampleTag}>{t("cardsTyped")}</p>
          </div>

          <div>
            <h2 id="cards-title" class={s.h2}>{t("cardsTitle")}</h2>
            <p class={s.sectionBody}>{t("cardsBody")}</p>
            <ul class={s.cuotas}>
              {
                CUOTAS.map((c) => (
                  <li>
                    <div class={s.cuotaHead}>
                      <span><b>{t(c.item)}</b> · {c.name}</span>
                      <span class={s.num}>{c.amount}</span>
                    </div>
                    <div class={s.perf} role="img" aria-label={t("cuotaBadge", { n: c.n, total: c.total })}>
                      {Array.from({ length: c.total }, (_, i) => <i data-paid={i < c.n ? "" : undefined} />)}
                    </div>
                    <p class={s.cuotaMeta}>
                      {t("cuotaBadge", { n: c.n, total: c.total })} · {t("cuotaLeft", { n: c.total - c.n })}
                    </p>
                  </li>
                ))
              }
            </ul>
            <ul class={s.facts}>
              <li>{t("factCurrencies")}</li>
              <li>{t("factTax")}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CHANGED: the close section is the badge target; the badges replace the sign-up CTA */}
      <section class={s.close} id="get-the-app" aria-labelledby="close-title">
        <Guilloche class={s.closeRosette} duration={2200} />
        <Microprint text={micro} />
        <div class={s.closeInner}>
          <h2 id="close-title" class={s.closeTitle}>{t("closeTitle")}</h2>
          <p class={s.lede}>{t("closeBody")}</p>
          <StoreBadges locale={locale} />
        </div>
      </section>
    </main>

    <footer class={s.footer}>
      <div class={s.footerInner}>
        <span class={s.brand}><Logo class={s.footerLogo} /><Wordmark /></span>
        <span class={s.footerNote}>{t("footerNote")}</span>
        {/* CHANGED: Help link dropped (help lives in the app); links keep the locale */}
        <nav aria-label={t("footerNav")} class={s.footerLinks}>
          <a href={pathFor(locale, "terms")}>{t("termsLink")}</a>
          <a href={pathFor(locale, "privacy")}>{t("privacyLink")}</a>
        </nav>
      </div>
    </footer>
  </div>
</Base>
```

- [ ] **Step 5: Pages `/`, `/es`, and the 404**

`src/pages/index.astro` (replaces the placeholder):
```astro
---
import Home from "../views/Home.astro";
---

<Home locale="en" />
```

`src/pages/es/index.astro`:
```astro
---
import Home from "../../views/Home.astro";
---

<Home locale="es" />
```

`src/pages/404.astro` — one bilingual page (served for every unknown path, so it can't know the locale):
```astro
---
import LegalLayout from "../layouts/LegalLayout.astro";
---

<LegalLayout locale="en" page="home" title="Not found · No encontrado" updated="—">
  <section>
    <p>This page doesn't exist. <a href="/">Go to the home page</a>.</p>
    <p lang="es">Esta página no existe. <a href="/es">Ir al inicio</a>.</p>
  </section>
</LegalLayout>
```
Then in `LegalLayout.astro`, render the "updated" line only when it's not `"—"`:
```astro
{updated !== "—" && <p class="updated">{t("updated", { date: updated })}</p>}
```
and add `<meta name="robots" content="noindex" />` for the 404 by giving `Base.astro` an optional `noindex?: boolean` prop (`{noindex && <meta name="robots" content="noindex" />}`) that `LegalLayout` passes through as `noindex={updated === "—"}`.

- [ ] **Step 6: Build and type-check**

Run: `cd apps/site && npx astro check && npx astro build && ls dist dist/es`
Expected: 0 errors; `dist/index.html dist/privacy.html dist/terms.html dist/404.html dist/es.html dist/es/privacy.html dist/es/terms.html`. If Astro writes `dist/es/index.html` instead of `dist/es.html`, keep it — Task 7's test accepts either and Task 9 checks the live URL.

- [ ] **Step 7: Commit**

```bash
git add apps/site/src
git commit -m "feat(site): port the Papel landing page with store badges in place of web sign-up"
```

---

### Task 7: Build-output tests

**Files:**
- Create: `apps/site/tests/dist.test.ts`

**Interfaces:**
- Consumes: `apps/site/dist/**` from `astro build`.

- [ ] **Step 1: Write the test**

```ts
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
```

- [ ] **Step 2: Run the whole verify chain**

Run: `cd apps/site && npm run verify`
Expected: `astro check` 0 errors, unit tests PASS, build succeeds, dist tests PASS. Fix the site (not the test) on any failure.

- [ ] **Step 3: Commit**

```bash
git add apps/site/tests
git commit -m "test(site): check every built page's language, links and placeholders"
```

---

### Task 8: Visual check against the web landing page

**Files:** fixes only, in whichever `apps/site/src` file the check shows is wrong.

- [ ] **Step 1: Ask the user before starting a server.** Say: "I'd like to start `wrangler dev` on port 8790 to preview the built site, and stop it when I'm done. OK?" Wait for yes.

- [ ] **Step 2: Start the preview**

```bash
ss -ltnp | grep 8790   # must print nothing
```
Then run `cd ~/projects/tywin-native/apps/site && npx wrangler dev --port 8790` with `run_in_background: true`.

- [ ] **Step 3: Look at every page at phone and desktop width, light and dark**

```bash
SESSION="$(agent-browser session id --scope worktree --prefix cigua-site)"
for p in / /es /privacy /es/terms /nope; do
  agent-browser --session "$SESSION" open "http://localhost:8790$p"
  agent-browser --session "$SESSION" set viewport 390 844
  agent-browser --session "$SESSION" screenshot --full "$SCRATCHPAD/site-$(echo $p | tr / _)-390.png"
  agent-browser --session "$SESSION" set viewport 1280 800
  agent-browser --session "$SESSION" screenshot --full "$SCRATCHPAD/site-$(echo $p | tr / _)-1280.png"
done
agent-browser --session "$SESSION" set media dark
agent-browser --session "$SESSION" open http://localhost:8790/
agent-browser --session "$SESSION" screenshot --full "$SCRATCHPAD/site-home-dark.png"
```
(`$SCRATCHPAD` = this session's scratchpad directory. Check `agent-browser --help` for the exact viewport and media sub-commands if these differ.)

Read each screenshot. Check: the Archivo wide cut renders (the headline and legends are visibly expanded); the rosettes are centred, not cropped wrongly; the hero and peso wave fields draw; the specimen rows are all visible; both cards show their gradient and name; badges read "Coming soon"; the language toggle marks the current language; no horizontal scroll at 390px; dark mode swaps the paper sections while the violet note stays violet. For reference, the web original's layout is in `~/projects/tywin/components/marketing/marketing-home.tsx` and its CSS; the user can compare against their live web page.

- [ ] **Step 4: Stop everything started in Step 2–3**

```bash
agent-browser --session "$SESSION" close
```
Stop the background `wrangler dev` task (TaskStop), then confirm `ss -ltnp | grep 8790` prints nothing.

- [ ] **Step 5: Fix what the screenshots show, re-run `npm run verify`, commit**

```bash
git add apps/site
git commit -m "fix(site): <what the visual check found>"
```
(Skip the commit if nothing needed fixing.)

---

### Task 9: Deploy, document, merge

**Files:**
- Modify: `README.md` (root of tywin-native)

- [ ] **Step 1: Check the Cloudflare login**

Run: `cd ~/projects/tywin-native/apps/site && npx wrangler whoami`
Expected: the account that owns `quantcoresolutions.com` (the same one `palmonte-site` deploys to). If not logged in, ask the user to run `! npx wrangler login` in `apps/site`.

- [ ] **Step 2: Deploy**

Run: `cd ~/projects/tywin-native && npm run deploy:site`
Expected: verify passes, then wrangler reports the upload and `cigua.quantcoresolutions.com (custom domain)`.

- [ ] **Step 3: Check the live site**

```bash
for p in / /privacy /terms /es /es/privacy /es/terms; do
  printf '%-14s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://cigua.quantcoresolutions.com$p"
done
for p in /privacy/ /es/ /es/terms/; do
  printf '%-14s ' "$p"; curl -sL -o /dev/null -w '%{http_code} → %{url_effective}\n' "https://cigua.quantcoresolutions.com$p"
done
curl -s -o /dev/null -w '/nope %{http_code}\n' https://cigua.quantcoresolutions.com/nope
```
Expected: six `200`s; the three trailing-slash URLs end at `200` on the slash-less URL; `/nope 404`. A fresh custom domain can take a minute for its certificate; retry once after 60s before treating a TLS error as a failure.

- [ ] **Step 4: README**

In `README.md`, change the intro so it no longer says "on the same Supabase project as the web app" / "nothing from the web runtime (Next.js, the PWA, the marketing site) is shipped", and add `apps/site` to the layout block and a short section:

```md
apps/site        Public site (Astro, static): landing, privacy, terms, in en + es
```

```md
### Site

`apps/site` is the public website at https://cigua.quantcoresolutions.com: the
landing page and the legal pages, static HTML served by a Cloudflare Worker
(`cigua-site`, static assets only). Legal copy comes from `@cigua/core/messages`,
the same text the app's legal screens show. Store links are in
`apps/site/src/config.ts`; an empty one shows a "Coming soon" badge.

```sh
npm run dev:site      # http://localhost:4321
npm run deploy:site   # check + tests + build + wrangler deploy
```
```

Commit:
```bash
git add README.md
git commit -m "docs: the public site lives in apps/site"
```

- [ ] **Step 5: Merge into main and delete the branch**

```bash
git switch main && git merge --no-ff feat/astro-site -m "Merge feat/astro-site: Astro public site on cigua.quantcoresolutions.com"
git --no-pager log --oneline -3
git branch -d feat/astro-site
git push origin main
git push origin --delete feat/astro-site 2>/dev/null || true
```

---

### Task 10: Move the database history into tywin-native

**Files:**
- Create: `supabase/config.toml`, `supabase/.gitignore`, `supabase/seeds/*` (moved), 57 files in `supabase/migrations/`
- Modify: root `package.json` (supabase devDependency + db scripts)

- [ ] **Step 1: Copy what's missing**

```bash
cd ~/projects/tywin-native
cp -n ~/projects/tywin/supabase/migrations/*.sql supabase/migrations/
cp -n ~/projects/tywin/supabase/config.toml ~/projects/tywin/supabase/.gitignore supabase/
mkdir -p supabase/seeds && cp -n ~/projects/tywin/supabase/seeds/* supabase/seeds/
diff <(ls ~/projects/tywin/supabase/migrations) <(ls supabase/migrations) && echo "migrations identical"
cmp ~/projects/tywin/supabase/migrations/20260928120000_subscriptions_emoji.sql supabase/migrations/20260928120000_subscriptions_emoji.sql && echo "emoji migration unchanged"
```
Expected: `migrations identical`, `emoji migration unchanged` (58 files).

- [ ] **Step 2: Add the CLI and scripts**

```bash
cd ~/projects/tywin-native && npm install -D supabase@^2.109.1   # at the root: adds to the root devDependencies
```
Root `package.json` → `scripts`:
```json
"db:new": "supabase migration new",
"db:push": "supabase db push",
"db:types": "supabase gen types typescript --linked > packages/core/src/supabase/types.ts"
```

- [ ] **Step 3: Link and compare with the live history (read-only)**

```bash
cd ~/projects/tywin-native
npx supabase link --project-ref "$(cat ~/projects/tywin/supabase/.temp/project-ref)"
npx supabase migration list --linked
```
Expected: every row has the same timestamp in the Local and Remote columns; no remote-only rows. If `link` asks for the database password, ask the user to run `! npx supabase link --project-ref <ref>` in `~/projects/tywin-native` themselves. **Do not run `db push`.**

- [ ] **Step 4: Check the generated types didn't drift**

```bash
npx supabase gen types typescript --linked > "$SCRATCHPAD/types.ts"   # $SCRATCHPAD = this session's scratchpad dir
diff -q "$SCRATCHPAD/types.ts" packages/core/src/supabase/types.ts && echo "types current"
```
Expected: `types current`. If they differ, report the diff to the user instead of overwriting (the app may rely on a hand edit).

- [ ] **Step 5: Commit**

```bash
git add supabase package.json package-lock.json
git commit -m "chore(db): take over the migration history from the retired web repo"
git push origin main
```

**Not moved, on purpose:** `tywin/scripts/parse-statement*.mjs` import `tywin/lib/statements/*` (the web parser and its Groq pipeline), which the app replaced with on-device extraction and the Worker's Gemini call — moving them would mean moving that dead pipeline. `generate-sounds.mjs` wrote `public/sounds/*`; the app already ships its own `.wav` files. Both stay in `cb-co/tywin`'s history.

---

### Task 11: Retire `cb-co/tywin`

**Files:** the whole `~/projects/tywin` working tree.

- [ ] **Step 1: Make sure nothing unpushed is lost**

```bash
cd ~/projects/tywin
git --no-pager status --short
git fetch origin && git --no-pager log --oneline origin/main..main
```
Expected: no output from the log (nothing unpushed). Untracked files (e.g. `BSC_*.pdf:Zone.Identifier`, `extracted-statement.*`) are the user's local files; leave them on disk, don't commit them.

- [ ] **Step 2: Replace the tree with a pointer README**

```bash
cd ~/projects/tywin
git rm -r -q --cached .
git ls-files | wc -l   # expect 0 tracked
```
Then write `README.md`:

```md
# Cigua (retired web app)

This Next.js web app is retired. Cigua is now the native app plus its public
site, both in [cb-co/tywin-native](https://github.com/cb-co/tywin-native):

- `apps/mobile` — the iOS and Android app
- `apps/worker` — its API
- `apps/site` — https://cigua.quantcoresolutions.com (landing, privacy, terms)
- `supabase/` — the database migrations that used to live here

The full history of this repo is kept in git.
```

```bash
git add README.md
git commit -m "chore: retire the web app; Cigua lives in cb-co/tywin-native"
git --no-pager show --stat HEAD | tail -3
git push origin main
```
The working-tree files stay on disk (they were only removed from the index), so the user's local `.env.local`, PDFs and `node_modules` are untouched; they can delete the folder themselves.

- [ ] **Step 3: Ask, then archive**

Ask the user: "Archive cb-co/tywin on GitHub now (read-only; reversible from repo settings)?" Only on yes:
```bash
gh repo archive cb-co/tywin --yes
gh repo view cb-co/tywin --json isArchived
```
Expected: `{"isArchived":true}`.

- [ ] **Step 4: Update the agent's project memory**

In `~/.claude-personal/projects/-home-cm-corp-projects-tywin/memory/`:
- `native-migration.md`: replace "This repo stays as the web app plus the `/api/v1` backend" with "The web app was retired on 2026-09-29; `cb-co/tywin` is archived. The public site is `tywin-native/apps/site` at cigua.quantcoresolutions.com."
- `supabase-live-project.md`: the linked repo is now `~/projects/tywin-native` (migrations in its `supabase/`).
- `statement-failure-diagnosis.md`: the offline rerun scripts were left behind with the web app; failures are diagnosed through the Worker now.
- `help-guide-upkeep.md`: the help guide is the app's `help.tsx`; there's no web help page.
- `browser-verification-setup.md`: delete (the Next dev server it describes no longer exists) and drop its `MEMORY.md` line.
Update the matching one-line hooks in `MEMORY.md`.

- [ ] **Step 5: Hand the user their steps**

Tell the user, as the last message of the work:
1. Delete the Vercel project `tywin` (and its domain) — I don't touch Vercel.
2. Supabase → Authentication → URL Configuration: set Site URL to `https://cigua.quantcoresolutions.com`.
3. When the store listings exist, put their URLs in `apps/site/src/config.ts` and run `npm run deploy:site`.
