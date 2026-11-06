# Screen Inventory & Visual Reconstruction Tracker

This document catalogs reference screenshots from the production Cathay Pacific mobile application and tracks their pixel-perfect reconstruction in `apps/mobile/src/features/cathay-shell/`.

> **Security & Privacy Notice:**
> Actual reference screenshots containing passenger personal details, PNRs, or confidential assets must be stored in `reference-screenshots/` (which is excluded from Git via `.gitignore`).
> Only sanitized, synthetic, or approved assets may be committed.

---

## Screen Inventory Matrix

| ID | Screen Name | Reference Screenshot File | Device & OS | Dimensions | App Version | Login State | Scroll Position | Key Interactive Elements | Navigation Target | Implementation Status | Visual QA Status |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| `SCR-01` | Home Screen (Dashboard) | *Pending Receipt* | iPhone 15 Pro (iOS 18) | 1179 x 2556 | Latest | Authenticated | Top | Book Flight, Flight Status, Member Card | Tabs, Booking flow | ⏳ Awaiting Reference | ⏳ Pending |
| `SCR-02` | Trips / Manage Booking | *Pending Receipt* | iPhone 15 Pro (iOS 18) | 1179 x 2556 | Latest | Authenticated | Top | Flight itinerary card, SmartTag entry point | Trip details, SmartTag Modal | ⏳ Awaiting Reference | ⏳ Pending |
| `SCR-03` | Flight Details & Baggage Info | *Pending Receipt* | iPhone 15 Pro (iOS 18) | 1179 x 2556 | Latest | Authenticated | Middle | Baggage allowance, carousel indicator | Baggage Tracker | ⏳ Awaiting Reference | ⏳ Pending |
| `SCR-04` | Profile & Marco Polo Club | *Pending Receipt* | iPhone 15 Pro (iOS 18) | 1179 x 2556 | Latest | Authenticated | Top | Tier status badge, Club points | Membership details | ⏳ Awaiting Reference | ⏳ Pending |
| `SCR-05` | SmartTag Pairing Sheet (New) | *PolyAero Native Spec* | iPhone / Android | Adaptive | N/A | Authenticated | Modal Sheet | NFC Tap target, Battery gauge, E-ink sync button | Tag Linked confirmation | 🔨 Phase 0 Scaffold | 🟢 Ready |

---

## Status Definitions
- ⏳ **Awaiting Reference**: Waiting for reference screenshot upload to `reference-screenshots/`.
- 📋 **Spec Defined**: Screen geometry and component hierarchy outlined.
- 🚧 **In Development**: React Native components being implemented.
- 🔍 **Visual QA / Diffing**: Comparing side-by-side overlay against reference.
- ✅ **Approved**: Visual and behavioral acceptance criteria satisfied.
