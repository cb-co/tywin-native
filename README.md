# Cigua for iOS and Android

Cigua: an Expo (React Native) app, the Cloudflare Worker API behind it, and the
public website. The app is the only way into Cigua; the Next.js web app it
replaced (`cb-co/tywin`) is retired. The website is just the landing page and the
legal pages.

```
apps/mobile      Expo SDK 57 app (expo-router, React Compiler, Hermes)
apps/worker      Cloudflare Worker API (Hono), the app's only backend
apps/site        Public site (Astro, static): landing, privacy, terms, in en + es
packages/core    Shared pure logic: money, periods, statements, schemas, messages, design tokens
```

## How it fits together

- **One request per screen.** Each screen loads through
  `GET /v1/screens/:screen`, a Worker loader that runs every query that screen
  needs in parallel. Smart Placement runs the Worker next to the Supabase region,
  so the phone pays one trip across the internet per screen.
- **Writes are actions.** `POST /v1/actions/:module/:name` with `{ "args": [...] }`
  runs one server action as the signed-in person. After a write, the app refreshes
  exactly the screens that action changes (the same set the web revalidates).
- **Row-level security does the authorisation.** The app sends the Supabase
  access token as a bearer token; the Worker queries as that person, so a request
  can only ever see its own rows.
- **Typed end to end.** The app imports the Worker's types
  (`@cigua/worker/api`, type-only, never bundled), so a renamed action or a
  changed screen shape is a compile error in the app.
- **Instant, and usable offline.** Screens are cached per person in SQLite and
  shown immediately on the next visit or launch, then refreshed in the background.
  Tabs are prefetched once the shell settles. Offline, the saved screens stay
  readable and a strip says when they are from.
- **Supabase on the device is Auth only** (`@supabase/auth-js`): sign-in, token
  refresh, sign-out. The session lives in the keychain.

- **Statement PDFs are read on the phone.** pdfjs (unpdf's serverless build)
  extracts the text on the device, including password-protected statements, and
  scrubs personal details from it. Only that text goes to the Worker
  (`statements.parseStatement`), so the PDF and its password never leave the
  phone. Confirming an import posts the reviewed rows as a form to
  `POST /v1/statements/confirm`.

Other routes: `POST /v1/ask` (streamed answers), `POST /v1/recommendation`,
`GET /v1/fx`, `GET /v1/health`.

## Setup

Requires Node 22+, and Xcode or Android Studio for device builds.

```sh
npm install
```

### Worker

```sh
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # fill in
npm run dev:worker                                        # http://localhost:8787
```

`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are the same project the web app
uses. `GOOGLE_GENERATIVE_AI_API_KEY` powers statement reading, Ask and the daily
recommendation. In production, set the two Supabase values as vars in
`wrangler.jsonc` (or the dashboard) and the secrets with `wrangler secret put`:

```sh
cd apps/worker
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
npx wrangler secret put OWNER_EMAIL        # optional
npm run deploy
```

The Worker does no PDF work (the app reads statements), so its requests are
light: mostly waiting on Supabase and Gemini, which does not count as CPU time.
Workers Free fits a personal deployment; move to Workers Paid if you outgrow its
daily request limit.

### App

```sh
cp apps/mobile/.env.example apps/mobile/.env.local        # fill in
npm run dev:mobile
```

`EXPO_PUBLIC_API_URL` is the Worker (use your machine's LAN address on a device).
The app uses native modules (Apple sign-in, SQLite, secure storage), so run it as a
development build rather than in Expo Go:

```sh
cd apps/mobile
npx expo run:ios        # or run:android
```

Release builds go through EAS (`eas build --profile production`), with the three
`EXPO_PUBLIC_*` values set as EAS environment variables.

### Supabase Auth

In the Supabase dashboard (Authentication → URL Configuration), add the app's
redirect to the allowed list:

```
cigua://auth/callback
```

Google sign-in opens the system's auth session and returns there. Sign in with
Apple is native on iOS: enable the Apple provider in Supabase with the app's
bundle ID (`app.tywin.cigua`) as an authorised client ID. Email confirmation links
open the same route in the app.

The base schema and its migrations live with the web app (`cb-co/tywin`,
`supabase/migrations`); this repository reads and writes that same schema.
Changes only the native app needs are in `supabase/migrations` here. Apply each
one to the same project (paste it into the SQL editor) before deploying a Worker
that relies on it.

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

## Checks

```sh
npm run typecheck                  # all three workspaces
npm test                           # core and worker
npm run build -w @cigua/worker     # bundle the Worker without deploying
npm run export:check -w @cigua/mobile   # bundle the app for iOS and Android
```

## Notes

- **Language.** Spanish by default; English when the device is set to English. The
  choice in Settings wins and is remembered. Messages are one catalogue
  (`packages/core/messages`), shared by the app and the Worker.
- **Icons.** Import them from `~/components/ui/icons`, never from
  `lucide-react-native` directly: Metro does not tree-shake, and the package root
  would bundle every icon.
- **Fonts.** Archivo is embedded at build time, one static file per weight and
  width. Text picks a family by weight and width (`face()`), never `fontWeight`.
