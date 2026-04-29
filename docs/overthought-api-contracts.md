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

### `deepReadService` (future)
Responsibilities:
- request AI Deep Read enrichment through a backend function only
- return cached Deep Reads without spending quota
- keep local verdict fields canonical
- keep guest Deep Read output local-only in v1
- expose available, loading, cached, locked, and failed states to the result screen

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
- `ai_deep_reads` for authenticated cached AI enrichment
- `ai_deep_read_usage_events` for server-side quota accounting

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

## 11. AI Deep Read contracts

Deep Read is the AI enrichment layer. It must not replace the deterministic local verdict engine.

### Product rule
The canonical case result remains:
- `verdictLabel`
- `delusionScore`
- `explanationText`
- `nextMoveText`
- `verdictVersion`

Deep Read adds a richer explanation below the local verdict. It should never override the stored local verdict fields in v1.

### Backend rule
The mobile app must not call the AI provider directly.

Deep Read generation should go through a secure backend path, preferably a Supabase Edge Function. Provider secrets such as `GEMINI_API_KEY` must exist only as backend secrets.

### Request shape
For a case-level Deep Read:

```ts
{
  target: {
    targetType: 'case';
    caseId: string;
    category: CaseCategory;
    inputText: string;
    localVerdictLabel: VerdictLabel;
    localDelusionScore: number;
    localVerdictVersion: number;
  };
  guestLocalId?: string;
}
```

For authenticated users, the future Edge Function should prefer `caseId` and fetch the case from Supabase before generation. Client-provided case text is useful for shared contracts, guest local caching, and tests, but authenticated ownership and active-case checks should use server data.

For guests, cases are local-only, so the client must provide the target snapshot. Guest AI output should remain local-only in v1; the backend may track hashed guest usage events without storing generated text.

### Response shape

```ts
{
  ok: true;
  deepRead: {
    whatsActuallyHappening: string;
    whatYoureOverreading: string;
    whatEvidenceActuallyMatters: string;
    whatToDoNext: string;
    roastLine: string;
  };
  cache: {
    id: string;
    source: 'cache' | 'generated';
    targetType: 'case' | 'case_update';
    targetFingerprint: string;
    modelProvider: string;
    modelName: string;
    modelVersion: string | null;
    promptVersion: number;
    responseSchemaVersion: number;
    createdAt: string;
  };
  access: {
    accessTier: 'guest' | 'free' | 'premium';
    allowed: boolean;
    remaining: number | null;
    limit: number | null;
    quotaBucket: string | null;
  };
}
```

Failures should use:

```ts
{
  ok: false;
  code:
    | 'not_authenticated'
    | 'case_not_found'
    | 'deep_read_not_configured'
    | 'quota_exceeded'
    | 'fair_use_exceeded'
    | 'ai_timeout'
    | 'ai_failed'
    | 'invalid_ai_response'
    | 'cache_write_failed'
    | 'unknown';
  message: string;
  access?: DeepReadAccessState;
}
```

### Cache fingerprint
Deep Read cache keys should use a deterministic SHA-256 hex fingerprint over canonical JSON.

For case reads, include:
- `targetType`
- `category`
- normalized `inputText`
- local `verdictLabel`
- local `delusionScore`
- local `verdictVersion`

For future update reads, include:
- all case-read fields
- normalized `updateText`
- `caseUpdateId` or a stable local update id where available

The fingerprint should not include raw user id. Authenticated cache uniqueness is enforced by `user_id` plus fingerprint and model metadata. Guest cache uniqueness is local-only.

Cache lookup must include:
- `target_fingerprint`
- `model_provider`
- `model_name`
- `prompt_version`
- `response_schema_version`

Changing the model, prompt, or response schema intentionally creates a new cache line.

### Database tables

`ai_deep_reads` stores authenticated cached AI outputs.

Important fields:
- `user_id`
- `case_id`
- `case_update_id` nullable for case-level reads
- `target_type`
- `target_fingerprint`
- local verdict metadata
- model/prompt/schema metadata
- `response_json`

`ai_deep_read_usage_events` stores quota/accounting events.

Important fields:
- `user_id` for free/premium users
- `guest_key_hash` for guest usage tracking
- `access_tier`
- `target_type`
- `target_fingerprint`
- `quota_bucket` as a UTC date
- `status`
- `ai_deep_read_id` when succeeded
- `failure_code`
- timestamps for reservation, finalization, and expiry

### Quota rules
Cache hits should return before spending quota.

Only `succeeded` usage events count against quota:
- guest: 1 total AI Deep Read
- free signed-in: 2 successful AI Deep Reads per UTC day
- premium: generous access with internal fair-use protection

Failed calls must not count against quota. Timeout, provider errors, malformed JSON, validation errors, and cache write failures should finalize the event as `failed`.

Generation attempts may create a `reserved` event before calling the provider. A validated generated result should mark the event `succeeded` and link `ai_deep_read_id`. Hung reservations can later be marked `expired`.

### RLS and ownership
Authenticated users may read their own cached Deep Reads only when the parent case is active and owned by them.

Client writes to Deep Read tables should not be allowed. Future Edge Functions should use the service role after:
- verifying the caller token
- checking case ownership
- rejecting archived/deleted cases
- checking cache before quota
- enforcing quota before generation

Usage events are server-managed and should not be client-readable in v1.

### Deletion behavior
Account deletion cascades Deep Read cache and usage data through `user_id`.

Hard-deleting cases cascades case-level Deep Reads through `case_id`.

Current `Delete all cases` soft-archives cases. Future Deep Read reads should ignore cached rows whose parent case is archived or deleted. Guest `Delete all cases` should clear local guest Deep Read cache when that local cache is implemented.

---

## 12. Account deletion requirement

Because the app supports account creation, include a real account-deletion flow in settings.

Suggested behavior:
- confirm destructive action
- delete personal tables or mark them deleted
- delete auth user
- sign out and clear local app state

Codex should make this review-safe for iOS.

---

## 13. What should be left to Codex

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
