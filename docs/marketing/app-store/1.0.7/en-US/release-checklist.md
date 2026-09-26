# Overthought 1.0.7 — logo and example prompts handoff

## Status and scope

Prepared locally on 2026-09-26. This change replaces the iOS app icon and welcome symbol with the approved Still Typing artwork, refreshes New Case suggestions with 16 examples per category, remembered rotation, and “More ideas”, and adopts the native scene lifecycle required for iOS 27 startup. Existing welcome typography, layout, splash screen, Android native resources, backend behavior, and data contracts are unchanged.

With owner approval, EAS production build [1.0.7 (29)](https://expo.dev/accounts/alexremington/projects/overthought/builds/a2f76d95-9ee3-4408-a028-2d1bca13215b) was started on 2026-09-26 and is currently queued. Build ID: `a2f76d95-9ee3-4408-a028-2d1bca13215b`. The production environment and existing signing credentials were loaded successfully; EAS assigned remote build number 29. This is not yet a successful build. No TestFlight submission or App Store release was performed. Version 1.0.6 (28) is the historical TestFlight checkpoint recorded on 2026-09-19; live distribution status was not rechecked. EAS retains remote build numbering and production `autoIncrement`; build 29 was read from this actual EAS build, not assumed. The package.json version remains the existing internal package version, 0.1.0; release version 1.0.7 is synchronized across Expo and native iOS settings.

Asset provenance and exact mappings: [approved app branding](../../../../../assets/brand/README.md).

## Proposed release note

A fresh look for Overthought, with our new app icon and logo. Find inspiration with fresh example situations and more variety every time you start a case.

## Local verification

- PASS: both runtime app icons exactly match the approved 1024px source; opaque, square, no baked-in corner rounding.
- PASS: welcome symbol exactly matches the approved transparent source; background and three dot cutouts preserved. Existing 46 × 46 container, text, and accessibility label are unchanged.
- PASS: approved SVG files and original delivery guide preserved in the repository.
- PASS: historical 1.0.4 template uses its own byte-identical pre-update logo; captures and marketing copy were not changed.
- PASS: version 1.0.7 appears in Expo configuration, Info.plist, and both Xcode configurations; EAS numbering policy unchanged.
- PASS: after the prompt update, TypeScript type checking and all 710 Jest tests across 28 suites (`--watchman=false`). This includes all 64 prompts passing input-quality/safety checks and tests for complete rotation cycles, boundary overlap, restart persistence, independent categories, malformed storage, storage failures, and canceled/replayed focus effects.
- PASS: production config resolves to version 1.0.7 and `com.ibrahim.overthought`; EAS remote numbering and automatic increment remain enabled.
- PASS: clean iOS JavaScript/Hermes export completed with `APP_VARIANT=production` and `EXPO_NO_DOTENV=1` (environment-independent bundle check; does not validate production service credentials or native installation).
- RECOVERED: native dependencies were restored. A reviewed `pod install` changed only the generated `glog` and `hermes-engine` spec checksums in Podfile.lock; pod versions, sources, and dependency relationships are unchanged. The ignored local `.xcode.env.local` was corrected to use the available Node runtime instead of a missing nvm installation.
- PASS: local Release simulator build completed under Xcode 27.0 with iOS 27.0; the built app reports version 1.0.7 and bundle ID `com.ibrahim.overthought`. Its local build number is 1, not an assigned EAS/TestFlight number. The environment-independent build used `EXPO_NO_DOTENV=1 APP_VARIANT=production` and does not validate live service configuration.
- PASS: installed in the iPhone 18 Pro simulator; the approved cream/rose icon is visible on the home screen. See [installed icon capture](verification/home-screen-icon.png).
- PASS: the iOS 27 startup failure is fixed. A single-window SceneDelegate now creates the scene-owned window and starts React Native; AppDelegate still configures Expo. The scene manifest is present in Expo config, the tracked Info.plist, and the built app. URL/user-activity and app lifecycle callbacks forward through the existing AppDelegate handlers.
- PASS: installed Release app launched and relaunched successfully on iPhone 18 Pro / iOS 27, and remained running after relaunch. The welcome screen renders the approved heart, all three dot cutouts, unchanged typography, spacing, and legible controls without clipping. See [welcome-screen capture](verification/welcome-screen.png).
- PASS: the owner confirmed the installed New Case interactions work. The subsequent change to three suggestions passed all 82 focused prompt tests and type checking; the owner waived another visual check. The installed diagnostic build still shows four suggestions, so its screenshots do not validate the later count change.
- PASS: on the installed iOS 27 Release build, `overthought://new-case` opened New Case after terminating the app, preserving the draft; a warm `overthought://profile` navigated to Profile. Opening Settings and returning to Overthought preserved the process and rendered Profile successfully. See [cold link](verification/cold-link.png), [warm link](verification/warm-link.png), and [resume](verification/resume.png). Device Hub UI control still times out, but these checks completed through simctl and screenshot inspection.
- GAP: this environment-independent simulator build does not verify live authentication callbacks, associated-domain links, purchases, backend behavior, or physical-device installation. No production service credentials were loaded for the build.
- Local diagnostic logs: `/private/tmp/overthought-scene-build.log` (successful native build) and `/private/tmp/overthought-scene-tests.log` (710 passing tests). Temporary logs are not release artifacts.

## Native lifecycle maintenance

The pinned Expo 55 template predates the scene lifecycle needed by this SDK. The app owns `ios/Overthought/SceneDelegate.swift`, the matching AppDelegate startup change, Xcode source registration, and scene manifest. No Expo or React Native upgrade was made. The implementation retains the existing AppDelegate window reference and forwards URL/user-activity and lifecycle events to its Expo subscribers and React Native linking handlers.

**Do not run a clean Expo prebuild without preserving/reapplying these native changes.** `npm run prebuild:ios` regenerates native sources from the older Expo template; the manifest in app.config.js alone cannot recreate SceneDelegate or the AppDelegate startup change. Review the native diff and repeat the Release launch and link checks after any regeneration or SDK upgrade. See [Expo scene lifecycle guidance](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md).

## Product decisions — 2026-09-26

- **Pending—deferred for future work:** cached guest prompts can create duplicate local cases before allowance exhaustion. The product owner accepts the current behavior for this release; the bug is not fixed.
- **Closed by product decision—legacy compatibility not required:** saved Deep Read lookup after upgrading a legacy Basic case. The product owner confirms there are no existing users. No compatibility fix or legacy code removal was performed.

These decisions supersede the earlier requirement to fix both findings before release. Native verification and the remaining relevant product regression checks still apply; release itself remains a separate approval.

## Example prompt behavior

- 64 specific, relatable situations: 16 each for Dating, Friendship, Social, and General; three displayed at a time.
- Each category has its own shuffled queue. Every example appears before repeating, with no overlap between the last group of a cycle and the first group of the next.
- Local rotation stores only catalog version and prompt IDs under `overthought-example-prompt-rotation`; it is device-level, independent of authentication, and stores no case text or account information. Invalid or outdated state resets safely. Storage failures fall back to in-memory rotation.
- Refresh on screen focus, category change, tapping the selected category, or “More ideas”. Typing, selecting a suggestion, and allowance rerenders do not advance the queue.
- Selecting a suggestion still fills the draft. Browsing ideas never modifies the draft, submits a case, or consumes quota.
- Preserve stable prompt IDs when editing copy and increment the catalog version when changing it.
- Prompt validation and rotation tests passed; see Local verification above. The owner confirmed category selection, “More ideas”, tap-to-fill with draft preservation, leave/re-enter, and app restart worked before requesting three suggestions.

## Before production build

- Local startup, custom-scheme links, and background/resume checks passed. Verify actual provider authentication and purchases on the eventual signed device build; those live-service flows were not exercised in the environment-independent simulator build.
- Refresh any current store screenshots containing the old logo before publication. Do not relabel or overwrite historical 1.0.4 screenshots. The verification captures in this checklist are diagnostic evidence, not a refreshed store screenshot package.
- Run `npm run typecheck` and `npm test`; address unexpected regressions.
- Check production bundle identity and version using `APP_VARIANT=production npx expo config --type public`. Do not paste environment credentials into release records.
- Confirm production build-time environment and auth settings against the development/release guide.

## Build and submission handoff

Executed with owner authorization (also using `--clear-cache --non-interactive --no-wait`):

```sh
npx eas build --profile production --platform ios
```

Record the resulting EAS build ID, version 1.0.7, assigned remote build number, and successful build status. Inspect its icon and version before submission.

Once the build succeeds, inspect its version/icon and obtain separate authorization to submit that exact build:

```sh
npx eas submit --platform ios --profile production --id <eas-build-id>
```

Install the exact TestFlight build on an iPhone and inspect the home-screen icon, launch, and welcome symbol, including updating an existing installation. Run the remaining functional regression matrix. Confirm store screenshots and release notes are current. App Store release remains a separate approval step after remaining release checks pass.
