# Overthought

## Logo and example prompts — 1.0.7 (local preparation, 2026-09-26)

Version `1.0.7` contains the approved Still Typing app icon and welcome-screen symbol, plus 64 refreshed New Case examples with remembered rotation and a “More ideas” control. This is a locally prepared update; no EAS production build, TestFlight submission, or App Store release has been performed for it. The `1.0.6 (28)` statements below record the historical 2026-09-19 checkpoint, not a fresh check of live distribution status.

Verification update (2026-09-26): the iOS 27 startup failure is fixed with a native single-window SceneDelegate. The local Release simulator build, cold launch/relaunch, installed icon, and welcome-screen visual checks passed, as did type checking and all 710 tests. The owner confirmed New Case interactions work. Cold/warm custom-scheme links and background/resume passed on the installed simulator build; the later three-suggestion change passed 82 focused tests and type checking, with another visual check waived by the owner. Production build [1.0.7 (29)](https://expo.dev/accounts/alexremington/projects/overthought/builds/a2f76d95-9ee3-4408-a028-2d1bca13215b) was started with owner approval and is queued on EAS. No TestFlight submission was performed. See the 1.0.7 checklist for evidence and remaining checks.

Product decisions (2026-09-26): cached guest duplicate cases are **pending—deferred for future work**, with current behavior accepted for this release. Saved Deep Read compatibility after legacy upgrade is **closed by product decision—legacy compatibility not required**, because the product owner confirms there are no existing users. Neither issue was technically fixed; legacy code remains in place. See the [1.0.7 release checklist](docs/marketing/app-store/1.0.7/en-US/release-checklist.md) for verification results and the remaining release steps.

Overthought is an iOS-first Expo React Native app for analyzing social overthinking as structured cases. The corrective Smart-only client is live in TestFlight as `1.0.6 (28)`. Its quota presentation, branded limit modals, authoritative allowance refresh, Smart-only failure behavior, and activity timestamps were physically tested. A cached-result quota bypass found during that pass was fixed server-side and confirmed on device. Build 28 has not been released to the App Store. The final audit findings for guest duplicates and legacy Deep Read lookup are governed by the 2026-09-26 product decisions above; they are not both awaiting fixes in this release.

## What is included

- Smart-only guest and authenticated case creation with preserved retryable drafts.
- Smart Verdict for new cases, with the deterministic engine retained internally for calibration and rollback.
- Backward-compatible Smart case creation API with server-side validation, quota idempotency, and atomic authenticated persistence.
- Case history, detail, updates, outcomes, and stats.
- Email/password, Apple, and Google authentication scaffolding.
- Optional Supabase sync and RevenueCat integration boundaries.

## Technology

- Expo 55 and React Native 0.83.
- Expo Router and TypeScript.
- Zustand with `react-native-mmkv`.
- Supabase for optional authentication, data sync, and backend functions.

## Run locally

This project requires an Expo development build or native iOS build. It does not run in Expo Go because `react-native-mmkv` uses native modules.

```sh
npm install
cp .env.example .env
npm run ios
```

Supabase values are optional for guest mode. See the [development and release guide](docs/development-and-release.md) for environment variables, physical-device setup, authentication providers, EAS, and TestFlight notes.

## Validate

```sh
npm run typecheck
npm test
```

The Phase 2 corrective backend was deployed to the existing production Supabase project on 2026-09-19. Migrations are applied through `0012_timestamp_activity_integrity.sql`, the approved historical timestamp repair is complete, and backward-compatible `ai-verdict` version 26 is active. TestFlight build `1.0.6 (28)` was built, submitted, installed, and physically tested. It remains unreleased pending the two final-audit fixes, a fresh regression pass, and explicit App Store approval.

## Documentation

- [Development and release guide](docs/development-and-release.md)
- [API contracts](docs/overthought-api-contracts.md)
- [V1 architecture addendum](docs/overthought-v1-architecture-addendum.md)
- [Verdict engine specification](docs/overthought-verdict-engine-spec.md)
- [Supabase keepalive operations](infra/supabase-keepalive/README.md)

## Security

Do not commit `.env` files or privileged credentials. Client builds use only the Supabase publishable key; secret and service-role keys must remain outside the app and repository. After changing a public build-time credential, perform an Expo export with `--clear` and scan the resulting bundle before creating a release build.
