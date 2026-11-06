# PolyAero Cathay SmartTag

> **Cathay Hackathon 2026 Prototype**  
> *Unofficial PolyAero Research Concept — Not an official Cathay Pacific production product.*

---

## 1. What PolyAero is Building

**PolyAero Cathay SmartTag** is a reusable digital baggage identity platform proposed for seamless integration into the Cathay Pacific passenger experience.

Our prototype consists of:
1. **Passenger Mobile App**: A React Native (Expo) application designed to integrate into the Cathay mobile app shell.
2. **SmartTag Digital Identity & E-ink Integration**: Contactless NFC reading, baggage tagging, and simulated E-ink display updates.
3. **Ground Staff Operations Portal**: A Next.js web application for ramp leads and ground handlers to verify, track, and recover bags.
4. **Data & Event Backbone**: Supabase PostgreSQL schema with milestone event auditing and planned realtime synchronization.

---

## 2. Monorepo Architecture

```text
polyaero-cathay-smarttag/
├── apps/
│   ├── mobile/         # React Native + Expo SDK 52 + Expo Router v4
│   └── staff/          # Next.js 15 App Router Ground Staff Portal
├── packages/
│   ├── shared/         # TypeScript domain models, NFC mock engine, test fixtures
│   └── design-tokens/  # Semantic tokens (Cathay jade, PolyAero accent, typography)
├── supabase/
│   └── migrations/     # PostgreSQL schema, RLS policies, realtime publications
├── tests/
│   └── maestro/        # Maestro mobile end-to-end smoke test
├── docs/               # Architecture, UI reconstruction guide, hardware specs
└── .github/            # GitHub Actions CI workflow and PR template
```

---

## 3. Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **pnpm**: `v10.x` (`corepack enable pnpm` or `npm install -g pnpm`)

### Install Dependencies
```bash
pnpm install
```

### Run the Mobile Application (Expo)
```bash
pnpm dev:mobile
```
- Press `w` to launch the mobile app in your web browser.
- Or scan the QR code with **Expo Go** on iOS / Android.

### Run the Ground Staff Portal (Next.js)
```bash
pnpm dev:staff
```
Open [http://localhost:3000](http://localhost:3000) to inspect the baggage registry and recovery console.

### Run Verification & Unit Tests
```bash
pnpm typecheck   # Type-check all packages
pnpm test        # Run Vitest unit tests in @polyaero/shared
pnpm build:staff # Production build of Next.js Staff Portal
```

---

## 4. Screenshot-Driven UI Reconstruction (Phase 1)

This repository is initialized in **Phase 0 (Foundation)**. No speculative Cathay Pacific UI has been invented.

When reference screenshots of the official Cathay Pacific application are provided:
1. Place raw screenshots into `reference-screenshots/` (excluded from Git).
2. Log the screen in `docs/screen-inventory.md`.
3. Follow the 10-step protocol defined in `docs/ui-reconstruction-plan.md`.
4. Implement components strictly inside `apps/mobile/src/features/cathay-shell/`.

---

## 5. Mock Data vs. Real Backend Scope

| Component | Current Implementation | Planned Hackathon Scope |
|:---|:---|:---|
| **Cathay App Shell** | Static typed mock data (`@polyaero/shared`) | Remains isolated mock data (no private Cathay API access) |
| **SmartTag Mobile Linking** | `MockNfcService` (simulated scan/delay) | Native NFC integration via Expo Dev Client |
| **Baggage Milestone Events** | Shared in-memory fixtures | Supabase PostgreSQL + Realtime WebSockets |
| **Ground Staff Portal** | Interactive React state with shared fixtures | Live Supabase queries & status mutation |

---

## 6. Known Technical Limitations
- **NFC Hardware**: Physical E-ink tags use vendor-specific ISO 14443-A frame protocols for power harvesting. In Phase 0, NFC operations are simulated via `MockNfcService` so developers can build without physical hardware.
- **Expo Go vs Dev Client**: Standard Expo Go does not support custom native NFC modules (`react-native-nfc-manager`). Testing on physical E-ink tags will require an Expo Development Build (`eas build`).

---

## 7. Contributing & Collaboration

See [Collaboration Guide](docs/collaboration-guide.md) for branch naming conventions (`feat/cathay-ui`, `feat/smarttag-mobile`, `feat/backend`, `feat/staff-portal`) and PR requirements.
