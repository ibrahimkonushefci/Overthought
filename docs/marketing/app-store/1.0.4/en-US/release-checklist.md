# App Store Connect handoff — version 1.0.4

## Before editing the product page

1. In App Store Connect, open **Analytics → Metrics** and record the previous 30 days in `baseline-template.csv`.
2. Record the U.S. storefront totals and device split.
3. On a U.S. App Store device, record the current rank or `not found` result for every target query in the baseline file.
4. Keep dated screenshots of the analytics filters and search results with the baseline.

## Product-page setup

1. Create iOS App version **1.0.4**.
2. Paste the English (U.S.) fields from `metadata.md` exactly.
3. Keep the existing support, marketing, and privacy URLs.
4. Upload the six files from `/Users/ibrahimi/Desktop/App Store Screenshots/ASO-1.0.4/en-US/` to the English (U.S.) **6.9-inch display** screenshot well in numbered order.
5. Confirm the product-page preview shows the new name, subtitle, first three screenshots, and no old screenshot mixed into the set.
6. Do not add an App Preview, Product Page Optimization test, Custom Product Page, Apple Search Ads campaign, or third-party analytics in this release.

## Pre-submission gates

1. Run the five-second test with at least eight target users and enter each response in the test worksheet in `measurement-plan.md`.
2. Pass only when at least seven of eight understand the input and output described in the plan.
3. Test a fresh-install guest flow through two successful Smart Verdicts and return to Home after each.
4. Confirm the native review request is attempted only after the second successful Smart Verdict and never after Basic fallback, safety routing, errors, quota, paywall, or an incomplete case.
5. Confirm Dating is selected by default and the visible label changes without changing the stored `romance` category.
6. Review spelling, safe margins, order, thumbnail readability, and metadata limits in the final U.S. preview.

## Build and release

1. Create the production iOS build with the existing EAS production profile. Its remote version source and auto-increment setting manage the build number.
2. Upload/select the build for version 1.0.4.
3. Complete App Store Connect compliance and review fields as usual.
4. Choose manual release and submit only after the product-page preview and five-second test are approved.

## After release

Use `measurement-plan.md` at days 3, 7, 14, and 28. Do not change the metadata during the 28-day measurement window unless a factual or policy issue requires an immediate correction.

