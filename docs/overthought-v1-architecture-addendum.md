# Overthought v1 Architecture Addendum

This addendum clarifies three implementation decisions that should be treated as locked for v1.

## 1. Verdict engine execution model

The deterministic verdict engine must run **fully client-side in v1**.

### Why
- instant verdicts
- guest mode works without a network round trip
- lower cost
- simpler architecture
- easier offline behavior for the core analysis flow

### Rule
- Do not call Supabase or any external service to generate verdicts in v1.
- Supabase is used for auth, profile data, synced cases, premium state, and future expansion.
- The verdict engine remains a local deterministic module.

## 2. Guest-mode local storage stack

Use the following stack for v1 guest persistence:

- **Zustand** for lightweight app state
- **zustand/middleware/persist** for persistence orchestration
- **react-native-mmkv** as the storage backend

### Rule
- Guest cases, guest case updates, draft inputs, lightweight preferences, and local session flags should persist locally through Zustand + persist + MMKV.
- Keep the local persistence layer simple. Do not introduce a heavier local database in v1 unless there is a clear, proven need.

### Suggested scope for local persistence
- guest cases
- guest case updates
- draft case text
- draft update text
- local preferences
- guest identity/session marker
- migration status flags

## 3. Guest-to-account migration

Guest-to-account migration must be **idempotent**.

### Meaning
If migration runs twice because of a retry, reconnect, or app restart, it must not create duplicate synced cases or duplicate updates.

### Rule
- Design migration so it is safe to retry.
- Use stable local IDs or client-generated IDs for guest cases and case updates.
- Mark migrated records carefully.
- Handle partial migration recovery.

## 4. Share-card note

The share card is a growth feature, but it should not be overbuilt in the first foundation pass.

### Rule for v1 foundation
- Define share-card data shape now.
- Keep the rendering implementation simple.
- A good later default is a shareable React Native view that can be captured into an image.

## 5. Practical instruction for Codex

When implementing v1:
- keep the verdict engine local
- keep persistence simple
- keep migration retry-safe
- avoid introducing extra backend dependencies for analysis
- avoid overbuilding the share system in the first pass

## 6. AI Verdict release-hardening note

The current AI-first verdict flow supersedes the original "local-only analysis" rule for the main visible result, while preserving the local verdict as fallback.

`ai-verdict` Edge Function secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

Optional `ai-verdict` quota cap environment variables:
- `AI_VERDICT_SIGNED_IN_FREE_DAILY_LIMIT` defaults to `2`
- `AI_VERDICT_GUEST_LIFETIME_LIMIT` defaults to `2`
- `AI_VERDICT_GUEST_DAILY_LIMIT` defaults to `2`
- `AI_VERDICT_GUEST_IP_DAILY_LIMIT` defaults to `10`
- `AI_VERDICT_GLOBAL_DAILY_LIMIT` defaults to `100`
- `AI_VERDICT_PREMIUM_DAILY_LIMIT` defaults to `50`

### Current release-hardening status

- Premium AI verdict quota is implemented in `ai-verdict`.
- `ai-verdict` reads `premium_states.entitlement_status` and treats `premium` and `grace_period` as premium access.
- Signed-in free users get 2 AI verdicts per UTC day.
- Premium users get the configured premium daily limit, defaulting to 50.
- Guest users get 2 lifetime AI verdicts per local `guestAiKey`, plus the guest daily, IP daily, and global caps.
- `Profile -> Delete all data` clears the local `guestAiKey`; this intentionally resets guest AI access for TestFlight/v1.
- For live hardening later, revisit guest abuse controls if IP/global caps are not enough. Do not preserve a hidden guest identifier after an explicit "Delete all data" action without changing the privacy/product copy.
- Deep Read is locked after AI Verdict quota/cap exhaustion and after concrete AI Verdict fallback failures so a Basic fallback does not expose an extra AI generation path.
- A one-off case save error was seen during manual testing but could not be reproduced after retry. Do not chase it unless `[case-create] case_create_supabase_insert_failed` logs show a repeatable cause.
- `ai-verdict` now retries malformed Gemini response shapes once in strict JSON mode, uses Gemini `responseSchema`, and logs safe provider diagnostics without raw prompt, case text, or raw model output.
- Failed provider/schema responses remain `status = failed` usage events and do not consume successful AI verdict quota.
- Gemini AI verdict generation allows up to 2048 output tokens. The client waits up to 30 seconds for `ai-verdict`; if an authenticated request still times out locally, the case detail screen does short delayed stored-verdict checks so a late backend success can replace the Basic fallback instead of wasting visible quota.

## 7. Auth release-hardening note

- Apple sign-in and Google sign-in remain supported.
- Email auth now uses email/password sign-in and account creation in the app.
- Forgot password has its own public screen and uses Supabase password recovery with `overthought://reset-password` as the app redirect.
- The password reset redirect is intentionally hardcoded in the app to avoid local Metro URLs such as `http://localhost:8081` leaking into reset emails.
- Password recovery links create a temporary Supabase session; public auth screens must not auto-route that session to Home while `/reset-password` is active.
- Supabase Auth redirect URLs must include `overthought://reset-password` before testing password reset links.
- Magic-link email is no longer the primary app UI path.
- If Supabase email confirmation is enabled, email/password sign-up may still require the user to confirm by email before signing in.
- Email deliverability and confirmation-link polish remain later backlog unless they block manual testing.

## 8. Profile fields decision

- Extra profile fields are deferred for the current TestFlight/v1 pass.
- Minimal v1 profile editing uses the existing nullable `profiles.display_name` column only. Authenticated users can update display name from the Profile screen; blank values are stored as `null`, and the app falls back to email prefix, then `Account`.
- Do not add first name, last name, nickname, country, or broader profile settings without a schema migration.
- Minimal future migration should add nullable profile columns only, preserving existing accounts:
  - `first_name text`
  - `last_name text`
  - `nickname text`
  - `country_code text`
- Display naming should remain backwards-compatible: prefer nickname if present, then full name, then existing `display_name`, then email prefix.
- Implementation should update the shared `Profile` type, `profileRepository`, auth session profile mapping, profile edit UI, and repository tests in the same phase as the migration.

## 9. Current stabilization and build status

This section records the late v1 stabilization pass completed before the next handoff.

- AI Verdict is the main enhanced output when quota/access allows; the deterministic local Basic Verdict remains the fallback.
- AI Verdict prompt version is `3`, Gemini temperature is `0.8`, and generated AI text is cleaned for markdown artifacts before display/storage.
- `ai-verdict` was deployed after the stabilization commit containing quota, tone, and fallback fixes.
- Guest and signed-in free quota UX now shows upgrade/retry prompts for `quota_exceeded` cases without auto-consuming AI quota when old cases are reopened.
- Old Basic fallback cases caused by AI quota exhaustion can show "Try AI Verdict" after quota reset.
- Deep Read is derived from durable AI Verdict request/fallback state and remains locked after restart when AI Verdict quota/cap/fallback state blocks extra AI access.
- Case list ordering and relative time display were normalized; list score/verdict display overlays saved AI Verdict snapshots where present.
- Guest-to-account migration preserves the visible guest AI Verdict snapshot locally where possible instead of silently downgrading the visible result to Basic.
- Auth create-account success UX now clears fields, switches back to Sign In, and avoids an error-like success alert.
- New Case defaults back to Romance for a fresh case; category pills were tightened.
- Paywall copy/layout was improved for TestFlight without changing RevenueCat purchase internals.
- RevenueCat restore/purchase validation confirmed that Premium follows the App Store/RevenueCat receipt for the current Apple ID. Restoring or upgrading while signed into another Overthought account on the same Apple ID can mark that account premium too; this is accepted for v1 as normal restore behavior.
- `sync-premium-state` successfully updates `premium_states.entitlement_status` to `premium` after RevenueCat reports an active entitlement for the currently signed-in Supabase user. Because `ai-verdict` reads `premium_states`, that user receives the premium AI Verdict tier after sync.
- AI Verdict and Deep Read now use the same signed-in daily AI pool in both directions. Premium users get 50 total generated AI reads per UTC day by default across AI Verdict and Deep Read combined; cached AI/Deep Read results reopen without spending quota. Migration `0006_unified_ai_read_quota.sql` has been applied, and the updated `ai-verdict` Edge Function has been deployed.
- The client-side fix that ignores stale free-tier quota locks after a premium upgrade is committed for the next TestFlight build. The guest -> free user -> premium upgrade retest is intentionally deferred.
- The production iOS build was rebuilt with `--clear-cache`, submitted successfully to TestFlight, and opens correctly on physical TestFlight devices.
- Expo SDK patch packages are aligned on the Expo 55 line. Production iOS uses Hermes V1 via `ios/Podfile.properties.json` (`expo.useHermesV1=true`) and `ios/Podfile.lock` records `hermes-engine 250829098.0.4`.
- `babel-preset-expo` must stay on the Expo 55-compatible line (`~55.0.22`) unless the whole Expo SDK is upgraded.

Known remaining open items:
- Email confirmation messages going to junk are likely Supabase email deliverability/custom SMTP/DNS work, not an app-code bug unless redirect URLs are wrong.
- Richer profile fields beyond `display_name` are not implemented and should be handled as a schema + type + repository + UI phase.
- Stricter one-subscription-to-one-Overthought-account transfer handling is deferred unless the v1 product policy changes.
