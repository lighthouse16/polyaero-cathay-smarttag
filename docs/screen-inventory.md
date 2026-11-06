# Screen Inventory & Visual Reconstruction Tracker

This document catalogs reference screenshots from the production Cathay Pacific mobile application and tracks their reconstruction in `apps/mobile/src/features/cathay-shell/`.

> **Security & Privacy Notice:**
> Reference screenshots and automated visual QA artifacts are stored locally in `docs/reference-screenshots/` and `docs/visual-qa/` (excluded from Git via `.gitignore`).
> Only sanitized, synthetic, or approved assets are committed.

---

## Screen Inventory Matrix (Phase 1A)

| ID | Screen Name | Reference Screenshot File | Component Name | Route / Screen ID | Login State | Automated Visual QA | Known Gaps | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| `SCR-01` | Splash Screen | `WhatsApp Image 2026-11-06 at 21.26.54.jpeg` | `CathaySplashScreen` | `splash` | Unauthenticated | Verified (Mean diff: 5.33 / 255) | Pixel-aligned brand lockup centered on pure white `#FFFFFF`. | Visual QA completed |
| `SCR-02` | Language / Country Selection Modal | `WhatsApp Image 2026-11-06 at 21.26.54 (1).jpeg` | `CathayLanguageModal` | `language` | Unauthenticated | Verified (Mean diff: 18.57 / 255) | Static selection for default Hong Kong SAR region; selector sheet opens selection list. | Visual QA completed |
| `SCR-03` | Member Welcome Screen | `WhatsApp Image 2026-11-06 at 21.26.54 (2).jpeg` | `CathayMemberWelcomeScreen` | `welcome` | Unauthenticated | Verified (Mean diff: 22.53 / 255) | Auth flows gated via prototype notice modal; guest entry proceeds to Home. | Visual QA completed |
| `SCR-04` | Home Screen (Passenger Dashboard) | `WhatsApp Image 2026-11-06 at 21.03.02.jpeg` | `CathayHomeScreen` | `home` | Guest / Unauthenticated | Verified (Mean diff: 29.88 / 255) | Clean photographic skyline crop; secondary tabs show feature notices without displacing Home. | Visual QA completed |
| `SCR-05` | SmartTag Digital Baggage (PolyAero Feature) | *PolyAero Specification* | `SmartTagCard` | `trips` | Authenticated | Verified (Interactive prototype) | Accessible via "My trips" tab or developer navigation menu. | Implemented |

---

## Status Definitions

- **Awaiting reference**: Waiting for reference screenshot in `docs/reference-screenshots/`.
- **In development**: React Native components being implemented.
- **Visual QA pending**: Implementation ready for screenshot capture and diff analysis.
- **Visual QA completed**: Automated headless Chrome screenshot comparison verified against reference.
- **Implemented**: Feature component implemented and functional.
