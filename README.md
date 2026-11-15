# Baggage Recovery Copilot

> Cathay Hackathon 2026 Prototype  
> Unofficial PolyAero Research Concept — Not an official Cathay Pacific production product.

[![Live Portal](https://img.shields.io/badge/Live%20Demo-Operations%20Portal-006564?style=flat-square&logo=vercel)](https://cathay.haidangtrih.me/#transfer-control)
[![Android Release](https://img.shields.io/badge/Release-v1.0.0%20(APK)-163230?style=flat-square&logo=android)](https://github.com/lighthouse16/polyaero-cathay-smarttag/releases/tag/v1.0.0)
[![Hardware Specs](https://img.shields.io/badge/Hardware-ESP32--C6%20%2B%20E--Paper-blue?style=flat-square)](docs/hardware/README.md)

---

## 📌 Quick Access & Demonstrations
- 🌐 **Live Ground Operations Portal**: [https://cathay.haidangtrih.me/#transfer-control](https://cathay.haidangtrih.me/#transfer-control)
- 📱 **Download Android App (Release APK)**: [CathaySmartTag-Release.apk (v1.0.0)](https://github.com/lighthouse16/polyaero-cathay-smarttag/releases/tag/v1.0.0)
- 🏷️ **Hardware Specifications & Circuit Pinout**: [docs/hardware/README.md](docs/hardware/README.md)
- ⚡ **MicroPython Hardware Firmware**: [apps/firmware/micropython-esp32c6/README.md](apps/firmware/micropython-esp32c6/README.md)

---

> Naming: Baggage Recovery Copilot is the project name. SmartTag refers to the physical NFC/E-paper baggage tag. Existing repository URLs, APK filenames, API paths, package names and protocol identifiers retain their legacy names for compatibility.

## 1. Project Overview

**Baggage Recovery Copilot** is a baggage transfer and recovery prototype connecting the passenger mobile experience, reusable NFC/E-paper baggage tags, and ground operations.

The prototype includes:
1. **Passenger Mobile App**: Reconstructed Cathay Pacific mobile app shell with flight booking, baggage management, digital pass, and contactless NFC tag pairing with session acknowledgment and continuous tap loop protection.
2. **SmartTag Physical E-ink Hardware**: Standalone ESP32-C6 firmware with PN532 Type-4A card emulation, offline IATA 10-digit Interleaved 2 of 5 barcode generation, and Waveshare 4.2" bi-stable E-Paper display with power-cycle cold reset.
3. **Ground Staff Operations Portal**: Next.js 15 transfer control dashboard featuring flight-first baggage tracking, tight connection alerts, and an **Baggage Recovery Copilot** (draggable Grammarly-style floating AI widget).
4. **Data Layer**: Supabase PostgreSQL schema with milestone event auditing and Row-Level Security (RLS).
5. **Backend API**: FastAPI with PostgreSQL migrations and Cloud Run / RDS production deployment runbooks.

---

## 2. Monorepo Architecture

```text
polyaero-cathay-smarttag/
├── apps/
│   ├── api/            # FastAPI backend, Alembic migrations, Cloud Run deployment
│   ├── firmware/       # ESP32-C6 MicroPython firmware (PN532 NFC + 4.2" E-Paper)
│   │   └── micropython-esp32c6/
│   ├── mobile/         # React Native + Expo SDK 52 + Expo Router v4 (Android APK)
│   └── staff/          # Next.js 15 App Router Ground Staff Portal
├── packages/
│   ├── shared/         # TypeScript domain models, NFC protocol engine, test fixtures
│   └── design-tokens/  # Semantic tokens (Cathay jade, PolyAero accent, typography)
├── supabase/
│   └── migrations/     # PostgreSQL schema, RLS policies, realtime publications
├── tests/
│   └── maestro/        # Maestro mobile smoke test
├── docs/               # Architecture, UI reconstruction guide, hardware specs & photos
│   └── hardware/       # Pinout tables, circuit schematics, and prototype photos
└── .github/            # GitHub Actions CI, APK release builds, and PR templates
```

---

## 3. Getting Started

### Prerequisites
- Node.js: `v20.x` or `v22.x` (Tested on `v22.21.0`)
- pnpm: `v10.x` (`corepack enable pnpm` or `npm install -g pnpm`)

### Install Dependencies
```bash
pnpm install
```

### Run the Mobile Application (Expo)
```bash
pnpm dev:mobile
```
- Press `w` to open in a web browser.
- Or scan the terminal QR code using Expo Go on iOS / Android.

### Run the Ground Staff Portal (Next.js)
```bash
pnpm dev:staff
```
Open `http://localhost:3000` to access the ground staff dashboard.

### Run the Backend API

See [API setup and deployment](apps/api/README.md) for local PostgreSQL setup,
environment variables, migrations, and Python checks.

For the one-day cloud demo, the backend runs on Google Cloud Run and connects
to AWS RDS PostgreSQL using verified TLS. The deployment script creates a
static outbound IP for the AWS firewall and keeps secrets in Google Secret
Manager. Local and AWS databases remain separate, even when both are named
`smarttag`.

This is not a production release: some routes still lack authorization and
baggage demo state resets when the server instance is replaced. Do not use
real passenger data. Cloud NAT, reserved IPs, and database resources can incur
charges; follow the API README's cleanup instructions after the hackathon.

### Verification & Quality Gates
```bash
pnpm lint        # Run ESLint across all workspaces
pnpm typecheck   # Type-check all packages with TypeScript strict mode
pnpm test        # Run Vitest unit test suite in @polyaero/shared
pnpm build:staff # Production build of Next.js Staff Portal
```

---

## 4. Screenshot-Driven UI Reconstruction Workflow

This repository is in the foundation phase. No speculative Cathay Pacific UI has been invented.

When reference screenshots of the official Cathay Pacific application are provided:
1. Place raw screenshots into `reference-screenshots/` (excluded from Git).
2. Log each screen in `docs/screen-inventory.md`.
3. Follow the 10-step protocol in `docs/ui-reconstruction-plan.md`.
4. Implement components strictly inside `apps/mobile/src/features/cathay-shell/`.

---

## 5. Scope: Implementation Status & Architecture

| Component | Status | Production Implementation |
|:---|:---|:---|
| **Cathay App Shell** | ✅ Complete | Reconstructed Cathay Pacific mobile app shell with brand Cathay Sans typography, flight bookings, and digital boarding pass. |
| **SmartTag NFC Linking** | ✅ Complete | Native NFC (`react-native-nfc-manager` + Android intent dispatch) with ISO-DEP Type-4A NDEF & PA1 protocol, session ACK protection against repeated tap loops. Packaged in [Release APK v1.0.0](https://github.com/lighthouse16/polyaero-cathay-smarttag/releases/tag/v1.0.0). |
| **Physical E-ink Tag** | ✅ Complete | Standalone MicroPython firmware on **ESP32-C6** + **Waveshare PN532 NFC HAT** + **Waveshare 4.2" E-Paper V2**. Autonomous offline IATA barcode rendering, zero WiFi dependency, cold reset on power cycle. |
| **Ground Staff Portal** | ✅ Complete | Live on [Vercel](https://cathay.haidangtrih.me/#transfer-control). Flight-first transfer control dashboard, connection risk tracking, and draggable Grammarly-style **Baggage Recovery Copilot**. |
| **Data & Backend API** | ✅ Complete | FastAPI with PostgreSQL migrations and Supabase auditing for immutable baggage milestone events. |

---

## 6. Physical SmartTag Hardware Architecture & Prototype

The physical prototype integrates an **ESP32-C6**, **Waveshare PN532 NFC HAT** (operating in ISO/IEC 14443-4 Type-A Card Emulation Mode), and a **Waveshare 4.2" E-Paper Module** (monochrome 400x300 bi-stable display).

### Prototype Photos

| Standby / Ready to Pair (Cold Reset) | Paired & Rendered Baggage Tag |
| :---: | :---: |
| <img src="docs/hardware/smarttag-ready-to-pair-standby.jpg" width="340" alt="Standby Screen" /> | <img src="docs/hardware/smarttag-paired-baggage-tag.jpg" width="340" alt="Paired Tag Screen" /> |
| *Cold reset standby screen on power cycle.* | *Live tag rendered on phone NFC tap (CX548 to NRT).* |

### Hardware Architecture & Interconnection

```mermaid
flowchart TD
    subgraph Mobile ["📱 Passenger Smartphone"]
        App["Cathay Mobile App (Expo / React Native)"]
        NfcChip["NFC Controller (ISO-DEP / NDEF)"]
        App -->|"Tap to Tag"| NfcChip
    end

    subgraph SmartTag ["🏷️ PolyAero SmartTag Physical Prototype"]
        subgraph NFC_Mod ["Waveshare PN532 NFC HAT"]
            Antenna["13.56 MHz NFC Antenna"]
            PN532["PN532 NFC Chip (Card Emulation)"]
            Antenna <--> PN532
        end

        subgraph MCU ["ESP32-C6 Microcontroller (MicroPython Firmware)"]
            Boot["boot.py (Cold Boot Init)"]
            Handler["nfc_handler.py (ISO-DEP / PA1 APDU)"]
            Engine["layout.py + barcode.py (IATA ITF-10 Engine)"]
            Driver["epaper4in2.py (Waveshare V2 SPI Driver)"]
            Boot --> Handler
            PN532 <-->|"HSU UART: GPIO 22 (RX) / 23 (TX) / 7 (RST)"| Handler
            Handler -->|"Baggage Payload (CX548 / NRT)"| Engine
            Engine -->|"300x400 1-bit Buffer"| Driver
        end

        subgraph EPD ["Waveshare 4.2\" E-Paper Module (V2)"]
            Panel["400x300 Bi-stable E-ink Display"]
            Driver -->|"SPI: MOSI:19, SCK:21, CS:18, DC:2, RST:3, BUSY:6"| Panel
        end
    end

    NfcChip <-->|"Near-Field Coupling (13.56 MHz)"| Antenna
    Panel -.->|"Zero-power persistent image"| Barcode["IATA 10-Digit Barcode (CX548 to NRT)"]
```

See the [Hardware Documentation & Pinout Specification](docs/hardware/README.md) and [Firmware Source Code](apps/firmware/micropython-esp32c6/README.md) for full circuit schematics, timing parameters, and unit tests.

---

## 7. Hardware & Platform Limitations

- **Passive RF E-ink**: The hardware prototype uses passive RF energy harvesting simulation without an internal battery.
- **Expo Go vs Dev Client**: Standard Expo Go does not bundle native NFC libraries (`react-native-nfc-manager`). Testing on physical E-ink tags requires the standalone release APK build (available in [GitHub Releases](https://github.com/lighthouse16/polyaero-cathay-smarttag/releases)).
- **Barcode Readability**: Standard IATA 10-digit license plate numbers use Interleaved 2 of 5. Tested and verified readable with handheld optical barcode imagers.
- **IoT Bridge**: The ESP32 runs PN532 in target mode, so the phone writes NDEF directly into the tag.

---

## 8. Contributing & Collaboration

See [Collaboration Guide](docs/collaboration-guide.md) for branch naming conventions (`feat/cathay-ui`, `feat/smarttag-mobile`, `feat/backend`, `feat/staff-portal`) and PR requirements.
