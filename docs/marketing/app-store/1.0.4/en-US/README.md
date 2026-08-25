# Overthought App Store package — 1.0.4 (English U.S.)

This folder is the reproducible source of truth for the dating-first App Store relaunch.

## Contents

- `metadata.md`: final App Store Connect copy and verified field limits.
- `screenshot-manifest.json`: screenshot order, copy, source capture, and claim checks.
- `baseline-template.csv`: the populated 30-day pre-release App Store Connect baseline.
- `measurement-plan.md`: the 3/7/14/28-day review checklist and decision rules.
- `release-checklist.md`: the exact manual App Store Connect, testing, and release sequence.
- `screenshots/`: editable HTML/CSS artwork and verified raw simulator captures.

Final 1320 × 2868 PNG exports belong in:

`/Users/ibrahimi/Desktop/App Store Screenshots/ASO-1.0.4/en-US/`

The original files in `/Users/ibrahimi/Desktop/App Store Screenshots/` must remain untouched.

## What belongs in Git

Keep the versioned release checklist, metadata, measurement plan, screenshot manifest,
editable screenshot templates, and the small deterministic simulator captures in this
folder. Together they make the 1.0.4 marketing release reproducible.

Do not commit raw App Store Connect exports or generated working renders. Those files
are transient and redundant once their totals have been recorded in the baseline. If
they are temporarily placed under `docs/marketing`, use an `exports/` or `renders/`
subfolder; both are ignored by Git.

## Release boundaries

- Installed display name remains `Overthought`.
- App Store product name becomes `Overthought: Dating Verdicts`.
- No website, Search Console, backend, Supabase, RevenueCat, or database change is part of this package.
- No App Preview video, Apple Search Ads, Product Page Optimization, or third-party analytics is included.
