# Overthought - Verdict Engine v1 Specification

## 1. Purpose

This document defines the **v1 deterministic verdict engine** for Overthought.

The goal is to give each case a result that feels:
- funny-first
- consistent
- fast
- cheap to run
- easy to tune later

This engine is intended for **v1 and early v1.x releases**. It must be implemented behind an abstraction so it can later be replaced or enhanced with:
- a more advanced rules engine
- a hybrid AI rewrite layer
- a full LLM-based analysis system

The app is **not** a chatbot. The engine analyzes a **case** and optionally re-analyzes when the user adds a lightweight update.

---

## 2. Core Inputs and Outputs

## Input
The engine receives:
- `inputText: string`
- `category: 'romance' | 'friendship' | 'social' | 'general'`
- `previousCaseContext?: PreviousCaseContext`
- `updateText?: string`

### PreviousCaseContext
This is optional for v1.

Example structure:
- original input text
- prior score
- prior verdict label
- prior triggered signals
- number of prior updates

## Output
The engine must return:
- `verdictLabel: string`
- `delusionScore: number` (0-100)
- `explanationText: string`
- `nextMoveText: string`
- `triggeredSignals: string[]` (debug/internal only)
- `confidenceLevel?: 'low' | 'medium' | 'high'` (optional internal only)

---

## 3. High-Level Scoring Philosophy

The score represents **how weak the user's conclusion appears based on the evidence described**.

Interpretation:
- lower score = stronger evidence, more grounded interpretation
- higher score = weaker evidence, more assumption-heavy interpretation

This is **not truth detection**.
It is a structured estimate of whether the user's read of the situation looks:
- supported by actual evidence
- vague and ambiguous
- overly optimistic
- based on weak social cues
- contradicted by missing action

---

## 4. Verdict Bands

These labels must be configurable.

| Score Range | Label |
|---|---|
| 0-20 | Barely Delusional |
| 21-40 | Slight Reach |
| 41-60 | Mild Delusion |
| 61-80 | Dangerous Overthinking |
| 81-100 | Full Clown Territory |

### Notes
- Labels are intentionally funny-first.
- Keep the tone meme-aware, not cruel.
- Allow later localization or tone-pack swaps by keeping labels in config.

---

## 5. Engine Flow

1. Normalize and sanitize input text
2. Detect matched phrases, keywords, and patterns
3. Generate signal hits
4. Apply category-specific weights
5. Add or subtract points based on evidence quality
6. Clamp final score to 0-100
7. Map score to verdict label
8. Generate explanation from top 2-3 strongest signals
9. Generate next move based on score band and dominant signal type

---

## 6. Signals

Signals are the basic building blocks of the verdict engine.

Each signal has:
- `id`
- `type` (`positive_evidence` or `weak_evidence` or `context_modifier`)
- `defaultWeight`
- `categoryWeightOverrides`
- `patterns`
- `explanationFragments`
- `nextMoveHints`

---

## 7. v1 Signal Set

## A. Weak-evidence signals
These increase delusion score.

### 1. `single_low_signal`
Meaning: the user is inferring too much from a very small cue.

Examples:
- liked my story
- viewed my story
- liked a post
- watched my highlights
- reacted with emoji only

Default weight: `+16`

### 2. `delayed_reply`
Meaning: the interaction exists, but timing weakens the conclusion.

Examples:
- replied after hours
- took all day to reply
- answered late
- replied after 9 hours

Default weight: `+14`

### 3. `vague_language`
Meaning: the other person's wording is not concrete.

Examples:
- maybe
- sometime
- we should hang out
- haha
- lol
- sounds fun
- one day

Default weight: `+18`

### 4. `no_concrete_followup`
Meaning: there is no actual action or plan.

Examples:
- no date set
- never followed up
- did not make plans
- did not text again
- did not ask anything specific

Default weight: `+22`

### 5. `mixed_signals`
Meaning: some positive cue exists, but the broader pattern is inconsistent.

Examples:
- acts interested then disappears
- texts then ghosts
- hot and cold
- sometimes flirty sometimes distant

Default weight: `+20`

### 6. `assumption_without_action`
Meaning: user is reaching a conclusion without strong external action.

Examples:
- I think this means
- this must mean
- probably likes me
- surely interested
- maybe this is a sign

Default weight: `+12`

### 7. `friendliness_misread_as_interest`
Meaning: behavior may be normal kindness, not special interest.

Examples:
- smiled at me
- was nice to me
- complimented me once
- helped me
- answered politely

Default weight: `+15`

### 8. `social_media_overread`
Meaning: social app behavior is being over-weighted.

Examples:
- liked old photo
- watched story twice
- close friends view
- followed back quickly

Default weight: `+18`

### 9. `one_off_event`
Meaning: conclusion is based on a single event rather than a pattern.

Examples:
- once
- one time
- yesterday only
- just this one thing

Default weight: `+10`

### 10. `third_party_interpretation`
Meaning: conclusion depends on hearsay or someone else’s read.

Examples:
- my friend says
- everyone thinks
- someone told me

Default weight: `+8`

---

## B. Positive-evidence signals
These decrease delusion score.

### 11. `direct_action`
Meaning: the other person took a clear action.

Examples:
- asked me out
- made plans
- picked a date
- called me
- invited me
- followed up

Default weight: `-28`

### 12. `consistent_effort`
Meaning: repeated behavior supports the conclusion.

Examples:
- texts every day
- checks in often
- keeps conversation going
- followed up again
- multiple times this week

Default weight: `-20`

### 13. `specific_interest`
Meaning: attention is specific, directed, and deliberate.

Examples:
- remembered details
- asked personal questions
- brought up future plans
- made individual effort

Default weight: `-16`

### 14. `clear_language`
Meaning: wording is direct rather than vague.

Examples:
- I like you
- let’s meet Friday
- I want to see you
- are you free this weekend

Default weight: `-24`

### 15. `reciprocity`
Meaning: both sides are participating.

Examples:
- matched effort
- replied quickly more than once
- conversation is balanced
- both initiate

Default weight: `-14`

---

## C. Context modifiers
These do not stand alone well, but shape interpretation.

### 16. `work_context`
Meaning: behavior may be explained by work or logistics.
Default weight: `+10`

Examples:
- coworker
- manager
- client
- colleague
- project
- work meeting

### 17. `friend_group_context`
Meaning: behavior may be normal within a friend circle.
Default weight: `+8`

Examples:
- group chat
- same friend group
- everyone was there
- party group

### 18. `existing_relationship_context`
Meaning: stronger evidence may exist because of prior relational closeness.
Default weight: `-10`

Examples:
- we already hang out often
- we talk every day already
- we are already close

### 19. `update_strengthens_case`
Meaning: a later update adds credible evidence.
Default weight: `-12`

Examples:
- now they made plans
- now they followed up
- now they asked directly

### 20. `update_weakens_case`
Meaning: a later update undermines the earlier hope.
Default weight: `+14`

Examples:
- turns out it was only about work
- they stopped replying again
- it was just friendliness

---

## 8. Category Weight Adjustments

Different categories should interpret some signals differently.

## Romance
Use default weights as baseline.

## Friendship
Adjustments:
- `friendliness_misread_as_interest`: `+10` instead of `+15`
- `direct_action`: `-18` instead of `-28`
- `social_media_overread`: `+14` instead of `+18`
- `consistent_effort`: `-14` instead of `-20`

Reason:
Friendship signals are naturally less romantic and often less explicit.

## Social
Adjustments:
- `single_low_signal`: `+12`
- `vague_language`: `+14`
- `social_media_overread`: `+20`
- `direct_action`: `-16`
- `reciprocity`: `-10`

Reason:
Many social situations are weaker and more ambiguous by nature.

## General
Adjustments:
- keep most defaults
- reduce highly romance-coded assumptions if no romance keywords detected

Rule:
If category is `general`, romance-heavy explanation templates should not be used unless romance-related patterns are detected.

---

## 9. Base Score and Formula

Recommended formula:

- start at `50`
- apply matched signal weights
- apply duplicate-match caps
- apply category overrides
- clamp to `0-100`

### Why start at 50
A neutral ambiguous social situation is usually neither fully grounded nor fully delusional.
Starting at 50 makes the score easier to move meaningfully in either direction.

### Caps
To prevent runaway scoring:
- same signal may only be applied once per analysis in v1
- max total positive reduction from evidence: `-45`
- max total weak-evidence increase: `+45`
- context modifiers can add/subtract outside those caps only up to `10`

---

## 10. Pattern Detection Approach

v1 should be simple and deterministic.

Use:
- normalized lowercase text
- punctuation stripping for matching
- keyword groups
- phrase contains checks
- simple regex where useful

Do not use:
- embedding search
- external paid AI APIs
- complicated NLP pipelines

### Recommended detection strategy
Each signal has a list of patterns.
A signal is triggered if:
- any phrase match succeeds, or
- pattern regex succeeds, or
- multiple supporting keywords co-occur

### Example
For `no_concrete_followup`, trigger if text includes any of:
- `didn't make plans`
- `did not make plans`
- `never followed up`
- `no date`
- `no plan`
- `didn't text again`

---

## 11. Explanation Generation Rules

The explanation should feel:
- short
- funny-first
- readable
- grounded in detected signals

### Length
Target: 1-3 sentences

### Structure
Recommended structure:
1. One sentence summarizing why the score landed where it did
2. One sentence pointing to the strongest weakness or strength in the evidence
3. Optional short funny closer

### Tone rule
Funny-first, but not insulting enough to make the app feel hostile.

### Explanation template examples

#### High-score explanation template
"This is leaning delusional because the evidence is thin and the follow-through is weak. A like, a vague reply, or one nice moment is not the same as actual effort."

#### Mid-score explanation template
"There is something here, but not enough to call it solid yet. The interest might be real, but the signals are still mixed and incomplete."

#### Low-score explanation template
"This looks more grounded than delusional. There is actual effort, direct action, or consistency here, which makes the situation stronger than a random social cue."

### Humor add-on examples
Use sparingly:
- "Respectfully, this is not evidence."
- "The imagination is working overtime."
- "This one has a little substance, finally."
- "We are no longer operating on crumbs alone."

---

## 12. Next Move Generation Rules

The next move should be practical and short.

### Score-based guidance

## 81-100
- wait for real action
- stop reading into crumbs
- do not escalate based on this alone
- let them show consistency first

## 61-80
- gather more evidence before deciding
- look for follow-through, not vibes
- do not over-interpret one signal

## 41-60
- stay neutral and observe the pattern
- give it a little time
- look for repeated effort

## 21-40
- proceed, but keep expectations realistic
- respond naturally and see if they match energy
- look for consistency, not perfection

## 0-20
- this is reasonably supported
- you can engage normally
- the evidence is stronger than usual here

### Dominant-signal overrides
If strongest signal is `no_concrete_followup`:
- prefer next move such as: "Wait for an actual plan, not a vague maybe."

If strongest signal is `mixed_signals`:
- prefer next move such as: "Do not judge the situation from the highs only. Watch the overall pattern."

If strongest signal is `direct_action`:
- prefer next move such as: "The signal is clear enough to respond normally instead of guessing."

---

## 13. Case Update Handling

v1 supports **light updates**, not chat.

### Rule
When a case gets an update:
- combine the original input and the latest update into a fresh analysis pass
- include previous dominant signals as weak context only
- do not build a full memory model yet

### Recommended logic
`analysisText = originalInput + '\nUpdate: ' + latestUpdate`

Then:
- run normal analysis
- allow update-specific signals like `update_strengthens_case` or `update_weakens_case`
- save update result separately on the update row
- update case summary fields to latest result

### Important
The update flow should not create a conversational assistant feel.
It is still just a case re-analysis.

---

## 14. Debugging / Internal Transparency

For internal QA, return:
- triggered signals
- applied weights
- dominant signal
- score before clamp
- score after clamp

These fields should not be shown in the normal user UI.
They are useful for:
- tuning weights
- debugging surprising outputs
- creating admin/test fixtures

---

## 15. Suggested TypeScript Types

```ts
export type CaseCategory = 'romance' | 'friendship' | 'social' | 'general';

export type VerdictBand = {
  min: number;
  max: number;
  label: string;
};

export type AnalysisResult = {
  verdictLabel: string;
  delusionScore: number;
  explanationText: string;
  nextMoveText: string;
  triggeredSignals: string[];
  dominantSignal?: string;
  confidenceLevel?: 'low' | 'medium' | 'high';
};

export type VerdictEngineInput = {
  inputText: string;
  category: CaseCategory;
  updateText?: string;
  previousCaseContext?: {
    priorScore?: number;
    priorVerdictLabel?: string;
    priorSignals?: string[];
    priorUpdateCount?: number;
  };
};
```

---

## 16. Recommended Implementation Notes for Codex

1. Put labels, bands, patterns, and weights in config.
2. Keep explanation templates separate from scoring rules.
3. Keep category overrides separate from signal definitions.
4. Build analyzer as a pure function first.
5. Add snapshot tests for known inputs.
6. Add a debug mode for local development.
7. Keep room for future personality packs by making explanation generators swappable.

---

## 17. Example Analyses

## Example 1
Input:
"She liked my story and replied haha after 8 hours."
Category: romance

Likely signals:
- `single_low_signal` +16
- `delayed_reply` +14
- `vague_language` +18
- `social_media_overread` +18

Base 50 -> 98
Verdict: `Full Clown Territory`

Example explanation:
"This is leaning heavily delusional because the evidence is mostly crumbs. A story like plus a vague late reply is not strong enough to carry the theory."

Example next move:
"Wait for real effort or a clear follow-up before taking this seriously."

---

## Example 2
Input:
"He asked me out for Friday and followed up today to confirm the time."
Category: romance

Likely signals:
- `direct_action` -28
- `clear_language` -24
- `consistent_effort` -20

Base 50 -> -22 -> clamp 0
Verdict: `Barely Delusional`

Example explanation:
"This looks grounded. There is direct action and actual follow-through here, which is much stronger than a random social cue."

Example next move:
"Respond normally. This is one of the clearer cases."

---

## Example 3
Input:
"My friend has been texting me way more this week and asked if I want to hang out this weekend."
Category: friendship

Likely signals:
- `consistent_effort` -14
- `direct_action` -18

Base 50 -> 18
Verdict: `Barely Delusional`

Example explanation:
"This seems reasonably supported. The pattern is not based on one tiny signal because there is repeated effort and a direct plan."

Example next move:
"Engage normally and see whether the effort stays consistent."

---

## Example 4
Input:
"He is nice to me at work and smiled a lot, so I think this means something."
Category: general

Likely signals:
- `friendliness_misread_as_interest` +15
- `assumption_without_action` +12
- `work_context` +10

Base 50 -> 87
Verdict: `Full Clown Territory`

Example explanation:
"This is mostly assumption without enough real evidence. Normal workplace friendliness is too weak to support a big conclusion on its own."

Example next move:
"Do not build a theory from politeness alone. Wait for specific effort outside the obvious context."

---

## 18. Future Upgrade Path

This engine should evolve in this order:

### v1
Deterministic rules and templates only

### v1.x
Add better phrase coverage, more category nuance, and more polished explanation variations

### v2
Optional hybrid AI rewrite layer for premium users or longer analyses

### Later
Optional full AI model only if retention and monetization justify it

---

## 19. Final Implementation Constraint

v1 must remain:
- predictable
- cheap
- testable
- fast
- easy to tune

Do not over-engineer this engine into an LLM product before the product has proven traction.
