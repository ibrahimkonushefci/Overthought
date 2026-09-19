# Overthought - API and Data Contract Notes for Codex

This file defines the minimum backend/app contracts that should be treated as stable in v1.
The goal is to make the app expansion-ready without overbuilding.

## 1. High-level rule

### Smart-only creation contract

The `ai-verdict` function accepts two new targets in addition to the legacy contracts:

- Authenticated: `{ requestId, target: { targetType: 'new_case', category, inputText, title? } }`
- Guest: `{ requestId, guestKey, target: { targetType: 'new_guest_case', category, inputText, title? } }`

`requestId` is stable across ambiguous retries and must change when the draft changes. New input must use an allowed category and contain 30–400 trimmed characters. Safety routing and blocked input-quality/prompt-injection checks happen before local calibration, quota, persistence, or Gemini. Low-context but genuine social cases remain eligible for cautious Smart generation.

Authenticated success creates the case, linked Smart Verdict, and successful usage event in one service-role-only database transaction. Guest success atomically creates the server-verified guest Smart cache and finalizes usage; the client must not add the guest case to local history until that response succeeds. Active duplicate requests return `in_progress`; completed duplicates replay the stored result without another quota spend. Responses include `requestId`, `caseId` (`null` for guests), Smart output, cache metadata, quota state, and the internal calibration snapshot. Raw case text is never written to logs or usage events.

`canonical_case_results` is a security-invoker view. It selects the newest verified Smart row when present and otherwise exposes the stored Basic fields with `result_source = 'legacy_basic'`. Phase 2 uses this view for authenticated list, detail, and Stats reads.

The authenticated `migrate_guest_case` target accepts a guest case snapshot plus `guestKey` and the server-issued guest Smart cache ID. The Edge Function hashes the guest key and calls the service-role-only `migrate_verified_guest_smart_case` transaction. AI text is copied only from the verified guest cache; client-supplied AI text is never accepted. A missing or unverifiable cache causes the client migration service to preserve the case as legacy Basic instead.

Production status (2026-09-19): migrations are deployed through `0012_timestamp_activity_integrity.sql`, and `ai-verdict` version 26 is active. The canonical view remains authenticated/service-role only. The approved historical repair corrected the confirmed offset for allowlisted rows; ambiguous historical rows were left untouched.

Client verification status (2026-09-19): corrective build `1.0.6 (28)` was built, submitted, installed, and physically tested. Smart-only generation, saving, quota presentation/blocking, draft protection, no-Basic fallback, and timestamp/activity behavior passed the main acceptance flow. A cached-result quota bypass found during testing was fixed in Edge version 26 and confirmed on device. Build 28 is not released to the App Store.

The repository contract now includes read-only target `{ "target": { "targetType": "quota_status" } }`; guest requests also carry the installation guest key. Success returns `{ "ok": true, "access": AiVerdictAccessState }`. The route authenticates or hashes identity, reads existing usage state, and performs no reservation, AI generation, case creation, or usage write. Signed-in access is daily with a UTC reset instant; guest access is lifetime and has no reset.

New-case cache reuse is gated by the authoritative allowance. A cached Smart result may be returned without another provider call only while `access.allowed` is true. At zero guest lifetime or signed-in daily allowance, the request returns the same quota failure as an uncached prompt and creates no case. A replay using the same completed `requestId` remains idempotent and does not spend quota twice. Known release blocker: before guest exhaustion, a new request ID for the same cached prompt can still create another local case without consuming the remaining allowance. Resolve whether this should spend allowance or reopen/deduplicate the existing guest result, then enforce that decision atomically.

The old `case` and `guest_case` targets remain operational for released clients and explicit upgrades of legacy cases. The Phase 2 production UX never calls them automatically for a new case.

Use **successful-Smart-first guest mode** and **transactional server-backed authenticated mode**.

That means:
- guest users call `new_guest_case` and save locally only after Smart succeeds
- authenticated users call `new_case`, which saves the case and Smart result atomically
- guest cases can later be migrated to the signed-in account

This avoids forcing login while preserving upgrade paths.

---

## 2. Suggested responsibility split

### Client app
Owns:
- guest case storage
- draft persistence and stable request IDs
- presentation-layer form validation (the server repeats authoritative validation)
- routing
- canonical result rendering
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

Current v1 functions:
1. `ai-verdict`
2. `deep-read`
3. `delete-account`
4. `sync-premium-state`

Dormant/legacy functions:
- `deep-read` remains deployed for old clients and saved-data compatibility; the Phase 2 client performs read-only loading and issues no generation request

Potential future functions:
- `revenuecat-webhook` if subscription state sync moves from app-triggered sync to webhooks

The deterministic engine runs behind `ai-verdict` for Phase 2 new cases. Its output is internal calibration/rollback metadata, not a user-facing fallback.

---

## 3. Stable analysis contract

### Function: `analyzeCase(input)`

Input:
- `category`
- `inputText`
- optional `previousCaseContext` (engine-supported, **not used by the app in v1**)
- optional `updateText` (engine-supported, **not used by the app in v1**)

Output:
- `verdictLabel`
- `delusionScore`
- `explanationText`
- `nextMoveText`
- `verdictVersion`
- optional `triggeredSignals` in debug mode only

> Note: the engine can re-analyze with `updateText`/`previousCaseContext`, but the
> v1 app only calls `analyzeCase` at case creation. Updates are stored as
> timeline receipts and do not trigger re-analysis yet (see §7).

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
- retain the local deterministic implementation for legacy rendering, regression tests, and rollback
- never provide the visible result for a new Phase 2 case

### `caseRepository`
Responsibilities:
- create new cases through the atomic Smart creation service
- list and fetch canonical cases with `resultSource: 'smart' | 'legacy_basic'`
- explicitly upgrade a legacy Basic case only after user confirmation
- archive case
- update outcome
- delete case (soft delete)

Implementation has two persistence backends:
- local guest storage, written only after a verified Smart response
- Supabase authenticated storage, written inside the server transaction

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

### `deepReadService` (legacy)
Responsibilities:
- load already-saved authenticated or guest Deep Reads read-only
- keep the old request implementation dormant for rollback/older clients
- expose no new-generation action in the Phase 2 production UX

### `migrationService`
Responsibilities:
- read all local guest cases
- copy verified guest Smart cases through `migrate_guest_case`
- migrate Basic-only and unverifiable historical cases as legacy without discarding them
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

Minimal v1 profile editing uses `profiles.display_name` only. Authenticated clients may update their own row through the existing RLS policy; blank display names should be stored as `null`, and richer profile fields require a later schema migration.

---

## 6. Create-case flow contract

### For guest user
1. user submits `CreateCaseInput`
2. app reuses the draft's stable `requestId` and calls `new_guest_case`
3. server validates and safety-routes before calibration, quota, persistence, or Gemini
4. after Smart succeeds, app stores the canonical Smart snapshot locally
5. app clears the draft and opens the saved result

### For authenticated user
1. user submits `CreateCaseInput`
2. app reuses the draft's stable `requestId` and calls `new_case`
3. server validates, reserves quota idempotently, generates Smart, and atomically inserts the case and Smart row
4. app reads the canonical case and opens the saved result

### Important
The case must not enter history unless Smart generation and required persistence succeed. Any validation, safety, quota, provider, timeout, network, or persistence failure returns to the prefilled form. Editing text or category invalidates the request ID; retrying an ambiguous timeout reuses it. `in_progress` must never create a duplicate or spend quota twice.

---

## 7. Add-update flow contract

### Definition
This is **not chat**.
It is just a lightweight update attached to an existing case.

### Flow (v1 as shipped)
1. user opens case detail
2. taps `Add update`
3. writes short update
4. app stores a `case_updates` row (the update text) and displays it on the case timeline as a "receipt"

In v1 the update is **not** re-analyzed: the parent case verdict, score, and
`latest_verdict_version` are unchanged, and the generated verdict columns on
`case_updates` (`verdict_label`, `delusion_score`, `explanation_text`,
`next_move_text`, `verdict_version`) stay null. They are reserved for a future
re-analysis pass.

### Future re-analysis behavior (not in v1)
The verdict engine already accepts `updateText` + `previousCaseContext`, so a
later version can re-run analysis on update, store a generated result on the
`case_updates` row, refresh the parent case summary fields, and increment
`latest_verdict_version`. This is a deliberate v1.x/v2 enhancement, not current
behavior — do not assume the app re-scores on update today.

---

## 8. Guest migration contract

### Trigger
After successful sign-in or sign-up, if local guest data exists, prompt:
- `Move your saved cases to your account?`

### Migration behavior
- for a verified guest Smart case, pass the guest cache ID and guest key to `migrate_guest_case`
- copy Smart text only from that server-verified cache in the authenticated transaction
- migrate Basic-only or unverifiable historical cases as `legacy_basic`
- create server `cases` rows first for legacy migration
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
- average canonical delusion score
- count by category
- count by outcome status
- most recent cases

Stats can be computed client-side from canonical fetched records. Smart cases use Smart scores; records without a verified Smart row use their visible legacy Basic score.
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

## 11. Saved Deep Read legacy contract

New Deep Read generation is retired from the Phase 2 production UX. Existing authenticated and guest cached Deep Reads must remain readable as `Saved Deep Read (legacy)`, including after a case is explicitly upgraded to Smart. Known release blocker: the current client queries stored Deep Reads with the canonical Smart score after upgrade, while the saved row is keyed to the original Basic result, so the saved section can disappear.

### Product rule
The canonical case result remains the Smart result when one exists, otherwise the stored legacy Basic result:
- `verdictLabel`
- `delusionScore`
- `explanationText`
- `nextMoveText`
- `verdictVersion`

Saved Deep Read is read-only supplemental history. It never overrides canonical case fields and never triggers quota use when opened.

### Backend rule
Keep the `deep-read` function, tables, storage, and client request implementation intact for rollback and older clients. The Phase 2 result screen may load saved rows but must not issue a generation request. Provider secrets remain backend-only.

The remaining request/response and quota notes below document the dormant legacy contract; they are not current new-case product behavior.

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

For authenticated users, the Edge Function should prefer `caseId` and fetch the case from Supabase before generation. Client-provided case text is useful for shared contracts, guest local caching, and tests, but authenticated ownership and active-case checks should use server data.

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
Under this dormant Deep Read contract, cache hits return before spending quota.

AI Verdict and Deep Read use the same signed-in daily AI pool. For authenticated users, both Edge paths count successful and active reserved events from both `ai_case_verdict_usage_events` and `ai_deep_read_usage_events`:
- free signed-in: same daily limit as AI Verdict, default 2 total AI reads per UTC day
- premium: same daily limit as AI Verdict, default 50 total AI reads per UTC day

Failed calls must not count against quota. Timeout, provider errors, malformed JSON, validation errors, and cache write failures should finalize the event as `failed`.

Generation attempts may create a `reserved` event before calling the provider. A validated generated result should mark the event `succeeded` and link `ai_deep_read_id`. Hung reservations can later be marked `expired`.

### RLS and ownership
Authenticated users may read their own cached Deep Reads only when the parent case is active and owned by them.

Client writes to Deep Read tables should not be allowed. Edge Functions should use the service role after:
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
