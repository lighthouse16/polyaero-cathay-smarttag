# Cathay Pacific Hackathon 2026 — Final Submission
## Prototype & Codebase Deliverable

* **Team ID:** `E341`
* **Team Name:** `PolyAero`
* **Track:** Student Track (Wildcard) — English
* **Project Name:** PolyAero Cathay SmartTag (Reusable E-Paper Baggage Identity & Hub Transfer Operations System)
* **Date:** 15 November 2026

---

## 1. Public Codebase & Repositories

* **Main Project Monorepo (GitHub - Public):**  
  [https://github.com/lighthouse16/polyaero-cathay-smarttag](https://github.com/lighthouse16/polyaero-cathay-smarttag)  
  *Visibility:* Public (Confirmed)  
  *Contains:* Mobile App, ESP32-C6 Firmware, Cloud Backend, Staff Operations Portal, Design Tokens, and End-to-End Test Suites.

* **Primary Branch:** `feat/flight-first-transfer-control` (Production Release Revision)

---

## 2. Live Interactive Prototypes

### A. Cathay Ground Operations & AI Copilot Web Portal
* **Production URL (Custom Domain):**  
  [https://cathay.haidangtrih.me](https://cathay.haidangtrih.me)
* **Vercel Fallback Production URL:**  
  [https://polyaero-staff-portal.vercel.app](https://polyaero-staff-portal.vercel.app)
* **Key Features in Live Demo:**
  * **Flight-First Transfer Control:** Real-time prioritization of 60 flights and 2,000 transfer baggage items across HKG Terminal 1.
  * **Risk Scoring & Countdown Triage:** Automated transfer risk index (0–100) highlighting tight connections (<45m) and action-required luggage.
  * **Integrated Operations Copilot:** Real-time streaming AI assistant (powered by Gemini) for shift transfer summaries and contingency ramp guidance.
  * **Investigation Drawer:** In-depth luggage milestone history, IATA Resolution 753 compliance records, and manual scan/reconciliation actions.

### B. Live Backend API Services
* **Cloud Run Backend Base URL:**  
  [https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1](https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1)
* **Interactive OpenAPI / Swagger Documentation:**  
  [https://smarttag-demo-4pu4shawla-df.a.run.app/docs](https://smarttag-demo-4pu4shawla-df.a.run.app/docs)
* **Health Check Endpoint:**  
  [https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1/health](https://smarttag-demo-4pu4shawla-df.a.run.app/api/v1/health)

---

## 3. Physical Hardware & Embedded Deliverables

### A. ESP32-C6 Embedded Firmware Binary
* **Firmware Binary:** `artifacts/firmware-esp32c6-smarttag.bin`  
* **Architecture:** ESP32-C6 RISC-V microcontroller + Waveshare 4.2" E-Paper Display + PN532 NFC Frontend (I2C mode).  
* **Protocol & Integrity:** PA2 Protocol with two-phase crash-consistent NVS transactions and CRC-16 CCITT validation.  
* **Test Verification:** 98/98 unit and transaction tests passing.

### B. Android Native Application (NFC Pairing & Synchronization)
* **Release APK Download (Repository Artifact):**  
  [https://github.com/lighthouse16/polyaero-cathay-smarttag/raw/feat/flight-first-transfer-control/artifacts/CathaySmartTag-NFC-Hardened-Preview.apk](https://github.com/lighthouse16/polyaero-cathay-smarttag/raw/feat/flight-first-transfer-control/artifacts/CathaySmartTag-NFC-Hardened-Preview.apk)
* **Local Workspace Path:** `artifacts/CathaySmartTag-NFC-Hardened-Preview.apk`
* **Package ID:** `com.polyaero.smarttag` (Android 8.0+, NFC enabled, Standalone Release Build)

---

## 4. Video Demonstrations & Walkthroughs

* **Full End-to-End Walkthrough Video:**  
  Available in repository at `docs/ScreenRecording_11-07-2026 09-20-50_1.mp4`

---

## 5. Verification & Test Evidence

* **Staff Web Portal Tests:** 14/14 test suites, 147/147 unit and integration tests passing (`vitest`).
* **C++ Firmware Tests:** 20/20 hardware transaction tests passing.
* **Type Safety & Linting:** 0 TypeScript compilation errors (`tsc --noEmit`), 0 lint warnings.
