# Overthought - API and Data Contract Notes for Codex

This file defines the minimum backend/app contracts that should be treated as stable in v1.
The goal is to make the app expansion-ready without overbuilding.

## 1. High-level rule

Use **local-first guest mode** and **server-backed authenticated mode**.

That means:
- guest users analyze and save cases on-device
- authenticated users analyze and save cases in Supabase
- guest cases can later be migrated to the signed-in account

This avoids forcing login while preserving upgrade paths.

---

## 2. Suggested responsibility split

### Client app
Owns:
- guest case storage
- form validation
- routing
- optimistic UI where useful
- migration trigger after sign-in
- share-card rendering

### Supabase database
Owns:
- authenticated user data persistence
- RLS-based access control
- premium state persistence
- profile/preferences storage

### Edge Functions
Use only where it simplifies architecture.

Recommended v1 functions:
1. `migrate-guest-cases`
2. `revenuecat-webhook` (stub now, complete later)

If Codex prefers, the deterministic verdict engine can also run on-device for guest mode and on the server for authenticated mode. The interface should stay the same either way.

---

## 3. Stable analysis contract

### Function: `analyzeCase(input)`

Input:
- `category`
- `inputText`
- optional `previousCaseContext`
- optional `updateText`

Output:
- `verdictLabel`
- `delusionScore`
- `explanationText`
- `nextMoveText`
- `verdictVersion`
- optional `triggeredSignals` in debug mode only

### Rule
The rest of the app should not care whether the result came from:
- local rule engine
- edge function
- hybrid AI later

Keep the interface stable.

---

## 4. Suggested repositories / services

Codex should implement these as separate modules or hooks.

### `authService`
Responsibilities:
- continue as guest
- sign in with Apple
- sign in with Google
- sign in with email
- sign out
- delete account
- return current auth state

### `guestSessionService`
Responsibilities:
- generate stable `localGuestId`
- persist guest session locally
- detect whether guest data needs migration
- clear migrated guest data only after success

### `analysisService`
Responsibilities:
- accept `AnalyzeCaseInput`
- call local analysis implementation
- return normalized `AnalysisOutput`

### `caseRepository`
Responsibilities:
- create case
- list cases
- get case detail
- archive case
- update outcome
- delete case (soft delete)

Implementation should have two backends:
- local backend for guest users
- Supabase backend for authenticated users

### `caseUpdateRepository`
Responsibilities:
- add update
- list updates for case

Also dual-backed:
- local for guest
- Supabase for authenticated

### `premiumService`
Responsibilities:
- read entitlement state
- expose `isPremium`
- remain functional even before paywall is launched

### `migrationService`
Responsibilities:
- read all local guest cases
- upload to server after login/signup
- map local IDs to server IDs
- avoid duplicate migrations
- return success/failure per case

---

## 5. Storage strategy

### Guest mode
Use local storage or an on-device DB.

Preferred:
- Zustand + zustand/middleware/persist + react-native-mmkv for structured data
- MMKV only for tiny session flags / IDs

Guest mode should support:
- save case history
- add updates
- mark outcome
- basic stats derived from local data

### Authenticated mode
Use Supabase tables:
- `profiles`
- `user_preferences`
- `premium_states`
- `cases`
- `case_updates`

---

## 6. Create-case flow contract

### For guest user
1. user submits `CreateCaseInput`
2. app runs `analysisService.analyzeCase`
3. app stores result in local case storage
4. result screen opens

### For authenticated user
1. user submits `CreateCaseInput`
2. app runs `analysisService.analyzeCase`
3. app inserts `cases` row in Supabase
4. result screen opens

### Important
Do not make the result screen depend on the save succeeding.
Result should be renderable from memory immediately, then persisted.

---

## 7. Add-update flow contract

### Definition
This is **not chat**.
It is just a lightweight update attached to an existing case.

### Flow
1. user opens case detail
2. taps `Add update`
3. writes short update
4. app sends:
   - original case context
   - latest verdict context
   - update text
5. app receives a new analysis result
6. app stores:
   - `case_updates` row
   - updated summary fields on the parent `cases` row
   - incremented `latest_verdict_version`

### Recommended parent-case update behavior
After each update, refresh the parent case with the latest generated verdict fields so list screens stay simple.

---

## 8. Guest migration contract

### Trigger
After successful sign-in or sign-up, if local guest data exists, prompt:
- `Move your saved cases to your account?`

### Migration behavior
- create server `cases` rows first
- then create `case_updates` rows per migrated case
- preserve created timestamps where practical
- mark local entries as migrated
- only delete local copies after confirmed success

### Idempotency requirement
Migration should be safe to retry.
Codex should use a migration marker or mapping table locally so the same guest case is not duplicated on repeated attempts.

---

## 9. Minimal query patterns

### History screen
Need:
- paginated list of latest active cases
- sorted by `updated_at desc`
- optional filter by category

### Case detail screen
Need:
- parent case record
- ordered updates by `created_at asc`

### Stats screen
For v1 keep it simple.
Derived values:
- total cases
- average delusion score
- count by category
- count by outcome status
- most recent cases

Stats can be computed client-side at first from fetched records.
No need for heavy SQL views in v1.

---

## 10. Monetization contracts

Monetization should be scaffolded but soft.

### Data rule
`premium_states` is the source of truth on the backend.

### App rule
App should use a simple gate abstraction like:
- `canAnalyzeMoreToday`
- `canUsePremiumInsights`
- `canAccessFutureThemes`

Even if all return `true` in first release, the abstraction should exist now.

---

## 11. Account deletion requirement

Because the app supports account creation, include a real account-deletion flow in settings.

Suggested behavior:
- confirm destructive action
- delete personal tables or mark them deleted
- delete auth user
- sign out and clear local app state

Codex should make this review-safe for iOS.

---

## 12. What should be left to Codex

Codex should still own:
- actual Expo app implementation
- component architecture
- Supabase client wiring
- auth SDK integration
- local DB implementation details
- exact repository code
- tests
- screen-level UI logic
- feature-flag handling

This document only locks the contracts so Codex does not invent a conflicting foundation.
