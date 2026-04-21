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
