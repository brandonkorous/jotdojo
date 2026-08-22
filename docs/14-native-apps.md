# 14 — Native apps

## Position

Web-only is a product decision, not a limitation we are working around. Native apps are **deliberately unscheduled** — see [12-roadmap.md](12-roadmap.md).

But the common assumption that "no Mac means no iOS app" is **wrong**, and it should not be the reason the decision gets made.

## You can ship an iOS app without a Mac

Cloud build services run fleets of real Macs. You push source, they compile and sign on macOS, you get a signed binary — and submission works from Windows or Linux too.

| Path | What it does |
|---|---|
| **Expo EAS Build** | Provisions a fresh macOS VM per build with Xcode and Fastlane. `eas submit` uploads to App Store Connect from any OS. The best-supported route |
| **Codemagic** | Same idea, more configurable CI |
| **GitHub Actions macOS runners** | Cheapest at low volume, most assembly required |

The real requirement is an **Apple Developer Program membership at $99/year**, which enrolls from a browser or an iPhone. No Mac needed for that either.

**What you genuinely lose without a Mac:**
- The iOS Simulator (macOS only). Test on a real device via TestFlight instead.
- Xcode Instruments profiling, and native crash symbolication convenience.
- Fast iteration. A cloud build is minutes where a local build is seconds.

For a React Native or Expo app that is mostly a shell around existing web logic, none of that is disqualifying. It is slower, not blocked.

## But we still should not build one yet

Not because we cannot — because it is the wrong use of the next six months.

1. **Shortcuts already gives us most of what a native app would.** Siri, the Action Button, the share sheet, lock-screen access, automation. Those are the reasons to go native, and we get them for the cost of one REST endpoint. See [09-shortcuts.md](09-shortcuts.md).
2. **A native app is a second client against the same API.** Every feature ships twice, forever, with one developer.
3. **App Review** becomes a dependency on every release.
4. **The web version has to be excellent regardless**, because iPad-with-Pencil users and desktop users both live there.

## What would change the decision

Concrete triggers, so this gets revisited on evidence rather than on mood:

| Trigger | Why it changes the calculus |
|---|---|
| Measured time-to-captured stays above ~3s on iOS even with Shortcuts | The core promise is broken and only native fixes it |
| Ink latency is the top complaint from paying iPad users | PencilKit sees every Pencil sample; the web cannot |
| We need widgets, a Watch app, or a real lock-screen surface | No web equivalent exists |
| Storage eviction causes actual user-visible loss despite eager sync | Native storage is not evicted |
| Users ask for App Store presence as a trust signal | Real for family and small-business buyers |

## If we do it

**Expo + React Native**, sharing types and the API client from `packages/`. Build and submit through EAS, no Mac purchased.

Scope it as a **capture and read client, not a port.** Native does the things web cannot:

- Share extension and Siri intents, replacing the Shortcut with something first-class
- PencilKit for ink — the one genuinely better native experience, and the reason to bother
- Widgets and lock-screen capture
- Local notifications for triage results
- Offline capture backed by durable local storage

Everything else — settings, spaces, billing, the review inbox, search — opens the web view. There is no reason to reimplement a settings screen twice.

**Android follows the same build**, and its web story is already better than iOS: Web Share Target works in installed PWAs, so Android may never need a native app at all.

## The honest summary

You can build an iPhone app on Windows today, for $99 a year plus cloud build minutes. **We are choosing not to yet**, because Shortcuts covers the capture gap and a second client would halve the pace of everything else.

Revisit at M3, with real usage data, against the trigger list above.
