# PolyAero Cathay SmartTag System Architecture

## 1. High-Level Architecture Overview

PolyAero Cathay SmartTag is a reusable digital baggage identity platform designed as an integrated concept for Cathay Pacific.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PASSENGER EXPERIENCE (Native Mobile)                 │
│                                                                        │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │     Cathay Shell (UI)        │    │    SmartTag Feature Area     │  │
│  │  - Reconstructed App Screens │    │  - NFC Tag Pairing & Writing │  │
│  │  - Local typed mock data     │    │  - Baggage Live Milestones   │  │
│  │  - Pure presentation layer   │    │  - Carousel Notifications    │  │
│  └──────────────────────────────┘    └──────────────┬───────────────┘  │
└─────────────────────────────────────────────────────┼──────────────────┘
                                                      │
                                    ┌─────────────────┴─────────────────┐
                                    │      Shared Contracts & Tokens    │
                                    │    (@polyaero/shared & tokens)    │
                                    └─────────────────┬─────────────────┘
                                                      │
┌─────────────────────────────────────────────────────┼──────────────────┐
│                   GROUND OPERATIONS                 │                  │
│                                                     ▼                  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │     Physical E-ink Tag       │    │     Ground Staff Portal      │  │
│  │  - 2.9" E-paper Display      │    │  - Next.js Web Dashboard     │  │
│  │  - NFC NTAG I2C Plus Chip    │    │  - Baggage Verification      │  │
│  │  - Passive RF Energy Harvest │    │  - Recovery Dispatch         │  │
│  └──────────────▲───────────────┘    └──────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │ NFC Tap (ISO 14443A)              │ HTTPS / Realtime
                  └─────────────────┬─────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Supabase Platform)                     │
│  - PostgreSQL with Row-Level Security (RLS)                            │
│  - Realtime WebSocket updates for baggage milestones                   │
│  - REST & GraphQL access for mobile client & staff portal              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Boundaries

### A. Separation of Responsibilities
1. **Cathay Shell**:
   - Location: `apps/mobile/src/features/cathay-shell/`
   - Role: High-fidelity visual reconstruction of authentic Cathay app screens.
   - Data Source: Static local mock data (`@polyaero/shared/mocks`).
   - Boundaries: Absolutely NO connection to internal Cathay production APIs or payment gateways.

2. **PolyAero SmartTag Core**:
   - Location: `apps/mobile/src/features/smarttag/` and `apps/staff/`
   - Role: Active hackathon engineering feature: NFC tag interaction, baggage lifecycle tracking, and ground recovery.
   - Data Source: Shared domain models and Supabase Realtime backend.

### B. Hardware & NFC Integration Boundary
- Physical SmartTag displays require NFC energy harvesting (ISO 14443-A).
- The mobile codebase abstracts NFC through the `INfcService` interface.
- Simulator & standard Expo development use `MockNfcService`.
- Physical native NFC writes require an Expo Development Build (`eas build --profile development` or `npx expo run:android / ios`).

### C. Security & Credential Hygiene
- **Never expose Supabase service-role keys** in mobile or frontend code.
- Only the anonymous public key (`EXPO_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) is allowed on client devices.
- Access to baggage mutations and recovery tools is strictly enforced via PostgreSQL Row-Level Security (RLS).
