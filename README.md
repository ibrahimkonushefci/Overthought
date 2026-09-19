# Overthought

Overthought is an iOS-first Expo React Native app for analyzing social overthinking as structured cases. Phase 2's Smart-only client is implemented and simulator-verified: new cases are saved only after Smart Verdict succeeds, while historical Basic results remain readable as legacy data. The additive Phase 2 backend is already deployed; the App Store version remains on the backward-compatible legacy flow until the Phase 2 client receives a separately approved TestFlight build, physical-device QA, and release approval.

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

The Phase 2 backend was deployed to the existing production Supabase project on 2026-09-19: migrations are applied through `0011_verified_guest_smart_migration.sql`, and backward-compatible `ai-verdict` version 24 is active. Validation-only production checks passed without generating AI, spending quota, or saving cases, and the current App Store client passed guest and signed-in compatibility checks. Version 24 was created automatically when the compromised default secret key was deleted; the deployed function code hash did not change. The Phase 2 client has a verified local simulator development build, but no Phase 2 TestFlight or App Store build has been created.

## Documentation

- [Development and release guide](docs/development-and-release.md)
- [Phase 2 completion handoff](docs/phase-2-completion-handoff.md)
- [API contracts](docs/overthought-api-contracts.md)
- [V1 architecture addendum](docs/overthought-v1-architecture-addendum.md)
- [Verdict engine specification](docs/overthought-verdict-engine-spec.md)
- [Supabase keepalive operations](infra/supabase-keepalive/README.md)

## Security

Do not commit `.env` files or privileged credentials. Client builds use only the Supabase publishable key; secret and service-role keys must remain outside the app and repository. After changing a public build-time credential, perform an Expo export with `--clear` and scan the resulting bundle before creating a release build.
