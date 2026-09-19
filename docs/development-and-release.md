# Overthought development and release guide

iOS-first Expo React Native foundation for Overthought, a case-based app for analyzing social overthinking. Corrective build `1.0.6 (28)` is live in TestFlight and passed the core physical-iPhone corrective flow. The App Store release is intentionally paused. A final repository review found release blockers in cached guest duplicate handling before exhaustion and saved Deep Read lookup after a legacy case is upgraded; fix and regress those in a separate task before requesting release approval.

## Smart-only rollout boundary

Phase 1 added migrations `0009` and `0010` plus a backward-compatible `ai-verdict` handler. Phase 2 added migration `0011_verified_guest_smart_migration.sql`, the `migrate_guest_case` route, and the Smart-only client. The corrective pass added migration `0012_timestamp_activity_integrity.sql`, the read-only quota-status route, branded allowance UX, and consistent activity timestamps. This sequence is deployed and in TestFlight:

1. Migrations are applied through `0012` in production.
2. Backward-compatible `ai-verdict` version 26 is active.
3. Corrective build `1.0.6 (28)` is live in TestFlight.
4. Physical testing confirmed the main guest, signed-in, quota, draft-protection, cached-quota, and timestamp/activity flows.
5. Re-run the relevant matrix after the next change before requesting App Store release.

Production status (2026-09-19): migrations are applied through `0012_timestamp_activity_integrity.sql`; the approved, allowlisted repair corrected the confirmed two-hour historical timestamp offset without rewriting ambiguous rows; and backward-compatible `ai-verdict` version 26 is active. Build `1.0.6 (28)` is live in TestFlight but not released to the App Store.

Validation status (2026-09-19): type checking, 630 Jest tests, local migration reset through `0012`, four pgTAP checks, Expo dependency validation, and a production Release simulator build passed. Build `1.0.6 (28)` then passed its main physical-device corrective flow. A cached-result quota bypass discovered on device was fixed in Edge version 26 and confirmed without another client build.

Credential status (2026-09-19): local and EAS production configuration use the Supabase publishable key. The compromised default secret key was deleted after a dependency inventory found no active consumer. A clean `expo export --clear` bundle scan found the publishable key, no exact copy of the revoked key, and no secret-key credential. Cached copies may remain in local editor/Codex history, but they are revoked and are not active build inputs.

The migration is additive. It preserves the old endpoint, Basic columns, AI cache tables, local engine, and Deep Read data so the previous client remains usable.

## Run Locally With A Development Build

This app does **not** target Expo Go. It uses `react-native-mmkv` v4, which depends on Nitro/native modules, so it must run in an Expo development build or a normal native iOS build.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Add environment values:

   ```sh
   cp .env.example .env
   ```

   Supabase keys are optional for guest mode. Email login and authenticated sync need:

   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_SUPABASE_REDIRECT_URL`

   Apple Sign In is available behind an explicit flag after Apple Developer and Supabase provider setup:

   - `EXPO_PUBLIC_ENABLE_APPLE_AUTH=false`

   Native Google Sign-In is also behind an explicit flag:

   - `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=false`

   Enable it only after Google Cloud and Supabase provider setup. Native Google sign-in also needs:

   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` as the reversed iOS client ID, for example `com.googleusercontent.apps.1234567890-abcdef`, not the normal `...apps.googleusercontent.com` client ID.

   In Supabase Auth > Providers > Google, include the web, dev iOS, and production iOS client IDs. For native iOS Google Sign-In, enable `Skip nonce check`; the React Native Google Sign-In SDK used here does not expose a matching raw nonce to pass through to Supabase.

   Profile legal links use:

   - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
   - `EXPO_PUBLIC_TERMS_URL`

3. Build and run the iOS development app on a simulator:

   ```sh
   npm run ios
   ```

4. Build and install the iOS development app on a physical iPhone:

   ```sh
   npm run ios:device
   ```

   Choose your connected iPhone when prompted. For local physical-device development, Xcode signing must be configured for the current dev bundle identifier:

   - `com.ibrahim.overthought.dev`

   This is intentionally a development bundle ID. TestFlight/App Store builds use the production bundle identifier `com.ibrahim.overthought` via `APP_VARIANT=production`.

   If the device install fails with a signing or bundle identifier error:

   - Open `ios/Overthought.xcworkspace` in Xcode.
   - Select the `Overthought` target, then Signing & Capabilities.
   - Choose your Apple account/team.
   - Confirm the bundle identifier is `com.ibrahim.overthought.dev`.
   - Make sure the provisioning profile Xcode creates or selects also matches `com.ibrahim.overthought.dev`.
   - If an older Overthought app is already installed on the iPhone, delete it from the phone before reinstalling.
   - Do not run `npm run prebuild:ios` just for signing cleanup; the Expo config and native Xcode bundle identifiers already match.

5. Start Metro for an already-installed development build:

   ```sh
   npm start
   ```

   Local development defaults to the development bundle identifier:

   - `com.ibrahim.overthought.dev`

   If the dev build is already installed on your phone, open that app, not Expo Go. Pressing `i` from Expo CLI should target the installed `.dev` development build.

6. Clear Metro cache if the phone keeps loading stale JavaScript:

   ```sh
   npm run start:clear
   ```

### Local Smart-only simulator verification

Use the local Supabase stack when checking Smart-only creation without calling Gemini or spending production quota:

1. Start Docker Desktop, then run `npx supabase start` from the repository.
2. Create a temporary env file outside the repository containing only `AI_VERDICT_LOCAL_MOCK=true`.
3. Serve the function with `npx supabase functions serve ai-verdict --env-file <temporary-file> --no-verify-jwt`.
4. Run the development client with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set to the local API URL and local anonymous key reported by `npx supabase status`.

The simulator mock is deliberately unavailable for non-local Supabase URLs, even if `AI_VERDICT_LOCAL_MOCK` is set. It returns a clearly labeled deterministic Smart snapshot for end-to-end UI and persistence testing; it is not a Gemini-quality check. Do not place a production service-role or secret key in the temporary file, Expo environment, app bundle, or repository.

The local verification sequence is:

- create and reopen a guest Smart case;
- stop the local function, submit a different draft, and confirm the error preserves the draft without creating a Basic case;
- restart the function, create a disposable local account, and create a signed-in Smart case;
- open a seeded legacy Basic case and confirm its label, light presentation, and explicit upgrade action.

### EAS development build option

Use EAS when you want to install the dev build without a local Xcode device build, distribute it to another device, or avoid local signing issues:

```sh
npx eas login
npx eas device:create
npx eas build --profile development --platform ios
```

After installing the EAS development build on the phone, start Metro locally:

```sh
npm start
```

Then open the installed Overthought development build on the iPhone.

### TestFlight bundle identity

Local development builds default to:

- `com.ibrahim.overthought.dev`

Production/TestFlight config uses:

- `com.ibrahim.overthought`

The EAS `production` profile sets `APP_VARIANT=production`, which makes `app.config.js` use the production bundle identifier. Apple Sign In is wired natively but remains hidden unless `EXPO_PUBLIC_ENABLE_APPLE_AUTH=true`; native Google Sign-In remains hidden unless `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true`.

Local development leaves `APP_VARIANT` unset, so Expo config uses `com.ibrahim.overthought.dev` and disables premium/RevenueCat even if RevenueCat keys exist in a local `.env`. Production/TestFlight builds use `APP_VARIANT=production`; premium is only enabled there when `EXPO_PUBLIC_ENABLE_PREMIUM=true`.

Production iOS builds use Hermes V1. Corrective build `1.0.6 (28)` was submitted successfully to TestFlight and physically tested, but has not been released to the App Store. Any client change after this checkpoint requires a new build number and a focused regression pass. Keep `ios/Podfile.properties.json` set to `"expo.useHermesV1": "true"` and keep `babel-preset-expo` on the Expo 55-compatible line (`~55.0.22`) until the whole Expo SDK is upgraded. After native dependency or Hermes changes, prefer a clean EAS retry:

```sh
npx eas build --profile production --platform ios --clear-cache
```

After a separately approved successful build, submit that exact build rather than relying on an ambiguous latest build:

```sh
npx eas submit --platform ios --profile production --id <eas-build-id>
```

Build, TestFlight submission, production backend deployment, production data repair, credential changes, and App Store release are separate approval gates. A successful preflight or build does not authorize the next gate.

### Production/TestFlight auth environment

Before the next TestFlight build that ships Apple and Google sign-in, set the production EAS environment to:

- `APP_VARIANT=production`
- `EXPO_PUBLIC_ENABLE_APPLE_AUTH=true`
- `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Google web OAuth client ID>`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<Google iOS OAuth client ID for com.ibrahim.overthought>`
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=<reversed Google iOS client ID for com.ibrahim.overthought>`

Also confirm external provider setup:

- Supabase Auth Site URL is `https://overthought.app`, not a local Metro URL.
- Supabase Auth redirect URLs include `overthought://auth` and `overthought://reset-password`.
- Supabase Auth custom SMTP is enabled for production email, currently via the verified Resend domain `mail.overthought.app`.
- Confirm Signup and Reset Password templates use `{{ .ConfirmationURL }}` and clearly say the link opens Overthought.
- Password reset emails should contain `redirect_to=overthought://reset-password`, not a local Metro URL.
- Apple Developer has Sign in with Apple enabled for `com.ibrahim.overthought`.
- Supabase Apple provider allows the production bundle ID.
- Supabase Google provider includes the web, dev iOS, and production iOS client IDs.
- Supabase Google provider has `Skip nonce check` enabled for native iOS Google Sign-In.

Confirm the active bundle identifiers with:

```sh
npx expo config --type public
APP_VARIANT=production npx expo config --type public
```

## What is implemented

- Expo Router route structure for public auth, tabs, case detail, add update, result redirect, paywall placeholder, and delete-account flow.
- Palette-backed theme tokens and reusable UI primitives.
- Guest persistence with Zustand, `persist`, and `react-native-mmkv`.
- Supabase client wiring with environment handling.
- Auth/session scaffolding for guest, email/password, forgot/reset password, native Apple Sign In, and native Google Sign-In.
- Repository/service boundaries for cases, updates, profiles, premium, migration, share payloads, and deterministic analysis.
- Smart-only new-case creation: a case is saved only after Smart Verdict succeeds, with a preserved retryable draft on failure.
- Canonical Smart/legacy result reads for history, detail, and Stats.
- Explicit historical Basic-to-Smart upgrade and read-only saved Deep Read legacy display.
- Server-verified Smart guest migration with lossless legacy fallback for unverifiable older records.
- Base screens aligned to the supplied design references: welcome, home, new case, cases, case detail/result, add update, stats, profile, delete account.

## Native setup still required

- Configure Supabase project URL/key and apply the SQL files under `supabase/migrations/`.
- Use an iOS development build, not Expo Go, because MMKV/Nitro requires native pods and New Architecture codegen.
- Enable Sign in with Apple for both Apple Developer App IDs: `com.ibrahim.overthought.dev` and `com.ibrahim.overthought`.
- Enable the Supabase Apple provider and add both bundle IDs as allowed native client IDs before setting `EXPO_PUBLIC_ENABLE_APPLE_AUTH=true`.
- Configure Google OAuth client IDs, the reversed iOS URL scheme, and the Supabase Google provider before setting `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true`. For native iOS Google Sign-In, the Supabase Google provider must have `Skip nonce check` enabled.
- Rebuild the native iOS app after changing `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`; the scheme is embedded in `Info.plist`.
- Configure RevenueCat products/API keys for TestFlight and validate purchase/restore end to end.
- Verify the deployed `delete-account` Supabase Edge Function before each release build; it performs final `auth.users` deletion for authenticated account deletion.
- Rebuild the iOS development build after changing native auth credentials or config plugins.

## Test immediately

- Continue as guest.
- Create a case online and see only a Smart Verdict after it is saved.
- Retry an offline or failed submission and confirm the text/category remain filled in and no case appears in history.
- View the case in history and detail.
- Open a historical Basic case and confirm it is labeled `Legacy Basic Verdict`; upgrade it only by tapping the explicit action.
- Open a case with a previously saved Deep Read and confirm it is shown read-only as `Saved Deep Read (legacy)`.
- Add a light update and see it on the case timeline (v1 stores the update as a receipt; it does not re-run the verdict).
- Mark outcome status.
- View Stats and confirm each case contributes its currently visible canonical score.
- Sign in with guest history and verify Smart cases remain Smart while Basic-only history migrates without loss.
- Delete guest local data.

## Test Commands

```sh
npm run typecheck
npm test
```

## Next build pass

- Migrations are deployed through `0012`, and `ai-verdict` version 26 is active.
- TestFlight build `1.0.6 (28)` is the current corrective checkpoint; it is not an App Store release.
- After the next product change, increment the build number, rerun automated/native preflight, and repeat the affected guest, signed-in, quota/cache, offline, timestamps/activity, legacy, migration, accessibility, and cross-device checks before release.
- App Store submission/release remains blocked until the user gives explicit approval.
- The existing unified AI quota migration remains deployed; no pricing or quota amount changes are part of Phase 2.
- Keep richer profile fields as a future schema + type + repository + UI phase.
- Investigate Supabase email deliverability/custom SMTP if confirmation emails continue going to junk.
