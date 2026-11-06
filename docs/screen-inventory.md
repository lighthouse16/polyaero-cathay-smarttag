# Screen Inventory & Visual Reconstruction Tracker

This document catalogs reference screenshots from the production Cathay Pacific mobile application and tracks their reconstruction in `apps/mobile/src/features/cathay-shell/`.

> **Security & Privacy Notice:**
> Actual reference screenshots containing passenger personal details, PNRs, or confidential assets are stored locally in `docs/reference-screenshots/` (excluded from Git via `.gitignore`).
> Only sanitized, synthetic, or approved assets are committed.

---

## Screen Inventory Matrix (Phase 1A)

| ID | Screen Name | Reference Screenshot File | Component Name | Route / Screen ID | Login State | Confidence | Known Gaps | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| `SCR-01` | Splash Screen | `WhatsApp Image 2026-11-06 at 21.26.54.jpeg` | `CathaySplashScreen` | `splash` | Unauthenticated | High (98%) | None. Pixel-aligned logo crop, centered on pure white `#FFFFFF`. | ✅ Implemented |
| `SCR-02` | Language / Country Selection Modal | `WhatsApp Image 2026-11-06 at 21.26.54 (1).jpeg` | `CathayLanguageModal` | `language` | Unauthenticated | High (95%) | Dynamic country picker sheet is represented with default HKG selection. | ✅ Implemented |
| `SCR-03` | Member Welcome Screen | `WhatsApp Image 2026-11-06 at 21.26.54 (2).jpeg` | `CathayMemberWelcomeScreen` | `welcome` | Unauthenticated | High (96%) | Webview link for "enhanced membership programme" opens route; native auth flows remain simulated. | ✅ Implemented |
| `SCR-04` | Home Screen (Passenger Dashboard) | `WhatsApp Image 2026-11-06 at 21.03.02.jpeg` | `CathayHomeScreen` | `home` | Guest / Unauthenticated | High (95%) | Lower content below destination carousel ("Discover from our partners") truncated in screenshot; Book/Profile/Tools tabs stubbed. | ✅ Implemented |
| `SCR-05` | SmartTag Digital Baggage (PolyAero Feature) | *PolyAero Specification* | `SmartTagCard` | `trips` | Authenticated | High (98%) | Accessible directly via "My trips" bottom tab bar item or dev switcher. | ✅ Implemented |

---

## Status Definitions
- ⏳ **Awaiting Reference**: Waiting for reference screenshot upload to `docs/reference-screenshots/`.
- 📋 **Spec Defined**: Screen geometry and component hierarchy outlined.
- 🚧 **In Development**: React Native components being implemented.
- 🔍 **Visual QA / Diffing**: Comparing side-by-side overlay against reference.
- ✅ **Approved / Implemented**: Visual and behavioral acceptance criteria satisfied.
