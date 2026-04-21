# Overthought - Codex Build Specification

## 1. Product Overview

**App name:** Overthought  
**Platform:** iOS first  
**Build style:** Simple, modular, expansion-ready  
**Primary goal:** Ship a clean, funny-first, case-based mobile app that lets users analyze social situations, save cases, revisit them later, and add lightweight updates.

This is **not** a chatbot. It is a **case-based product**.

Each case returns:
- verdict label
- delusion score (0-100)
- short explanation
- suggested next move

The app must stay easy to use and avoid feature bloat.

---

## 2. Locked Product Decisions

These decisions are final unless changed later:

- iOS first
- guest mode supported
- optional login supported
- login methods: Apple, Google, Email
- categories in v1: Romance, Friendship, Social, General
- tone: funny-first
- output format: verdict label + score + short explanation + suggested next move
- saved case history included in v1
- light case updates included in v1
- no full chat interface
- monetization-ready architecture included in v1
- first release should keep monetization soft and simple
- premium pricing and app naming beyond "Overthought" will be decided later

---

## 3. Product Goals

### Primary goals
- make the app very easy to use
- let user analyze a situation in under 30 seconds
- create screenshot-worthy result screens
- support account creation without forcing it
- store user history for retention and future monetization
- keep architecture modular for future expansion

### Non-goals for v1
- no full chat UX
- no community feed
- no advanced AI dependency
- no complex gamification
- no heavy admin tools beyond simple debug/logging
- no feature overload

---

## 4. Recommended Tech Stack

## Frontend
- React Native
- Expo
- TypeScript
- Expo Router
- React Query (TanStack Query)
- Zustand or simple context/store for lightweight local state
- React Hook Form for forms
- Zod for validation

## Backend / Infra
- Supabase
  - Auth
  - Postgres database
  - Row-level security
  - Edge Functions for server-side verdict generation and utility logic
  - Storage only if needed later

## Payments
- RevenueCat integration scaffolded in v1
- entitlements and premium flags built now
- paywall can remain soft / disabled / hidden until later

## Analytics / Error Tracking
- PostHog or Firebase Analytics
- Sentry for crash/error monitoring

## Auth providers
- Sign in with Apple
- Google sign-in
- Email magic link or passwordless email sign-in
- Guest session support

## Testing
- Jest for unit tests
- React Native Testing Library for component tests
- Detox or Maestro for basic end-to-end flows later

---

## 5. Architecture Principles

1. **Case-based architecture, not chat-based**
2. **Server truth for user data** when authenticated
3. **Guest mode must work cleanly**
4. **Verdict engine must be replaceable later**
5. **Premium system must be pluggable**
6. **Case updates must be extendable into richer threads later**
7. **UI should remain simple even if backend evolves**

### Important modular boundaries

The following modules should be isolated so they can be expanded later:
- auth module
- guest session module
- verdict engine
- case history module
- update/timeline module
- monetization module
- analytics module
- share card module

---

## 6. Product Scope by Phase

# Phase 0 - Foundation
Goal: create the app shell and technical foundation.

### Tasks
- initialize Expo + TypeScript app
- set up routing structure
- set up design token architecture
- configure Supabase project and client
- configure environment variable system
- set up auth scaffolding
- set up analytics + error logging stubs
- create premium entitlement service abstraction
- create domain types and API layer

### Deliverable
Clean app shell with placeholder screens and working infra wiring.

---

# Phase 1 - Core v1 Build
Goal: build the simplest useful product.

### Features
- welcome / onboarding flow
- continue as guest
- sign in with Apple / Google / Email
- home screen
- create new case
- choose category
- run verdict analysis
- show result screen
- save case
- history screen
- case detail screen
- add light update to case
- mark outcome later
- basic stats screen
- settings screen

### Deliverable
A usable internal beta that supports the complete core flow.

---

# Phase 2 - Product Hardening
Goal: make the product stable, review-safe, and expansion-ready.

### Tasks
- polish guest-to-account migration flow
- add restore purchases hook
- implement soft premium gates / feature flags
- improve empty states
- improve error handling and retries
- add account deletion flow
- finalize analytics events
- add e2e smoke tests
- optimize loading / caching / offline handling

### Deliverable
A release candidate suitable for TestFlight.

---

# Phase 3 - Post-launch Expansion Hooks
Goal: prepare for future features without implementing full v2 yet.

### Build hooks only
- verdict engine interface that can swap rule engine for hybrid AI later
- richer case update threading support in data model
- premium feature flag expansion
- notification preference model
- future personality modes support
- future community feature boundaries

### Deliverable
Codebase ready to expand later without major rewrites.

---

## 7. User Experience Summary

### Primary flow
1. user opens app
2. sees simple welcome / home entry
3. continues as guest or signs in
4. creates a new case
5. writes short situation and chooses category
6. taps Analyze
7. sees verdict result
8. saves case
9. returns later to view history, add update, or mark outcome

### Key UX rules
- do not force login before first use
- do not present a chat interface
- keep creation flow fast
- keep result screen visually strong and easy to scan
- updates are lightweight, not conversational
- settings remain minimal

---

## 8. Domain Model

## Entities

### User
Represents authenticated app users.

Core fields:
- id
- auth_provider
- email nullable
- display_name nullable
- created_at
- updated_at
- deleted_at nullable
- onboarding_completed boolean
- is_guest boolean false for authenticated users

### GuestSession
Represents anonymous local-first or temporary sessions.

Core fields:
- local_guest_id
- created_at
- migrated_to_user_id nullable

Note: guest data may be stored locally first and optionally synced later when account is created.

### Case
Represents the main analysis unit.

Core fields:
- id
- owner_id nullable if guest-local only
- local_owner_id nullable for guest support
- title optional derived from first line or generated summary
- category enum: romance | friendship | social | general
- input_text
- verdict_label
- delusion_score integer 0-100
- explanation_text
- next_move_text
- outcome_status enum: unknown | right | wrong | unclear
- latest_verdict_version
- created_at
- updated_at
- archived_at nullable

### CaseUpdate
Represents lightweight additions to a case.

Core fields:
- id
- case_id
- update_text
- generated_verdict_label optional
- generated_delusion_score optional
- generated_explanation_text optional
- generated_next_move_text optional
- created_at

Note: v1 can choose either:
- full re-analysis on update
- or store update and optionally recalculate the case summary later

Recommended v1 approach:
- new update triggers re-analysis and stores a new generated outcome for that update event.

### PremiumState
Represents premium readiness.

Core fields:
- user_id
- entitlement_status enum
- source enum: revenuecat | none | manual_debug
- expires_at nullable
- updated_at

### AnalyticsEvent (optional server-side debug table)
Only if needed for product debugging.

---

## 9. Database Schema Recommendation

Use Supabase Postgres.

Suggested tables:
- profiles
- cases
- case_updates
- premium_states
- user_preferences

### profiles
- id uuid pk references auth.users
- email text nullable
- display_name text nullable
- onboarding_completed boolean default false
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz nullable

### cases
- id uuid pk
- user_id uuid nullable references profiles.id
- guest_local_id text nullable
- title text nullable
- category text not null
- input_text text not null
- verdict_label text not null
- delusion_score integer not null check between 0 and 100
- explanation_text text not null
- next_move_text text not null
- outcome_status text not null default 'unknown'
- latest_verdict_version integer not null default 1
- created_at timestamptz
- updated_at timestamptz
- archived_at timestamptz nullable

### case_updates
- id uuid pk
- case_id uuid not null references cases.id on delete cascade
- update_text text not null
- verdict_label text nullable
- delusion_score integer nullable
- explanation_text text nullable
- next_move_text text nullable
- created_at timestamptz

### premium_states
- user_id uuid pk references profiles.id on delete cascade
- entitlement_status text not null default 'free'
- source text not null default 'none'
- expires_at timestamptz nullable
- updated_at timestamptz

### user_preferences
- user_id uuid pk references profiles.id on delete cascade
- preferred_theme text nullable
- notifications_enabled boolean default false
- preferred_analysis_mode text nullable
- created_at timestamptz
- updated_at timestamptz

### Indexes
- cases(user_id, updated_at desc)
- cases(guest_local_id, updated_at desc)
- cases(category)
- case_updates(case_id, created_at asc)

### RLS
- authenticated users can only access their own rows
- guest data should stay local unless migrated
- no public write access to personal data

---

## 10. Verdict Engine Strategy

## v1 recommendation
Use a **deterministic rule/template engine**, not paid AI.

### Why
- lower cost
- predictable behavior
- easier QA
- faster performance
- safer for early viral growth

### Inputs
- case input_text
- category
- optional update text

### Outputs
- verdict_label
- delusion_score
- explanation_text
- next_move_text

### Engine design requirement
The verdict engine must be abstracted behind an interface so it can later be swapped for:
- improved rule engine
- hybrid AI rewrite layer
- full server-side LLM analysis if ever needed

### Suggested interface
`analyzeCase(input) -> AnalysisResult`

Where `AnalysisResult` contains:
- verdictLabel
- delusionScore
- explanationText
- nextMoveText
- triggeredSignals optional for debugging only

### Example signals for v1
- weak evidence
- delayed response
- vague language
- no concrete follow-up
- mixed signals
- repeated attention
- direct action present

### Suggested verdict bands
- 0-20 = Barely Delusional
- 21-40 = Slight Reach
- 41-60 = Mild Delusion
- 61-80 = Dangerous Overthinking
- 81-100 = Full Clown Territory

These labels should live in config so they can be changed later.

---

## 11. Screen List

## Required v1 screens
- Splash / Launch
- Welcome / Entry
- Auth options
- Home
- New Case
- Result
- Saved Cases / History
- Case Detail
- Add Update
- Stats
- Settings / Profile
- Soft Paywall Placeholder

## Suggested route structure
- /(public)/welcome
- /(public)/auth
- /(app)/home
- /(app)/new-case
- /(app)/case/[id]
- /(app)/case/[id]/add-update
- /(app)/history
- /(app)/stats
- /(app)/settings
- /(modals)/result
- /(modals)/paywall

Route structure can vary, but separation between public/app/modal flows should stay clean.

---

## 12. Screen Requirements

## Welcome / Entry
Must support:
- app intro
- continue as guest
- sign in options
- minimal friction

## Home
Must show:
- create case CTA
- recent cases preview
- mini stats
- optional guest prompt to sign in for sync/save

## New Case
Must support:
- multiline text input
- category selection
- analyze CTA
- validation for empty input
- optional suggestion chips later

## Result
Must show:
- verdict label
- score
- explanation
- next move
- save
- share
- add update entry point

## History
Must show:
- list of saved cases
- category filters
- empty state
- tap into detail

## Case Detail
Must show:
- original input
- latest result
- update timeline
- add update button
- outcome status controls

## Add Update
Must support:
- short text input
- submit update
- trigger re-analysis flow

## Stats
Must show simple summaries:
- total cases
- average score
- category distribution
- marked accuracy stats if available

## Settings
Must include:
- sign-in/account state
- restore purchases placeholder
- delete account
- privacy/terms placeholders
- logout where relevant

---

## 13. Guest Mode Requirements

Guest mode is required in v1.

### Guest behavior
- allow creating and analyzing cases without login
- store guest cases locally on device
- allow browsing local history
- when guest signs in later, support migration path to attach guest data to account

### Recommended local persistence
- MMKV or AsyncStorage for initial guest persistence
- if using complex state, consider Zustand + persistence

### Migration requirement
Codex should design a clean migration flow:
- detect local guest cases
- after account creation, offer user choice to merge/import local cases
- avoid accidental duplicates

---

## 14. Auth Requirements

Implement optional auth in v1.

### Methods
- Apple
- Google
- Email

### Requirements
- auth is never required before first analysis
- account-linked features should gracefully prompt sign-in
- app must support in-app account deletion
- handle logged-out, guest, and authenticated states cleanly

### State model
Three clear states:
- guest
- authenticated free
- authenticated premium-ready

---

## 15. Monetization Requirements

Do not hard-focus on monetization in the first release, but build the architecture now.

### Required now
- premium entitlement abstraction
- premium feature flag checks
- soft paywall route/modal placeholder
- restore purchases stub
- RevenueCat service layer scaffold

### Not required now
- final pricing
- final premium messaging
- aggressive conversion UX

### Example feature flags
- unlimited case history
- advanced stats
- future deeper analysis
- future special modes

Flags should exist as config, even if disabled.

---

## 16. Shareability Requirements

The app should support a screenshot-worthy result experience.

### v1 shareability goals
- visually strong result screen
- dedicated share card generator optional if easy
- simple native share support
- copied/shareable text summary optional

Suggested share payload:
- verdict label
- score
- short punchy summary
- optional small app branding

---

## 17. Analytics Events

Track at minimum:
- app_opened
- continued_as_guest
- auth_started
- auth_completed
- case_created
- case_analyzed
- case_saved
- case_shared
- case_update_added
- outcome_marked
- paywall_viewed
- restore_purchases_tapped

Keep analytics privacy-conscious and avoid storing sensitive free text in analytics tools.

---

## 18. Error Handling Requirements

Must handle gracefully:
- no network
- Supabase auth errors
- failed analysis generation
- failed save
- duplicate submissions
- migration conflicts
- partial guest storage issues

Use friendly, non-technical copy.

---

## 19. Performance Requirements

- analysis should feel fast
- avoid blocking UI on save when possible
- cache recent cases locally for snappy browsing
- support basic offline access for guest history
- keep bundle lean

---

## 20. Testing Priorities

## Unit tests
- verdict engine scoring
- result mapping
- guest migration logic
- premium flag logic

## Integration tests
- create case flow
- save and view history flow
- add update flow
- guest to account migration flow

## Manual QA priorities
- empty states
- auth edge cases
- account deletion flow
- share flow
- account restore hooks

---

## 21. Suggested File / Module Structure

Example only, adapt as needed:

- `app/`
- `src/components/`
- `src/features/auth/`
- `src/features/cases/`
- `src/features/history/`
- `src/features/stats/`
- `src/features/premium/`
- `src/features/settings/`
- `src/lib/supabase/`
- `src/lib/analytics/`
- `src/features/verdict-engine/`
- `src/features/share/`
- `src/store/`
- `src/types/`
- `supabase/functions/`
- `supabase/migrations/`

Recommended feature modules:
- `features/cases`
  - createCase
  - analyzeCase
  - caseDetail
  - addUpdate
- `features/verdict-engine`
  - rules
  - templates
  - mapping
  - interface

---

## 22. Implementation Sequence for Codex

Codex should build in this order:

### Step 1
Set up app shell, routing, design tokens, Supabase wiring, auth scaffolding.

### Step 2
Build guest mode and local persistence.

### Step 3
Build new case flow and deterministic verdict engine.

### Step 4
Build result screen and save flow.

### Step 5
Build history and case detail.

### Step 6
Build add-update flow and re-analysis behavior.

### Step 7
Build basic stats.

### Step 8
Add monetization scaffolding and settings hooks.

### Step 9
Add testing, analytics, polish, and store-readiness items.

---

## 23. Acceptance Criteria for v1 Internal Beta

The app is ready for internal beta when:
- user can continue as guest
- user can sign in with available methods
- user can create and analyze a case
- result displays all 4 required outputs
- guest case can be saved locally
- authenticated user case can be saved remotely
- user can see history
- user can open a case detail screen
- user can add a light update to a case
- user can mark outcome later
- user can view basic stats
- app has soft premium scaffolding
- settings include account state and delete-account entry point

---

## 24. Future Expansion Guidance

Design code now so these future upgrades are easy:
- more categories
- alternate personalities/modes
- hybrid AI rewrite layer
- better share cards
- push notifications
- richer update reasoning
- subscriptions activation
- community features

### Key rule
Never hardcode v1 assumptions in a way that blocks later category expansion, premium gating, or richer case timelines.

---

## 25. Notes for Codex

- prefer clear, boring architecture over clever architecture
- keep code modular and readable
- keep forms and state predictable
- use config files for labels, verdict bands, categories, and future premium flags
- do not create a chat system
- do not overbuild settings or social features
- optimize for a simple and polished first release

