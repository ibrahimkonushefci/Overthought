# Overthought

Overthought is an iOS-first Expo React Native app for analyzing social overthinking as structured cases. The v1 flow uses AI Verdict when access and quota allow, falls back to a deterministic Basic Verdict, supports guest mode, and includes optional Supabase auth/sync and RevenueCat-ready premium boundaries.

## What is included

- Guest case creation and local persistence.
- AI Verdict with a deterministic local fallback.
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

## Documentation

- [Development and release guide](docs/development-and-release.md)
- [API contracts](docs/overthought-api-contracts.md)
- [V1 architecture addendum](docs/overthought-v1-architecture-addendum.md)
- [Verdict engine specification](docs/overthought-verdict-engine-spec.md)
- [Supabase keepalive operations](infra/supabase-keepalive/README.md)

## Security

Do not commit `.env` files or privileged credentials. Client builds use only public Supabase anonymous credentials; service-role keys must remain outside the app and repository.
