# Cathay Pacific App UI Reconstruction Plan

This document governs the screenshot-driven engineering workflow for reconstructing relevant sections of the Cathay Pacific mobile app within PolyAero's hackathon prototype.

---

## 1. Core Operating Rule: No Speculative UI
- **Do not invent or guess Cathay Pacific screens** before reference screenshots are provided.
- Reconstruct only screens that have direct visual reference evidence.
- Isolate all reconstructed screens inside `apps/mobile/src/features/cathay-shell/`.
- Keep Cathay UI completely separated from PolyAero SmartTag new functionality.

---

## 2. 10-Step Screenshot-Driven Workflow

```
 ┌──────────────────────┐
 │ 1. Receive Reference │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 2. Map Hierarchy     │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 3. Extract Tokens    │ (Colors, radii, font sizes, line heights)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 4. Identify Reusable │ (Cards, buttons, headers, bottom sheets)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 5. Implement in RN   │ (apps/mobile/src/features/cathay-shell/)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 6. Render Target Dim │ (Match reference viewport e.g. 393 x 852 pt)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 7. Capture Screen    │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 8. Compare & Diff    │ (Side-by-side / overlay inspection)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 9. Pixel Refinements │ (Spacing, padding, typography, shadow)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 10. QA Sign-Off      │ (Log in docs/screen-inventory.md)
 └──────────────────────┘
```

### Step 1: Ingest Reference Screenshot
- Place image into local `reference-screenshots/` folder.
- Sanitize any real personal data (mask PNR, ticket numbers, passenger names).
- Log filename, resolution, and OS into `docs/screen-inventory.md`.

### Step 2: Map Screens and Navigation
- Determine whether screen is a root tab, stack screen, bottom sheet, or modal.
- Document entry points and exit gestures.

### Step 3: Extract Design Tokens
- Measure exact hex colors (e.g. Cathay signature jade `#006564`, card backgrounds `#FFFFFF`, borders `#E2E8F0`).
- Measure typography hierarchy (font size, weight, letter-spacing, line-height).
- Measure spacing intervals and border radii.

### Step 4: Component Decomposition
- Break screen into atoms/molecules:
  - Header / Navigation Bar
  - Flight Status Card
  - Member Tier Indicator
  - Section Dividers & Tab bars

### Step 5: Implementation in React Native
- Write idiomatic TypeScript + React Native components with `StyleSheet.create`.
- Avoid fixed hardcoded screen widths; use flexbox layouts with safe area insets.

### Step 6: Render at Reference Scale
- Test in simulator or web runner matching target device physical aspect ratio.

### Step 7: Capture Implementation View
- Take a screenshot of the running React Native screen.

### Step 8: Visual Overlay & Diff Analysis
- Check alignment, font rendering, margins, and padding.

### Step 9: Iterate and Refine
- Correct discrepancies in spacing, colors, font weights, and icon sizes.

### Step 10: Sign-Off
- Update `docs/screen-inventory.md` status to Approved.

---

## 3. Data Flow Separation
- **Cathay Shell**: Reads exclusively from local static fixtures (`@polyaero/shared/mocks`).
- **SmartTag Feature**: Communicates via `INfcService` abstraction and Supabase contracts.
