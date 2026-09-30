# Phases 4–5: native-only value and store launch

Date: 2026-09-29
Status: not started. Carried over from the master migration plan
(`cb-co/tywin` history, `docs/plans/2026-09-14-expo-native-migration.md`) and
updated for how the app is actually built. Each item still needs its own
design and implementation plan before work starts.

## Where the migration stands

- Phases 0–3 and offline level 1 are done: every screen is native, screens load
  through the Worker (`GET /v1/screens/:screen`) and are cached per person in
  SQLite, and the web app is retired (`cb-co/tywin` archived).
- The public site is live at https://cigua.quantcoresolutions.com (`apps/site`),
  with "Coming soon" store badges.
- Settled: bundle/package ID `app.tywin.cigua`, scheme `cigua`, EAS project
  `cm-corps-team/cigua`, and `development`/`preview`/`production` build profiles
  in `apps/mobile/eas.json`.

Differences from the original plan: there is no Next.js/Vercel backend any more
(anything scheduled or secret runs in the Worker), the app never writes to
Supabase directly, and statement PDFs are read on the phone.

## Phase 4: native-only value (optional before launch)

1. **Share sheet / "Open in Cigua" for statement PDFs.** Receive a PDF from the
   bank app, mail or Files and hand it to the existing on-device reader
   (unpdf + scrub), then the normal review screen. iOS needs a share extension
   (config plugin, App Group for passing the file); Android needs an intent
   filter for `application/pdf`. This is the biggest activation win.
2. **Biometric app lock** (`expo-local-authentication`), off by default, toggled
   in Settings. Lock on cold start and after N minutes in the background. Hide the
   app switcher snapshot while locked. People expect this from a finance app.
3. **Push notifications** (`expo-notifications`): card due dates, "quincena
   landed, here's what's safe to spend", crossing a budget.
   - `push_tokens` table (RLS, one row per device, pruned on sign-out and on
     `DeviceNotRegistered` receipts). Migration pushed by the user.
   - Sender: a Cron Trigger on the Worker (`triggers.crons` in
     `apps/worker/wrangler.jsonc`) that finds due events and calls the Expo push API.
     Replaces the "Supabase Cron + Edge Function, or a Vercel cron route" option.
   - Per-type opt-in in Settings; en+es copy; help-guide entry.
4. **Home-screen widget** for safe-to-spend (later; needs native targets on both
   platforms, so it goes after launch).

## Phase 5: ship (~1 week plus store review)

1. **Builds.** `eas build --profile production` for iOS and Android; the three
   `EXPO_PUBLIC_*` values set as EAS `production` environment variables. The
   Worker's production vars and secrets are set first (see README).
2. **Internal testing.** `eas submit` to TestFlight and Play internal testing.
   Play requires a closed test with testers for 14 days before a new personal
   developer account can go to production, so start this early.
3. **Store listings** in es-DO and en:
   - Privacy labels / Data safety form: financial info, email, and what the Worker
     sends to Gemini (scrubbed statement text, Ask questions).
   - Privacy policy URL `https://cigua.quantcoresolutions.com/privacy` (and `/es/privacy`).
   - Account deletion: in-app (Settings) already exists. Play also asks for a
     web URL that explains how to delete, so add a section to the site or the privacy page.
   - A reviewer demo account with a pre-imported statement, and Apple sign-in
     working (guideline 4.8, since Google sign-in is offered).
4. **OTA updates.** Add `expo-updates`, a `runtimeVersion` policy (`fingerprint`
   or `appVersion`) and channels per build profile. Bump the runtime whenever
   native dependencies change.
5. **Crash and performance monitoring**: EAS Observe or Sentry, before the first
   public build.
6. **After approval.** Put the listing URLs in `apps/site/src/config.ts` and run
   `npm run deploy:site` so the badges become links.
7. **Monetization note.** If Cigua ever charges inside the app, both stores
   require in-app purchase (e.g. RevenueCat), not Stripe. Decide before the first
   paid feature, not during review.

## Risks

| Risk | Mitigation |
|---|---|
| Play's 14-day closed-test rule delays launch | Start internal/closed testing as soon as a production build exists |
| Review rejection for a missing demo account or Apple sign-in | Demo account with data in the review notes; test Apple sign-in on a production build |
| An OTA update needing native code crashes older installs | `runtimeVersion` policy; native changes ship only through store builds |
| Push sender spams or double-sends | One send log row per event per device, checked before sending |
| Gemini cost at launch | Per-user rate limits already on statements and Ask; keep flash-lite as default |
