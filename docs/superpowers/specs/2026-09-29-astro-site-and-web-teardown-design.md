# Astro public site and web-app teardown

Date: 2026-09-29
Status: approved in conversation, awaiting written-spec review

## Goal

The native app becomes Cigua's only product entry point. The Next.js web app
(`cb-co/tywin`, on Vercel) is retired. Of the web app, only the public pages
survive — the landing page and the two legal pages — rebuilt in Astro as a
static site and served by a Cloudflare Worker at
`https://cigua.quantcoresolutions.com`.

Success:

- `https://cigua.quantcoresolutions.com/`, `/privacy`, `/terms`, `/es/`,
  `/es/privacy`, `/es/terms` all return 200 with the ported content.
- The landing page's calls to action point at the app stores, not at a web login.
- The database migration history lives in `tywin-native`; `cb-co/tywin` holds
  only a pointer README and is archived.

## What the user decided

- The site lives in this monorepo as `apps/site` (`@cigua/site`).
- CTAs become App Store / Google Play badges. Store URLs come from config;
  an empty URL renders a non-link "Coming soon" badge.
- Teardown order: site live first, then move the DB files, then archive.
- English and Spanish both ship. English is the default, as it is on the web today.
- Supabase Auth Site URL: `https://cigua.quantcoresolutions.com` (the user sets
  it; redirect URLs are already updated to the app scheme).

## Non-goals

- No web sign-in, onboarding, help centre or any authenticated page.
- No language auto-detection or redirect.
- No Android App Links / `assetlinks.json` (the old `app.tywin.twa` entry is
  dropped; the new Android ID is still undecided).
- No waitlist, analytics or forms.

## 1. Workspace and hosting

`apps/site` is an Astro project with `output: "static"` and no adapter. It
ships no Worker code: the Worker serves `dist/` as static assets only, the same
shape as the existing `palmonte-site` Worker on the same account.

`apps/site/wrangler.jsonc`:

- `name: "cigua-site"`
- `assets: { directory: "./dist", html_handling: "auto-trailing-slash", not_found_handling: "404-page" }`
- `routes: [{ pattern: "cigua.quantcoresolutions.com", custom_domain: true }]`
  — Cloudflare creates the DNS record and certificate on deploy; the
  `quantcoresolutions.com` zone is already on this account.
- `workers_dev: true`, set explicitly (palmonte found omitting it flips it off).

Root `package.json` gains `dev:site`, `build:site`, `deploy:site`. The site's
own scripts: `dev` (astro dev), `build` (astro build), `preview`
(`wrangler dev` against `dist/` on fixed port 8790), `deploy`
(build then `wrangler deploy`), `check` (astro check), `test` (vitest).

## 2. Routes and i18n

Astro's i18n routing with `defaultLocale: "en"`, `locales: ["en", "es"]`,
`prefixDefaultLocale: false`:

| English    | Spanish       |
|------------|---------------|
| `/`        | `/es/`        |
| `/privacy` | `/es/privacy` |
| `/terms`   | `/es/terms`   |

Plus `/404` (bilingual, one page).

Pages are written once and generated per locale (a `[...locale]` param or two
thin page files per route that pass the locale to a shared component — the
plan picks one). Each page sets `<html lang>`, a canonical URL, and
`<link rel="alternate" hreflang>` for both locales plus `x-default` → English.

The locale toggle is a plain link to the same page in the other locale. No JS.

## 3. Copy

- **Legal, Privacy, Terms** namespaces: read from
  `@cigua/core/messages/{en,es}.json`. These are byte-identical to the web
  app's today and are what the app's own legal screens use, so the site and the
  app can't drift.
- **Marketing** namespace: copied from `tywin/messages/{en,es}.json` into
  `apps/site/src/i18n/{en,es}.json`. Only the site uses it. Strings that
  referred to signing in on the web are rewritten for the store badges
  (e.g. `navLogin` → "Get the app"); new keys for "App Store", "Google Play",
  "Coming soon", the badge section heading.
- `src/i18n/t.ts`: `translator(locale, namespace)` returning
  `t(key, values?)` with `{name}` interpolation, the same call shape as the
  next-intl code being ported. Missing key throws at build time.
- `LAST_UPDATED` dates and the contact email carry over unchanged.

## 4. Landing page port

Source: `tywin/components/marketing/marketing-home.tsx` and
`papel/{papel.module.css,statement-specimen.tsx}`, with its dependencies in
`tywin/components/papel/*` and `components/brand/logo.tsx`.

- Sections kept in order: hero (nav + headline + CTA), "read" paper section,
  peso/quincena denomination, cards, close, footer.
- `papel.module.css` → `src/styles/papel.module.css`, imported the same way
  (Astro supports CSS modules through Vite). Class names stay, so the diff
  against the source stays readable.
- React components → `.astro` components under `src/components/`: `Logo`,
  `Wordmark`, `Seal`, `Guilloche`, `Microprint`, `Serial`, `CardFace`,
  `NetworkMark`, `StatementSpecimen`, `LocaleToggle`, `StoreBadges`. They use
  `@cigua/core/papel/*` (rosette, wordmark, fit, …) for geometry instead of
  copying it. Only the pieces the landing page actually renders are ported.
- The web `Guilloche` draws in a `useEffect`. The port computes its paths at
  build time from `rosettePoints` and emits static SVG. If that proves
  impossible for a piece, it becomes a small inline `<script>`, not a framework
  island.
- Design tokens: `src/styles/tokens.css` is generated from
  `@cigua/core/tokens.json` (`fixed`, `light`, `dark`), with dark values under
  `@media (prefers-color-scheme: dark)`. Other variables the page uses
  (`--gutter`, `--ease-press`, `--radius`, …) are copied from
  `tywin/app/globals.css` into `src/styles/global.css`.
- Font: Archivo variable (with the `wdth` axis), self-hosted via
  `@fontsource-variable/archivo`, exposed as `--font-archivo`.
- Icons (`ArrowRight`, `Check`, the legal page's `ArrowLeft`): inline SVG.
- Links: `/login*` → `#get-the-app` (the badge section). Footer: Terms and
  Privacy only; Help is dropped (help lives in the app).
- Static assets: favicon/apple-touch/manifest icons copied from
  `tywin/app/icon*.png`; the Open Graph/Twitter image is rendered once from the
  web app's generated `/opengraph-image` and committed as
  `public/og.png`.

### Store badges

`src/config.ts`:

```ts
export const STORE = {
  appStore: "",   // https://apps.apple.com/app/id…
  googlePlay: "", // https://play.google.com/store/apps/details?id=…
};
```

`StoreBadges.astro` renders one badge per store. With a URL it is an `<a>`;
without one it is a `<span aria-disabled="true">` with the "Coming soon"
label. The badge art is text-plus-mark in the Papel style, not Apple's or
Google's official artwork, until the listings exist (official badges have
usage rules tied to a live listing).

## 5. Legal pages

`LegalLayout.astro` replaces `components/legal/legal-page.tsx`: logo header,
back link to the locale's home, title, "Updated {date}", section body. The
web version's Tailwind classes become scoped CSS; no Tailwind in the site.
Privacy and Terms page bodies map their sections from the `Privacy` / `Terms`
namespaces exactly as the web pages do.

## 6. Testing

- Vitest (`apps/site/src/**/*.test.ts`):
  - `en` and `es` Marketing files have identical key sets.
  - `t()` interpolates values and throws on a missing key.
  - `StoreBadges` logic: empty URL → non-link, set URL → link (tested through
    a plain helper function, not a render).
- `astro check` passes; `astro build` produces exactly the six pages + 404.
- A build-output test asserts each page's `lang`, `hreflang` pair and that no
  page contains `/login`.
- Visual check: `wrangler dev` preview on port 8790 (asked for before
  starting), `agent-browser` snapshots at 390px and 1280px, light and dark,
  compared by eye to the live web landing page; stopped in the same turn.
- After deploy: `curl -sI` each of the six URLs on the custom domain → 200,
  and an unknown path → 404.

## 7. Teardown of `cb-co/tywin` (after the site is verified live)

1. **Migrations.** Copy the 57 migrations missing from
   `tywin-native/supabase/migrations` (the `subscriptions_emoji` one is already
   there and identical). Verify with `supabase migration list --linked` that
   the local list now matches the remote history. Commit in `tywin-native`.
2. **Scripts.** Move `scripts/parse-statement.mjs` and
   `parse-statement-llm.mjs` (offline statement-failure diagnosis) to
   `tywin-native/scripts/`, fixing their imports. Add `db:types` to the root
   `package.json` pointing at wherever the app's generated Supabase types live.
   `generate-sounds.mjs` is dropped unless the app turns out to use its output.
3. **Repo.** In `tywin`, one commit removes everything except a README that
   says the product moved to `cb-co/tywin-native` and the site to
   `apps/site`. Git history keeps the old code. Push to `main`.
4. **Archive.** `gh repo archive cb-co/tywin` — run only after the user
   confirms at that moment.
5. **User-only steps** (not done by the agent):
   - Delete the Vercel project `tywin` and its domain.
   - Set Supabase Auth Site URL to `https://cigua.quantcoresolutions.com`.
6. **Docs/memory.** Update `tywin-native/README.md` (the site is part of the
   repo; the web app no longer exists) and the agent's project memory that
   still describes `tywin` as the live web app and `/api/v1` backend.

## Risks accepted

- Store badges show "Coming soon" until the listings exist; the landing page
  has no working primary CTA until then. Acceptable: the app isn't in the
  stores yet either way.
- Anyone with the old Vercel URL bookmarked gets whatever Vercel serves after
  deletion (a 404). No redirect is set up. If the user wants one, it's a
  Vercel-side setting they add before deleting the project, not part of this work.
