# PolyAero Cathay SmartTag System Architecture

## 1. High-Level Architecture Overview

PolyAero Cathay SmartTag is a reusable digital baggage identity platform proposed for integration into the Cathay Pacific passenger experience.

```
+------------------------------------------------------------------------+
|                   PASSENGER EXPERIENCE (Native Mobile)                 |
|                                                                        |
|  +------------------------------+    +------------------------------+  |
|  |     Cathay Shell (UI)        |    |    SmartTag Feature Area     |  |
|  |  - Reconstructed App Screens |    |  - NFC Tag Pairing & Writing |  |
|  |  - Local typed mock data     |    |  - Baggage Live Milestones   |  |
|  |  - Pure presentation layer   |    |  - Carousel Notifications    |  |
|  +------------------------------+    +--------------+---------------+  |
+-----------------------------------------------------+------------------+
                                                      |
                                    +-----------------+-----------------+
                                    |      Shared Contracts & Tokens    |
                                    |    (@polyaero/shared & tokens)    |
                                    +-----------------+-----------------+
                                                      |
+-----------------------------------------------------+------------------+
|                   GROUND OPERATIONS                 |                  |
|                                                     v                  |
|  +------------------------------+    +------------------------------+  |
|  |     Physical E-ink Tag       |    |     Ground Staff Portal      |  |
|  |  - 2.9" E-paper Display      |    |  - Next.js Web Dashboard     |  |
|  |  - Passive RF Energy Harvest |    |  - Baggage Verification      |  |
|  |  - ISO 14443-A Transceive    |    |  - Recovery Management       |  |
|  +--------------^---------------+    +--------------+---------------+  |
+-----------------+-----------------------------------+------------------+
                  | NFC RF Touch (ISO 14443-A)        | HTTPS / Realtime
                  +-----------------+-----------------+
                                    v
+------------------------------------------------------------------------+
|                        BACKEND (Supabase Platform)                     |
|  - PostgreSQL with Row-Level Security (RLS)                            |
|  - Realtime WebSocket updates for baggage milestones                   |
|  - Ground staff role verification via app_metadata                    |
+------------------------------------------------------------------------+
```

---

## 2. Core Architectural Boundaries

### A. Separation of Responsibilities
1. **Cathay Shell**:
   - Location: `apps/mobile/src/features/cathay-shell/`
   - Scope: High-fidelity visual reconstruction of authentic Cathay app screens based on provided screenshots.
   - Data Source: Static local mock data (`@polyaero/shared`).
   - Boundaries: Strictly isolated from private Cathay production APIs or payment gateways.

2. **PolyAero SmartTag Core**:
   - Location: `apps/mobile/src/features/smarttag/` and `apps/staff/`
   - Scope: Active engineering feature: NFC tag interaction, baggage lifecycle tracking, and ground recovery workflows.
   - Data Source: Shared domain contracts and Supabase backend.

### B. Hardware & NFC Integration Boundary
- The physical SmartTag display is passive and battery-free, powered via NFC energy harvesting.
- The mobile codebase abstracts NFC through the `INfcService` interface.
- Local simulator and web builds use `MockNfcService` with error and timeout simulation.
- Physical tag writes will require an Expo Development Build (`eas build --profile development` or `npx expo run:android / ios`) with native NFC entitlements.

### C. Security & Credential Hygiene
- Service-role keys are never exposed in mobile or browser client code.
- Only anonymous public keys are configured on client devices.
- Access to baggage records and operational tools is governed by PostgreSQL Row-Level Security (RLS) checking trusted `app_metadata` roles.
