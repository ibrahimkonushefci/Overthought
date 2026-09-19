# Overthought - Master Handoff for Codex

This file is the **entry point** for implementation.
It tells Codex:
- what the product is
- which source files are authoritative
- what order to read them in
- what is already decided vs what is intentionally deferred
- what should be built now vs later

Use this file first before reading the rest of the project docs.

---

## Smart-only rollout override (September 2026)

The approved Smart-only plan supersedes the original deterministic-only direction for **new** cases:

- Phase 1's additive backend, atomic creation RPCs, canonical result view, and backward-compatible Edge Function were deployed to the existing production Supabase project on 2026-09-17.
- Phase 2 is implemented and validated locally. New cases expose only Smart Verdict and enter history only after Smart generation and persistence succeed. Failed submissions return to a preserved draft with a stable retry ID.
- Canonical reads carry `resultSource: 'smart' | 'legacy_basic'`. Historical Basic results stay labeled and unchanged until the user explicitly upgrades them. Saved Deep Reads remain readable as legacy data, but the production UX cannot request new Deep Reads.
- Verified guest Smart migration is handled by migration `0011` and a service-role-only transaction that copies AI text only from the server-verified guest cache. Unverifiable older guest records are preserved as legacy Basic cases.
- The canonical engine source now lives in `supabase/functions/_shared/verdict-engine/`; `src/features/verdict-engine/` contains app-compatible re-export entrypoints.

Production backend status (2026-09-19): migrations are applied through `0011`, and backward-compatible `ai-verdict` version 24 is active. Version 24 was created automatically when the compromised default secret key was deleted; the deployed code hash is unchanged. New-contract validation, legacy guest-contract validation, Auth health, and the service-role-only RPC boundary passed post-revocation production checks without generating AI, spending quota, or saving a case. The current App Store client passed guest and signed-in compatibility tests; its Basic fallback after two signed-in Smart generations was expected daily-quota behavior. The local and EAS production configurations use the publishable key, and a clean Metro export contains that key with no secret-key credential. The Phase 2 client has a verified local simulator development build but still requires separate TestFlight approval and physical-iPhone QA; no Phase 2 TestFlight or App Store build exists yet.

Local simulator status (2026-09-19): the Phase 2 development build completed successfully and the full Smart-only matrix passed against disposable local Supabase data. Verified flows were guest Smart creation and reopening, failed submission with draft persistence and no Basic case, verified guest-to-account Smart migration, signed-in atomic Smart creation, and opening a server-backed `legacy_basic` case without automatic generation. The simulator used the localhost-only deterministic Smart provider, so this proves client/backend flow and persistence—not Gemini response quality. TypeScript, 24 Jest suites/610 tests, the pgTAP migration test, dependency alignment, and the native Xcode build passed. TestFlight and physical-iPhone Phase 2 QA remain unstarted and require separate approval.

For a concise, pasteable continuation brief, read [`docs/phase-2-completion-handoff.md`](phase-2-completion-handoff.md) before starting new work.

---

## 1. Project snapshot

**App name:** Overthought  
**Platform priority:** iOS first  
**Product type:** case-based mobile app, **not** a chatbot  
**Tone:** funny-first  
**Primary categories in v1:** romance, friendship, social, plus general  
**Login strategy:** guest mode first, optional sign-in  
**Monetization strategy:** architecture-ready in v1, soft/simple first release  
**Core UX rule:** simple, fast, low-friction, not feature-heavy

Current v1 stabilization state:
- The pre-Phase-2 production iOS TestFlight build opens correctly on physical devices.
- Unified signed-in AI quota is deployed: migration `0006_unified_ai_read_quota.sql` has been applied, and the updated `ai-verdict` Edge Function is deployed.
- The latest pre-Phase-2 TestFlight build includes the premium/quota stale-state fix and minimal display-name profile editor; both were manually verified on device.

---

## 2. Non-negotiable product decisions

These are locked unless the product owner changes them later.

1. **The app is not a ChatGPT-style chat app.**
   - Users create a case.
   - Users may add a **light update** to a case.
   - Do not design or implement a freeform multi-turn assistant UI as the primary experience.

2. **Guest mode is required.**
   - Users must be able to analyze cases before login.
   - Login should be optional and value-driven.

3. **Saved case history is required in v1.**
   - The app should not be disposable or one-shot only.

4. **Very light case updates are required in v1.**
   - Support an “Add update to this case” action.
   - Do not treat this as full chat.

5. **The output format is fixed for v1.**
   Every analysis returns:
   - verdict label
   - delusion score (0-100)
   - short explanation
   - suggested next move

6. **The original v1 verdict engine is deterministic.**
   - This remains the legacy/internal calibration and rollback component.
   - The Smart-only rollout override above governs new cases after Phase 2 ships.

7. **Architecture must be expansion-ready.**
   - Future premium, richer updates, deeper analysis, and new categories should be possible without breaking the data model.

---

## 3. What is intentionally deferred

These items are **not** final yet and should be implemented in a way that is easy to change:

- premium pricing and limits
- app naming/branding beyond “Overthought”
- final visual style polish and exact color tokens
- AI/hybrid analysis layer
- community/social feed
- advanced personality packs
- Android-first optimization
- heavy gamification

Do not overbuild these now.

---

## 4. Read order for Codex

Read the docs in this exact order.

### Step 1: Product scope and implementation rules
**File:** `docs/overthought-codex-spec.md`

Purpose:
- overall product scope
- app philosophy
- phased roadmap
- tech stack direction
- what belongs in v1 vs later

Treat this as the main product/build specification.

---

### Step 2: Backend boundaries and stable contracts
**Files:**
- `docs/overthought-api-contracts.md`
- `supabase/migrations/0001_initial_schema.sql`
- `src/types/shared.ts`

Purpose:
- stable client/backend boundaries
- local-first guest mode vs authenticated mode
- database schema
- expansion-safe types and contracts

Treat these as the source of truth for storage, persistence, and migration shape.

---

### Step 3: Verdict system design
**Files:**
- `docs/overthought-verdict-engine-spec.md`
- `supabase/functions/_shared/verdict-engine/config/verdict-config.v1.json`

Purpose:
- scoring philosophy
- verdict labels
- signal system
- category rules
- explanation/next-move strategy

Read this before touching analysis logic.

---

### Step 4: Verdict starter implementation
**Canonical folder:** `supabase/functions/_shared/verdict-engine/`

Important files:
- `src/features/verdict-engine/README.md`
- `supabase/functions/_shared/verdict-engine/analyzeCase.ts`
- `supabase/functions/_shared/verdict-engine/types.ts`
- `supabase/functions/_shared/verdict-engine/config.ts`
- `supabase/functions/_shared/verdict-engine/config/verdict-config.v1.json`
- `src/features/verdict-engine/exampleUsage.ts`

Purpose:
- starter implementation of the deterministic engine
- typed config model
- direct code Codex can integrate or adapt

This should reduce invention, not replace app architecture decisions.

---

### Step 5: Design intent and UI structure
**Authoritative files:**
- `design-reference/color-palette.md`
- `design-reference/screens/`

Purpose:
- screen inventory
- information architecture
- tone and UX feel
- component expectations
- share-card and empty-state guidance

Use this to keep implementation aligned with intended design.

---

## 5. Which file is authoritative for what

### Product scope
**Authoritative file:** `docs/overthought-codex-spec.md`

### Backend/data contracts
**Authoritative files:**
- `docs/overthought-api-contracts.md`
- `supabase/migrations/0001_initial_schema.sql`
- `src/types/shared.ts`

### Verdict engine behavior
**Authoritative files:**
- `docs/overthought-verdict-engine-spec.md`
- `supabase/functions/_shared/verdict-engine/config/verdict-config.v1.json`

### Verdict engine starter code
**Authoritative folder:** `supabase/functions/_shared/verdict-engine/`

### Design direction
**Authoritative file:** `design-reference/color-palette.md + design-reference/screens/`

If two files conflict, use this priority order:
1. this master handoff
2. codex spec
3. backend contracts / verdict spec
4. starter code
5. design-reference/color-palette.md + design-reference/screens/

---

## 6. What Codex should build now

### Required in first implementation pass
- Expo / React Native iOS-first app foundation
- routing/navigation
- guest mode flow
- optional authentication flow
- local case storage for guest users
- Supabase-backed storage for authenticated users
- guest-to-account migration path
- create case flow
- deterministic verdict engine integration
- result screen
- save case to history
- add update to case
- mark outcome later
- basic stats screen
- settings/account area
- monetization-ready flags and structure, even if not fully enabled

### Recommended auth options
- Sign in with Apple
- Google sign-in
- email / magic-link style flow if chosen by implementation

### Required output per analysis
- `verdictLabel`
- `delusionScore`
- `explanationText`
- `nextMoveText`
- `verdictVersion`

---

## 7. What Codex should not overbuild yet

Do **not** spend early time on:
- full conversation/chat UI
- AI/LLM integration for every case
- community posting system
- advanced moderation systems for public content
- large theme/personalization systems
- deep animations that slow down shipping
- complicated paywall experimentation
- complex server-side orchestration unless necessary

The goal is a clean, shippable v1 foundation.

---

## 8. Architecture expectations

Codex should preserve these principles:

### A. Keep the verdict interface stable
The app should not care whether verdicts come from:
- local rules
- edge function
- hybrid AI later

Keep analysis behind a stable abstraction.

### B. Separate storage mode from UI
The same screens should work whether the user is:
- guest/local-only
- authenticated/server-backed

### C. Design for later expansion
Future features should be add-ons, not rewrites:
- premium limits
- new categories
- richer update threads
- improved copy packs
- hybrid AI

### D. Favor local-first simplicity in v1
If a decision can reasonably stay on-device at first, prefer that.

---

## 9. Suggested implementation order inside the app

1. app shell + navigation
2. shared types/constants
3. verdict engine integration
4. create-case flow
5. result screen
6. guest local persistence
7. case history list + detail
8. add-update flow
9. outcome tracking
10. auth layer
11. Supabase sync/persistence for signed-in users
12. guest migration
13. settings/account screen
14. monetization scaffolding
15. analytics/test cleanup

This order reduces rework.

---

## 10. Suggested folder/module boundaries

Codex is free to adapt naming, but the architecture should roughly separate:

- `app/` or `src/app/` - navigation and screens
- `features/cases/` - create case, history, detail, updates
- `features/analysis/` - verdict engine adapter/service
- `features/auth/` - guest/auth flows
- `features/account/` - settings, deletion, profile
- `features/premium/` - feature flags/paywall hooks
- `shared/` - UI kit, constants, utilities, types
- `lib/supabase/` - supabase client and helpers
- `storage/` - local persistence abstraction
- `verdict-engine/` - deterministic engine starter integration

Do not entangle verdict logic directly with screen code.

---

## 11. Compliance/operational notes to respect

Because this is iOS first and supports account creation/sign-in:
- include **Sign in with Apple**
- account deletion must be possible in-app if account creation exists
- guest/demo mode should remain usable for review and low-friction onboarding

Codex should implement these in a pragmatic, minimal way.

---

## 12. Final handoff rule

When in doubt, Codex should optimize for:
1. simplicity
2. correctness
3. expansion-readiness
4. low cost
5. fast shipping

Not for maximum feature count.
