# Screen Inventory & Visual Reconstruction Tracker

This document catalogs reference screens and userflows from the authentic Cathay Pacific mobile application (analyzed from `docs/ScreenRecording_11-07-2026 09-20-50_1.mp4`) and tracks their reconstruction in `apps/mobile/src/features/cathay-shell/`.

> **Security & Privacy Notice:**
> Reference screenshots, video keyframes, and automated visual QA artifacts are stored locally in `docs/reference-screenshots/` and `docs/visual-qa/` (excluded from Git via `.gitignore`).
> Only sanitized, synthetic, or approved assets are committed.

---

## Screen Inventory Matrix (Full Authentic App Rebuild)

| ID | Screen Name | Video Reference / Source | Component Name | Route / Screen ID | State / Tab | Features & Interactivity | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `SCR-01` | Splash Screen | Video 00:00 - 00:02 | `CathaySplashScreen` | `splash` | Initializing | Pixel-aligned brand lockup centered on pure white `#FFFFFF`. | Verified |
| `SCR-02` | Country / Region Selection | Video 00:02 - 00:08 | `CathayLanguageModal` | `language` | Initializing | Country & language modal picker with search and checkmark indicator. | Verified |
| `SCR-03` | Member Welcome Screen | Video 00:08 - 00:15 | `CathayMemberWelcomeScreen` | `welcome` | Onboarding | Authentic hero tail graphic, 2027 programme disclaimer, Sign up / Sign in / Guest CTAs. | Verified |
| `SCR-04` | 5-Step Sign Up Wizard | Video 00:18 - 02:45 | `CathaySignUpModal` | `signup-modal` | Guest / Flow | 5-step interactive wizard: Phone (+852) -> Personal Details -> Preferences -> Password strength meter & 4-point checklist -> 6-digit OTP countdown. | Verified |
| `SCR-05` | Sign In & Password Reset | Video 02:46 - 04:30 | `CathaySignInModal` | `signin-modal` | Guest / Flow | Multi-method sign in (Mobile / Email / Member ID), retry warning banner, Reset Password flow (Phone -> DOB -> OTP -> New Password -> Confirmation). | Verified |
| `SCR-06` | Post-Signup Welcome Hero | Video 02:30 - 02:40 | `CathayWelcomeToastModal` | `welcome-toast` | Auth Celebration | Champagne hero graphic, Green digital membership card, Push notifications prompt. | Verified |
| `SCR-07` | Authenticated Home Screen | Video 04:32 - 06:10 | `CathayHomeScreen` | `home` | Home Tab | "Hello Mr Trinh", Asia Miles & Status Points badges, Passkey prompt, Flight search card, Recent searches card ("08 Nov - 15 Nov HKG to NKG"), Nanjing wing banner, 4 horizontal carousels (Offers, Promotions, Travel Inspiration, Stay up-to-date), Legal disclaimer. | Verified |
| `SCR-08` | Message Centre | Video 06:12 - 06:40 | `CathayMessageCentreModal` | `message-centre` | Global Modal | Notifications tab + Travel Alerts tab (3 lithium battery & power bank carry-on regulations). | Verified |
| `SCR-09` | Book Trip & Flight Search | Video 06:45 - 08:30 | `CathayBookScreen` | `book` | Book Tab | Return / One way / Multi-city selector, HKG -> NKG route selector with swap button, Cabin & passenger bottom sheet (adult stepper). | Verified |
| `SCR-10` | Airplane Window Loading | Video 08:31 - 08:45 | `CathayBookScreen` (loading) | `flight-loading` | Book Transition | Authentic airplane window frame over cloudy skies with animated moving flight line from HKG to NKG. | Verified |
| `SCR-11` | Flight Search Results | Video 08:46 - 10:15 | `CathayBookScreen` (results) | `flight-results` | Book Tab | Interactive date price ribbon, cabin class tabs, CX304 non-stop vs CX332 1-stop transit cards, selectable flight cards. | Verified |
| `SCR-12` | My Trips (Upcoming / Past) | Video 10:20 - 11:30 | `CathayTripsScreen` | `trips` | Trips Tab | Upcoming vs Past segmented tabs, Empty state with airplane circle badge, Add booking modal (PNR vs 13-digit e-ticket validation). | Verified |
| `SCR-13` | PolyAero SmartTag Active Booking | Spec & Video Integration | `CathayTripsScreen` + `SmartTagCard` | `trips` | Active Booking | Active HKG -> NKG booking card with embedded PolyAero SmartTag E-ink view, battery 94%, NFC tag tap hardware simulation with instant visual feedback. | Verified |
| `SCR-14` | Profile & Digital Member Card | Video 11:35 - 13:45 | `CathayProfileScreen` | `profile` | Profile Tab | Green tier header, 300 Status Points progress bar, "Complete your profile" checklist, Member benefits list, Interactive digital membership card modal with scannable QR code & "Add to Apple Wallet" CTA. | Verified |
| `SCR-15` | Travel Tools & Baggage Calculator | Video 13:50 - 16:29 | `CathayTravelToolsScreen` | `tools` | Tools Tab | 3-section utility grid (Flight & Airport, Planning, Help & Information), interactive flight status lookup modal, Baggage calculator with direct SmartTag digital baggage link. | Verified |
| `SCR-16` | Bottom Navigation Shell | Video All Tabs | `CathayAppShell` | `app-shell` | Root Layout | 5-tab fixed bottom bar (Home, Book, My trips, Profile, Travel tools) with active icon tint, global auth state, modal management, and secret dev evaluation switcher. | Verified |

---

## Status Definitions

- **Awaiting reference**: Waiting for reference asset or video inspection.
- **In development**: React Native components being implemented.
- **Verified**: Fully implemented, typechecked, linted, and verified against genuine Cathay app video frames.
