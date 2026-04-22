# Overthought

iOS-first Expo React Native foundation for Overthought, a case-based app for analyzing social overthinking. The v1 foundation keeps verdicts fully client-side, supports guest mode, and scaffolds optional Supabase auth/sync plus RevenueCat-ready premium boundaries.

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

3. Build and run the iOS development app on a simulator:

   ```sh
   npm run ios
   ```

4. Build and install the iOS development app on a physical iPhone:

   ```sh
   npm run ios:device
   ```

   Choose your connected iPhone when prompted. Xcode signing must be configured for the `com.overthought.app` bundle identifier.

5. Start Metro for an already-installed development build:

   ```sh
   npm start
   ```

   If the dev build is already installed on your phone, open that app, not Expo Go.

6. Clear Metro cache if the phone keeps loading stale JavaScript:

   ```sh
   npm run start:clear
   ```

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

## What is implemented

- Expo Router route structure for public auth, tabs, case detail, add update, result redirect, paywall placeholder, and delete-account flow.
- Palette-backed theme tokens and reusable UI primitives.
- Guest persistence with Zustand, `persist`, and `react-native-mmkv`.
- Supabase client wiring with environment handling.
- Auth/session scaffolding for guest, email magic-link, Apple placeholder, and Google placeholder.
- Repository/service boundaries for cases, updates, profiles, premium, migration, share payloads, and deterministic analysis.
- Local verdict engine integration without changing scoring behavior.
- Base screens aligned to the supplied design references: welcome, home, new case, cases, case detail/result, add update, stats, profile, delete account.

## Native setup still required

- Configure Supabase project URL/key and apply `supabase/migrations/0001_initial_schema.sql`.
- Use an iOS development build, not Expo Go, because MMKV/Nitro requires native pods and New Architecture codegen.
- Set Apple Sign In entitlement and Supabase OAuth/native callback configuration.
- Configure Google OAuth client IDs and native sign-in package.
- Add RevenueCat SDK/API key and wire restore/purchase calls.
- Add a secured Supabase Edge Function for final `auth.users` deletion.

## Test immediately

- Continue as guest.
- Create a case and see a deterministic result.
- View the case in history and detail.
- Add a light update and re-run the local verdict.
- Mark outcome status.
- View stats generated from local cases.
- Delete guest local data.

## Next build pass

- Add dependency-locked native auth implementations.
- Harden authenticated Supabase sync and guest migration prompts.
- Add focused unit tests for verdict integration, migration idempotency, and premium flags.
- Polish visual spacing against device screenshots.
