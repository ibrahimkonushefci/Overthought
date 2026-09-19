# Overthought Phase 2 completion handoff

Use this document to resume work in a new chat. Treat the current repository and live service state as authoritative if anything later differs from this snapshot.

## Current checkpoint

- Repository: `/Users/ibrahimi/Overthought`
- Branch: `main`
- Original Phase 2 checkpoint: `7c3a67b691536b8749fc4c525d478202e10f7062` (`Phase 2: Smart-only case creation, legacy Basic handling, local simulator verification`).
- The corrective implementation and this handoff form the next `main` checkpoint. Verify `git status`, `git log -2`, and `origin/main` when resuming.
- Build `1.0.5 (27)` proved the core Smart-only flow but was held after stale quota presentation, native quota alerts, and incorrect relative timestamps were found.
- Corrective build `1.0.6 (28)` was built, submitted, installed through TestFlight, and tested on a physical iPhone.
- Build 28 is **not** released to the App Store. Release is intentionally paused for the next product change and a fresh regression pass.

## What is complete

### Phase 1 backend foundation

- Migrations `0009_smart_case_creation.sql` and `0010_canonical_case_results_grants.sql` are deployed to the existing production Supabase project.
- `ai-verdict` supports `new_case` and `new_guest_case` with stable request IDs, validation/safety checks before quota, idempotency, atomic authenticated persistence, and backward-compatible legacy targets.
- `canonical_case_results` is a security-invoker view that resolves the latest verified Smart result or the stored legacy Basic result.
- The deterministic engine runs behind the Edge Function as internal calibration/rollback data for new cases.

### Phase 2 backend and corrective migration

- Migration `0011_verified_guest_smart_migration.sql` is deployed to the same production Supabase project.
- Migration `0012_timestamp_activity_integrity.sql` is deployed. It fixes new timestamp writes, adds canonical activity timestamps, and preserves authenticated/service-role-only canonical-view access.
- The approved historical timestamp repair corrected the confirmed offset for allowlisted case, verdict, and usage rows; ambiguous rows and case updates were left untouched.
- Production `ai-verdict` version 26 contains verified guest migration, read-only quota status, new creation contracts, legacy compatibility, and the cached-result quota gate.
- Verified guest Smart migration copies AI content only from the server cache through a service-role-only transaction.
- Unverifiable guest history is preserved as legacy Basic instead of being discarded.
- Production validation confirmed Auth health, old/new request routing, canonical-view permissions, and denial of direct public access to the migration RPC.
- The existing App Store client passed post-deployment guest and signed-in compatibility checks.

### Phase 2 client

- New cases expose only Smart Verdict.
- A case enters history only after Smart generation and persistence succeed.
- Failed, offline, provider, quota, and validation paths preserve the draft and do not create a Basic fallback.
- Draft request IDs remain stable for ambiguous retries and are invalidated when the draft changes.
- Canonical case entities use `resultSource: 'smart' | 'legacy_basic'`.
- Home, Cases, detail, Stats, sharing, and review logic consume canonical results rather than a transient Smart cache.
- Historical Basic cases retain the light legacy design, a `Legacy Basic Verdict` label, and an explicit `Upgrade to Smart Verdict` action.
- Guest Smart migration is durable; Basic-only/unverifiable history remains lossless.
- New Deep Read generation is retired from the Phase 2 UX. Existing saved Deep Reads remain readable as `Saved Deep Read (legacy)`.
- Basic engine/rendering, legacy endpoints, Deep Read code/data, and rollback paths remain in the repository.
- New Case shows an authoritative allowance strip. Exhausted guest/free/Premium states use the branded Smart Limit modal and preserve the draft.
- Fresh results show the current remaining allowance; reopened cases omit historical quota labels and never fall back to `SAVED`.
- Home sorts by latest activity and labels cards `Created` or `Updated` using canonical activity timestamps.

## Credential cleanup and security state

- The previously exposed Supabase default secret key was removed from active local/EAS configuration and deleted/revoked in Supabase.
- Dependency checks found no consumer of the old secret before revocation.
- The production Edge Function code hash did not change during the earlier key-set update; Supabase created version 24 automatically at that time. The current intentional deployment is version 26.
- Local and EAS production client configuration use the Supabase publishable key, never a secret/service-role key.
- A clean Metro export scan found the publishable key, no exact copy of the revoked key, and no secret-key credential.
- `.env` and `.env.*` are ignored. Never commit them, place a service-role/secret key in an Expo variable, or paste credentials into a client bundle.
- Cached copies of the revoked key may remain in local editor/Codex history, but the key is revoked and is not an active build input.

## Verification completed

### Automated

- `npm run typecheck`: passed.
- `npm test -- --runInBand`: 27/27 suites and 630/630 tests passed after the cache-quota hotfix.
- Production Release simulator `xcodebuild`: completed successfully.
- `npx supabase test db --local supabase/tests`: two files and four pgTAP checks passed.
- Local migrations reset/applied through `0012` successfully, including a non-UTC session integrity check.
- `npx expo install --check`: dependencies are up to date.
- `git diff --check`: passed.
- EAS production build `1.0.6 (28)` completed successfully.
- Secret-pattern and staged-content scans are required again before any future release build.

### Manual simulator matrix

- Guest Smart creation, save, reopen, and persistence: passed.
- Failed/offline submission: error shown, full draft survived dismissal and app restart, and no Basic case was created.
- Retry after local backend recovery: succeeded as Smart.
- Disposable local account creation: passed.
- Two guest Smart cases migrated to the account as verified Smart rows.
- Signed-in Social case: generated and persisted atomically as Smart with one finalized quota event.
- Server-backed legacy Basic case: opened with the legacy label, light design, explicit upgrade button, and no automatic Smart request.
- Final disposable local database state was three Smart cases plus one Basic-only legacy case.

### Physical TestFlight matrix

- Guest allowance started at 2/2; two Smart successes reached zero; the third attempt showed the correct branded Sign-in limit and preserved the draft.
- Signed-in allowance, Smart generation, and quota blocking were exercised on device.
- Result quota presentation, removal of stale `SAVED`, and timestamp/activity behavior were checked during the corrective pass.
- Repeating an exact cached prompt at zero allowance initially bypassed the limit for both guest and signed-in identities. Edge version 26 now blocks cached results at zero, and the user confirmed the production fix.
- New prompts at zero and cached prompts at zero now follow the same quota path and create no case.

## Not yet fully verified after corrective work

- Premium fair-use behavior, RevenueCat purchase, and restore with the Phase 2 client.
- Every free/Premium/IP/global quota message on device.
- Timeout with a late backend success on device.
- Cross-device/fresh-install canonical hydration with the Phase 2 client.
- Manual legacy Basic-to-Smart upgrade in the final client.
- Manual saved legacy Deep Read display after optional Smart upgrade.
- VoiceOver, Dynamic Type, Reduce Motion, and long multilingual input on device.
- Full account switching and deletion regression in build 28.

## Known issues and risks

- The simulator used a localhost-only deterministic Smart provider. It proves routing, persistence, idempotency, migration, and UI behavior—not Gemini output quality.
- Expo Doctor passes 19/20 checks. Its remaining warning says native `ios`/`android` folders coexist with app-config fields that EAS will not automatically synchronize. Review native/config parity before building.
- The explicit legacy upgrade action and saved Deep Read legacy section have automated/code coverage but were not manually exercised in this simulator pass.
- Email confirmation deliverability/custom SMTP remains an operational follow-up if messages continue going to junk.
- RevenueCat entitlement sharing follows the Apple ID receipt; one Apple subscription may mark another Overthought account premium after restore. This is accepted for v1 unless product policy changes.
- Richer profile fields and stricter one-subscription-to-one-account transfer rules remain deferred.
- GitHub reported outstanding dependency alerts on the default branch. Push-time totals changed from 47 to 41 while Dependabot refreshed; the latest observed summary was 26 high, 12 moderate, and 3 low. They have not been triaged, and the push summary does not prove whether this phase introduced them.

## Next steps, in order

1. Verify the corrective checkpoint is present on `origin/main` and the worktree is clean.
2. Start the separately scoped next product change in a new task; inspect this handoff and current source before editing.
3. If that change affects the client, increment from build 28 and repeat automated, local database, native Release, EAS, and focused physical-device validation.
4. Recheck the still-open Premium, purchase/restore, timeout, cross-device, accessibility, account-switching, deletion, legacy-upgrade, and saved-Deep-Read items as relevant to release risk.
5. Do not release build 28 or a successor to the App Store until the user explicitly approves release after the final regression matrix.
6. After a stable monitoring window, consider a separate cleanup project for dormant Basic calibration and Deep Read generation. Do not delete them as part of Phase 2.

## Work the user can reasonably do with guidance

- Manually exercise app workflows in the simulator or on an iPhone and report screenshots/results.
- Run the approved production build command:
  `npx eas build --profile production --platform ios`
- Run the approved submission command after a successful build:
  `npx eas submit --profile production --platform ios`
- Install the resulting TestFlight build and execute the manual QA checklist.
- Check App Store Connect/TestFlight processing status and report visible errors.

These commands should be run only after the preflight is complete and the user explicitly chooses to proceed. Running them does not authorize production Supabase changes, credential rotation, App Store release, or code changes.

## Work Codex should drive or closely supervise

- Code changes, test repairs, native configuration reconciliation, and release-diff review.
- Supabase production migrations, Edge Function deployment, production data inspection/write, or permission changes.
- Credential/API-key creation, rotation, revocation, or EAS secret changes.
- Diagnosis and fixes for failed EAS/TestFlight builds.
- Database/API contract changes, quota logic, guest migration logic, and canonical-read changes.
- Final evidence audit after QA and preparation of the release report.

## Hard boundaries for the next chat

- Do not deploy to Supabase production without explicit approval.
- Do not create, rotate, revoke, or modify credentials without explicit approval.
- Do not start EAS/TestFlight work merely because the repository is ready; confirm the user wants to proceed.
- Do not write, modify, or delete production data without explicit approval.
- Do not release to the App Store without explicit approval.
- Preserve Basic and Deep Read legacy data and rollback code.
