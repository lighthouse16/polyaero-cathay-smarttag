# Cathay SmartTag — NFC-to-E-Paper End-to-End Integration Manual

**System Revision:** 1.0 (Hackathon Release)  
**Date:** November 2026  
**Architecture:** PolyAero Aviation Architecture / Cathay SmartTag Prototype  
**Target Hardware:** ESP32-C6 DevKit + Waveshare PN532 NFC HAT + Waveshare 4.2" B/W E-Paper Module V2  
**Target Mobile App:** Cathay SmartTag Standalone Android APK (`com.polyaero.smarttag`)  

---

## 1. Hardware Architecture Overview

The system bridges mobile airline baggage check-in with physical e-paper baggage tags through standard NFC Forum Type 2 wireless data exchange.

```
+-----------------------------------------------------------------------------------+
|                                AIRSIDE DEMO SYSTEM                                |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +------------------------+                +----------------------------------+   |
|  |   Android Smartphone   |                |     NFC Forum Type 2 Tag /       |   |
|  |  (Cathay SmartTag APK) |   NFC (13.56M) |        NTAG213 / NTAG215         |   |
|  |                        |  ============> |                                  |   |
|  |  - Generate PA2 Tag    |   ISO14443A    |  - Page 0..3: Serial/Lock        |   |
|  |  - Write NDEF Payload  |   NDEF Write   |  - Page 4..39: NDEF Message      |   |
|  |  - Live RF Readback    |                |    (PA2|1|ST-2048|...|D082)      |   |
|  +------------------------+                +-----------------+----------------+   |
|                                                              |                    |
|                                                              | Tap & Read         |
|                                                              | (13.56 MHz)        |
|                                                              v                    |
|  +-----------------------------------------------------------------------------+  |
|  |                      CATHAY SMARTTAG RECEIVER UNIT                          |  |
|  |                                                                             |  |
|  |  +-----------------------+     I2C (SDA:6, SCL:7)   +--------------------+  |  |
|  |  |  Waveshare PN532 HAT  | <======================> | ESP32-C6 DevKit    |  |  |
|  |  |  (NFC Reader/Writer)  |     IRQ:2, RST:3         | (DevKitC-1-N16-M)  |  |  |
|  |  +-----------------------+                          |                    |  |  |
|  |                                                     | - Parse PA2        |  |  |
|  |                                                     | - Check CRC-16     |  |  |
|  |                                                     | - Monotonic Rev    |  |  |
|  |                                                     | - NVS Persistence  |  |  |
|  |                                                     | - 1-bit FB Render  |  |  |
|  |                                                     +---------+----------+  |  |
|  |                                                               |             |  |
|  |                                                               | SPI         |  |
|  |                                                               | (CS:18,     |  |
|  |                                                               |  DC:19,     |  |
|  |                                                               |  RST:20,    |  |
|  |                                                               |  BUSY:21,   |  |
|  |                                                               |  SCK:10,    |  |
|  |                                                               |  MOSI:11)   |  |
|  |                                                               v             |  |
|  |                                                     +--------------------+  |  |
|  |                                                     | Waveshare 4.2" EPD |  |  |
|  |                                                     | (SSD1683, 400x300) |  |  |
|  |                                                     | Full IATA Label    |  |  |
|  |                                                     +--------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Verified Component Inventory

| Component | Part / Revision | Notes / Constraints |
| :--- | :--- | :--- |
| **Microcontroller** | ESP32-C6-DEV-KIT-N16-M (ESP32-C6-WROOM-1) | RISC-V 32-bit core @ 160MHz, 16MB Flash, 3.3V GPIO tolerance (**Max 3.6V**). |
| **NFC Transceiver** | Waveshare PN532 NFC HAT (14112) | 13.56 MHz, supports ISO14443A/B, MIFARE, FeliCa. Configurable via 2-position slide switch & 8-pin DIP switch. |
| **E-Paper Display** | Waveshare 4.2-inch E-Paper Module V2 (Black/White) | 400x300 resolution, SSD1683 controller, embedded TXS0108E voltage level translator, partial and full refresh. |
| **Passive NFC Media** | NTAG213 / NTAG215 / NTAG216 Sticker or Card | **Primary target:** Standard Type 2 NFC tag formatted as NDEF. 144–888 bytes user memory. |
| **Supplied Key Fob** | Blue NFC Fob (MIFARE Classic 1K) | **Limitation:** Uses proprietary NXP Crypto-1 authentication. Not standard NDEF formatted. Detected by UID scanning; write rejected cleanly with clear guidance. |
| **Mobile Device** | Android NFC Smartphone (Android 8.0+) | Runs `CathaySmartTag-NFC-Hardened-Preview.apk`. Standalone offline operation. |

---

## 3. NFC Payload Protocol Specification

### 3.1 Privacy by Design (PII-Free)
To ensure passenger data safety and comply with aviation security standards, **no Personally Identifiable Information (PII)** is ever stored on the physical NFC tag or transmitted over the air:
- **Forbidden on tag:** Passenger full names, email addresses, phone numbers, passport numbers, Asia Miles credentials, payment tokens.
- **Allowed on tag:** Anonymized Tag ID (`ST-XXXX`), 10-digit IATA 10-digit Bag Tag Number (`0160XXXXXX`), Flight Number (`CX548`), Origin IATA (`HKG`), Destination IATA (`NRT`), Operational Status (`TAGGED`), Revision Counter (`1`), and 16-bit CRC checksum.

### 3.2 Canonical Protocol Format (`PA2`)
Payloads are compact UTF-8 strings delimited by vertical pipe (`|`):

```
PA2|<version>|<tagId>|<bagId>|<flight>|<from>|<to>|<status>|<revision>|<crc16>
```

#### Field Specifications:
| Index | Field | Format / Constraints | Example | Description |
| :---: | :--- | :--- | :--- | :--- |
| 0 | Prefix | `PA2` | `PA2` | PolyAero Protocol Revision 2 |
| 1 | Version | `1` | `1` | Schema version number |
| 2 | Tag ID | Alphanumeric, max 16 chars | `ST-2048` | Physical tag identifier |
| 3 | Bag ID | Numeric, exactly 10 digits | `0160123456` | IATA 10-digit baggage barcode number |
| 4 | Flight | 2-3 char airline + 1-4 digits | `CX548` | Operating flight number |
| 5 | From | 3 uppercase letters | `HKG` | Origin airport IATA code |
| 6 | To | 3 uppercase letters | `NRT` | Destination airport IATA code |
| 7 | Status | Uppercase string, max 32 chars | `TAGGED` | Operational status (TAGGED, IN_TRANSIT, READY_FOR_COLLECTION) |
| 8 | Revision | Monotonic integer (`0..4294967295`) | `1` | Increments on every bag retagging or state transition |
| 9 | CRC-16 | 4 hex digits (`0000..FFFF`) | `D082` | CRC-16-CCITT computed over fields 0..8 |

**Canonical Example:**
```
PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|D082
```
Length: 52 ASCII characters (52 bytes).

### 3.3 CRC-16-CCITT Definition
- **Polynomial:** `0x1021` ($x^{16} + x^{12} + x^5 + 1$)
- **Initial Value:** `0xFFFF`
- **Reflection:** None (MSB-first)
- **Final XOR:** `0x0000`
- **Scope:** Computed over all characters preceding the final pipe (e.g. `PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1`).

### 3.4 Type 2 Tag NDEF Memory Layout
In standard NTAG213 tags, the text record is encoded as an NFC Forum Type 2 NDEF TLV:
- **Pages 0–3:** Serial Number, Lock bytes, CC (Capability Container = `E1 10 12 00` for NTAG213).
- **Page 4 (0x04):** `0x03` (NDEF TLV tag), followed by length byte `0x3B` (59 bytes NDEF message).
- **NDEF Record Header:** `0xD1` (MB=1, ME=1, SR=1, TNF=0x01 Well-Known), Type len `0x01`, Payload len `0x37` (55 bytes), Type `'T'`.
- **Payload:** Status byte `0x02` (UTF-8, 2-byte lang code `'e' 'n'`), followed by 52 bytes of `PA2|...`.
- **Terminator:** `0xFE` (Terminator TLV).

Total occupied user memory: 62 bytes (`0x03 0x3B <59B NDEF> 0xFE`). This easily fits in the smallest NTAG213 tag (144 bytes user space, >56% headroom).

---

## 4. Physical Wiring & Interface Configuration

> [!CAUTION]
> **3.3V Logic Level Safety:**
> The ESP32-C6 GPIOs are strictly **3.3V tolerant** with an absolute maximum rating of **3.6V**. Never apply 5.0V directly to any GPIO pin.
> The Waveshare 4.2" E-paper module has an onboard bidirectional level translator (TXS0108E) referenced to `VCC`. Connect `VCC` exclusively to the ESP32-C6 **3.3V** pin.

### 4.1 Waveshare PN532 Mode Selection
The Waveshare PN532 NFC HAT features an interface selection switch (`I1 / I0`) and an 8-position DIP switch (`SCK MISO MOSI NSS SCL SDA RX TX`).

| Interface Mode | Mode Switch (`I1 I0`) | 8-Pin DIP Switch Positions | Status in Firmware |
| :--- | :---: | :---: | :--- |
| **I2C (Recommended)** | **L H** | `0 0 0 0 1 1 0 0` (Pins 5 & 6 `ON`) | **Default firmware build (`PN532_MODE_I2C=1`)** |
| **SPI** | **H L** | `1 1 1 1 0 0 0 0` (Pins 1..4 `ON`) | Supported via build flag (`PN532_MODE_SPI=1`) |
| **UART (HSU)** | **L L** | `0 0 0 0 0 0 1 1` (Pins 7 & 8 `ON`) | Alternative host interface |

*Note: In the table above, `1 = ON / Closed`, `0 = OFF / Open`.*

### 4.2 Breadboard Wiring Table (ESP32-C6 DevKit)

> [!WARNING]
> All breadboard jumper connections listed below are the firmware default assignments and must be treated as **UNVERIFIED** until confirmed on your physical bench. Default pins avoid ESP32-C6 strapping pins (`GPIO 4, 5, 8, 9, 15`) and USB D-/D+ (`GPIO 12, 13`).

#### E-Paper Module (Waveshare 4.2" V2):
| E-Paper Wire | Pin Name | ESP32-C6 GPIO Pin | Electrical Spec |
| :--- | :--- | :--- | :--- |
| **Red** | `VCC` | `3V3` | 3.3V Power Supply |
| **Black** | `GND` | `GND` | Common Ground |
| **Blue** | `DIN` (MOSI) | `GPIO 11` (`PIN_EPD_MOSI`) | SPI Data Out (Master -> Display) |
| **Yellow** | `CLK` (SCK) | `GPIO 10` (`PIN_EPD_SCK`) | SPI Clock Out |
| **Orange** | `CS` | `GPIO 18` (`PIN_EPD_CS`) | Active-Low Chip Select |
| **Green** | `DC` | `GPIO 19` (`PIN_EPD_DC`) | Data / Command Control |
| **White** | `RST` | `GPIO 20` (`PIN_EPD_RST`) | Active-Low Hardware Reset |
| **Purple** | `BUSY` | `GPIO 21` (`PIN_EPD_BUSY`) | Active-High Busy Output (Safe 3.3V) |

#### PN532 Module (I2C Mode — Default):
| PN532 Pin | ESP32-C6 Pin | Function / Notes |
| :--- | :--- | :--- |
| `VCC` | `3V3` | Regulated 3.3V from ESP32-C6 DevKit (`<=3.6V` safe logic) |
| `GND` | `GND` | Common Ground |
| `SDA` | `GPIO 6` (`PIN_PN532_SDA`) | I2C Data Line (External pull-up to 3.3V on HAT) |
| `SCL` | `GPIO 7` (`PIN_PN532_SCL`) | I2C Clock Line (External pull-up to 3.3V on HAT) |
| `RSTPD_N` (RST) | `GPIO 3` (`PIN_PN532_RST`) | PN532 Hardware Reset (Active Low) |
| `IRQ` | `GPIO 2` (`PIN_PN532_IRQ`) | PN532 Data Ready Interrupt |

#### PN532 Module (SPI Alternative Mode):
| PN532 Pin | ESP32-C6 Pin | Function / Notes |
| :--- | :--- | :--- |
| `SCK` | `GPIO 10` | Shared with EPD SCK |
| `MOSI` | `GPIO 11` | Shared with EPD MOSI |
| `MISO` | `GPIO 1` | SPI Master In / Slave Out |
| `NSS` (CS) | `GPIO 0` | Dedicated PN532 Chip Select (Active Low) |
| `RST` | `GPIO 3` | Reset |

---

## 5. Firmware Installation & Flashing Guide

### 5.1 Prerequisites
- Python 3.10+ with `uv` or `pip`
- PlatformIO Core:
  ```powershell
  uv tool run platformio --version
  ```

### 5.2 Build Firmware
Navigate to the firmware directory and trigger the build:
```powershell
cd D:\projects\Hack\polyaero-cathay-smarttag\firmware\esp32-c6-smarttag
uv tool run platformio run
```

Expected binary output:
- Firmware: `.pio/build/esp32-c6-devkitc-1/firmware.bin`
- Flash offset: `0x10000`

### 5.3 Flashing to ESP32-C6
Connect the ESP32-C6 DevKit via USB-C to your development machine:
```powershell
# Flash firmware and upload filesystem
uv tool run platformio run --target upload --upload-port COMx
```
*(Replace `COMx` with your actual device port, e.g. `COM5`).*

### 5.4 Serial Monitor & Debugging
Run the serial monitor at **115200 baud**:
```powershell
uv tool run platformio device monitor -b 115200
```

#### Expected Boot Log:
```
=============================================================
  Cathay SmartTag NFC-to-E-Paper Gateway (ESP32-C6) v2.0.0
  PolyAero Aviation Architecture — Protocol PA2 (CRC-16)
=============================================================
[SMARTTAG-CFG] PN532 Interface: I2C (SDA=6, SCL=7, IRQ=2, RST=3)
[SMARTTAG-CFG] E-Paper Interface: SPI (CS=18, DC=19, RST=20, BUSY=21, SCK=10, MOSI=11)
[SMARTTAG-CFG] WARNING: All breadboard pin mappings UNVERIFIED on physical hardware.
[SMARTTAG-CFG] 3.3V Logic Safety: ESP32-C6 GPIOs accept 3.6V max. Power EPD at 3.3V VCC.
[SMARTTAG-EPD] Configuring ESP32-C6 SPI bus and Waveshare 4.2" E-paper display...
[SMARTTAG-EPD] Display initialized.
[SMARTTAG-NVS] Restored valid baggage state from NVS: Tag=ST-2048 Bag=0160123456 Flight=CX548 Rev=1
[SMARTTAG-EPD] Restoring cached baggage tag from NVS cold-boot...
[SMARTTAG-PN532] Found chip PN532, Firmware ver. 1.6
[SMARTTAG-PN532] SAM configured. Listening for ISO14443A NFC targets...
```

---

## 6. Android APK Installation & Operation Guide

### 6.1 APK Delivery & Sideloading
The verified standalone release APK is located at:
```
artifacts/CathaySmartTag-NFC-Hardened-Preview.apk
```

To install via ADB:
```powershell
adb install -r artifacts/CathaySmartTag-NFC-Hardened-Preview.apk
```
Or transfer the `.apk` file to the phone's internal storage and open via Android File Manager.

### 6.2 Application Permissions
- `android.permission.NFC`: Mandatory for hardware scanning and writing.
- `android.hardware.nfc`: Required feature flag declared in AndroidManifest.

### 6.3 Operating the Mobile Write Flow
1. Open **Cathay SmartTag** on the phone.
2. Select or view the assigned demo baggage card (Flight `CX548` HKG -> NRT, Bag Tag `0160123456`).
3. Scroll to the **"Physical Tag Hardware Sync"** section.
4. Tap the green **"Write NFC Tag (NDEF)"** button.
5. The 6-stage lifecycle progress bar will display:
   - `READY` -> `TAG_DETECTED` -> `COMPATIBILITY_CHECK` -> `WRITING_NDEF` -> `READING_BACK` -> `VERIFIED`.
6. Hold an NTAG213 tag against the Android phone's NFC antenna (usually upper back of device).
7. Upon successful write and live RF readback verification, the app displays:
   > **"NFC data written and verified."**  
   > *59 bytes read back cleanly. Display will update on reader tap.*

---

## 7. Complete 10-Step End-to-End Demonstration Procedure

For the live hackathon presentation, follow this strict step-by-step script:

1. **Power Receiver:** Connect ESP32-C6 to USB battery pack or laptop. Observe E-paper displaying the cached baggage label from NVS, or the standby prompt.
2. **Launch Mobile App:** Launch the Cathay SmartTag app on Android. Ensure NFC is enabled in Android Settings.
3. **Select Bag:** Open Bag `0160123456` on flight `CX548` to Tokyo Narita (`NRT`).
4. **Trigger Mobile Write:** Tap **"Write NFC Tag (NDEF)"**. The prompt instructions read: *"Hold an NTAG213/215/216 tag against phone antenna..."*.
5. **Tap Tag to Phone:** Touch the writable NTAG213 card to the back of the phone.
6. **Observe Mobile Verification:** Watch the progress indicators advance to **VERIFIED**. Readout shows: `"59 bytes read back cleanly"`.
7. **Present Tag to Receiver:** Move the physical NFC tag from the phone to the Waveshare PN532 antenna on the breadboard.
8. **Watch Serial / E-Paper Update:** The PN532 detects the tag, extracts the NDEF payload, verifies CRC-16 `0xD082`, and triggers E-Paper refresh.
9. **Inspect Display:** The 4.2" E-Paper renders the full airline tag:
   - Airline: `CATHAY PACIFIC`
   - Destination: `NRT` (Tokyo Narita)
   - Flight: `CX548`
   - Bag Tag Barcode: IATA Interleaved 2 of 5 with human-readable `0160123456`
   - Status badge: `TAGGED`
10. **Cold Reboot Test:** Disconnect USB power from ESP32-C6 and reconnect. Because E-paper is bi-stable and state is saved in NVS, the exact flight information persists seamlessly.

---

## 8. Error Handling, Transaction Integrity & Troubleshooting Matrix

### 8.1 Firmware Transaction Integrity Pipeline
To prevent wedged states where NVS records a new revision before the physical display updates, the firmware executes a transactional 4-stage pipeline:
```
VALIDATE NFC -> RENDER CANDIDATE -> REFRESH DISPLAY -> COMMIT NEW REVISION
```

1. **Staged Candidate Rendering**: The candidate tag is rendered into the frame buffer without touching the committed record in RAM or NVS.
2. **Guarded Refresh**: GxEPD2 initiates SPI transfer and checks `PIN_EPD_BUSY`. Completion is recorded as **driver-reported refresh completion** (not optical verification).
3. **Rollback on Refresh Failure**: If BUSY times out (>5s) or fails, the candidate is discarded, RAM state stays at the previous revision, and the passenger can retry the exact same revision without error.
4. **Durable NVS Commit**: Only after driver-reported refresh completion is the new revision saved to NVS and promoted to `s_last_record`.
5. **Cold-Boot Recovery Policy**: Stored two-phase marker (`tx_state`):
   - `COMMITTED`: Loads baggage label and restores display.
   - `PENDING`: Power was interrupted mid-refresh; re-renders and completes display cycle, then finalizes `COMMITTED`.
   - `IDLE` / Empty: Renders standby prompt.

### 8.2 Safe Physical Bench Verification Procedure (Gate 7 Fault Injection)
> [!CAUTION]
> **Safety Rule:** Never short GPIO lines (`PIN_EPD_BUSY`) or pull live jumper wires to simulate hardware failures. Use the firmware's built-in Serial command `INJECT_BUSY_TIMEOUT_ONCE`.

1. **Flash Firmware:** After explicit hardware authorization and breadboard GPIO verification, flash `firmware.bin` onto ESP32-C6 (`uv tool run platformio run -t upload`).
2. **Scan Initial Revision:** Tap a valid PA2 Revision 1 NTAG213 card against the PN532 antenna.
3. **Confirm Initial Update:** Confirm `[SMARTTAG-EPD] E-Paper refresh completed (driver-reported completion)` and `[SMARTTAG-NVS] Durably COMMITTED state to NVS` appear in Serial monitor (115200 baud), and the E-paper renders Revision 1.
4. **Simulate Pre-Refresh BUSY Failure:** In Serial monitor, send `INJECT_BUSY_TIMEOUT_ONCE`. Tap a valid Revision 2 card.
5. **Verify Non-Commit:** Observe `[SMARTTAG-FAULT] Injected BUSY timeout fault` and `[SMARTTAG-NFC] TRANSACTION ABORTED`. Send `STATUS` over Serial and verify committed revision remains `1`.
6. **Restore Normal Operation:** The one-shot fault injection flag automatically resets after blocking the simulated refresh; no wiring manipulation needed.
7. **Rescan Same NFC Payload:** Rescan the exact same Revision 2 NTAG213 card without incrementing its revision.
8. **Confirm Retry Acceptance:** Confirm `[SMARTTAG-NFC] TRANSACTION COMMITTED: New baggage payload active! Revision 2` appears and the E-paper updates cleanly.
9. **Power-Cycle Verification:** Unplug USB power completely from ESP32-C6, reconnect after 5 seconds, and confirm `[SMARTTAG-NVS] Restored baggage state: ... Rev=2 (Marker=COMMITTED)` on Serial boot log.

### 8.3 Troubleshooting Matrix

| Symptom / Error | Root Cause | System Response | Recovery Action |
| :--- | :--- | :--- | :--- |
| **Mobile:** `NFC_WRITE_READONLY` | Tag has lock bytes set permanently | Mobile halts write before sending NDEF | Use fresh, unlocked NTAG213 tag. |
| **Mobile:** `NFC_WRITE_OVERSIZE` | Tag capacity is smaller than payload | Mobile rejects write | Use NTAG213 (144B) or larger. |
| **Mobile:** `NFC_TAG_REMOVED` | Phone moved away before RF readback | Mobile prompts: *"Tag lost during write"* | Keep tag stationary against antenna for 1 full second. |
| **Mobile:** `NFC_VERIFICATION_MISMATCH` | RF interference or bad write cycle | Mobile flags verification error | Re-tap tag and write again. |
| **Mobile:** Blue Fob warning | Blue Fob is MIFARE Classic 1K | App detects 4-byte UID and warns user | Use standard NTAG213 sticker. |
| **Receiver:** `Didn't find PN53x board` | Incorrect DIP switches or bad jumpers | ESP32-C6 logs error and retries | Verify DIP pins 5 & 6 are ON for I2C, check SDA=GPIO6, SCL=GPIO7. |
| **Receiver:** `CRC mismatch` | Corrupted RF transmission | ESP32-C6 rejects payload; preserves last display | Re-tap tag firmly against PN532 antenna. |
| **Receiver:** `Stale revision` | Tag revision is older than displayed | ESP32-C6 ignores duplicate tag tap | Mobile increments revision on new bag assignment. |
| **Receiver:** E-Paper BUSY timeout | Panel busy or SPI communication dropped | Refresh aborted; RAM and NVS state preserved | Retry same tag tap once BUSY clears. No rev bump required. |
| **Receiver:** NVS persistence error | Flash write failure | Display updated; transaction error logged; not marked committed | Re-tap tag or reboot unit. |

---

## 9. Test Evidence & Verification Record

### 9.1 Automated Software & Logic Tests (100% Passed)
- **Protocol, Flow & Storage Unit Tests (`packages/shared`, Vitest):** 46 tests passed (13 in `nfcProtocol.test.ts`, 13 in `shared.test.ts`, 20 in `smarttag-flow.test.ts`) verifying CRC-16 CCITT, strict 10-digit IATA numeric plate enforcement, strict ITF-2of5 encoding, monotonic NDEF revision persistence across restarts, and storage write-failure rollback.
- **Node Integration Tests (`tests/*.test.cjs`):** 32 tests passed verifying NFC UI state machine, NDEF write/readback verification, Blue Fob rejection, persistent storage durability, and `+1 Rev` recovery.
- **C++ Protocol, Display & Transaction Suite (`test/test_protocol.cpp`):** 17 tests compiled with `-Wall -Wextra` via MSYS2 GCC passed:
  - CRC-16 CCITT computation against aviation test vectors (`0xD082`).
  - Strict 10-digit numeric baggage ID enforcement & revision overflow bounds.
  - Dynamic Type 2 TLV sizing (`smarttag_estimate_type2_total_bytes`) across short and extended TLVs.
  - Legacy PA1 backward compatibility.
  - 400x300 framebuffer rendering and ITF-2of5 barcode layout.
  - Live extraction of 52-byte text payload from actual 59-byte `react-native-nfc-manager` Type 2 TLV bytes.
  - **Transaction Scenario 1:** Successful refresh followed by successful persistence -> `COMMITTED`.
  - **Transaction Scenario 2:** BUSY timeout before/during refresh -> State preserved, no commit.
  - **Transaction Scenario 3:** Retry of same revision after failed refresh -> Accepted and commits.
  - **Transaction Scenario 4:** Duplicate payload already displayed -> Suppressed with zero SPI transfer.
  - **Transaction Scenario 5:** Rejection of older revision (`PROG_STALE`).
  - **Transaction Scenario 6:** Rejection of equal-revision conflicting payload.
  - **Transaction Scenario 7:** Failure during NVS persistence -> Non-durable error reported; RAM record untouched.
  - **Transaction Scenario 8:** Crash / power-loss recovery across cold-boot states (`PENDING` -> re-refreshed and committed; `COMMITTED` -> loaded; `IDLE` -> standby).
- **Monorepo Builds & Static Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm build:staff`, `expo export --platform web`, `expo-doctor` (20/20), PlatformIO ESP32-C6 build, and Android Gradle `assembleRelease` all passed cleanly.

### 9.2 Physical Bench Verification Gates (Gates 1–8)
Due to the absence of locally attached physical devices (`adb devices` empty, no serial `COM` port detected), bench gates are recorded with strict truthfulness:

| Gate | Description | Status | Notes / Verification Evidence |
| :---: | :--- | :---: | :--- |
| **Gate 1** | Software Build, Signing & Automated Suites | **PASS** | APK signed (`v2`), firmware `firmware.bin` built, 46 Vitest + 32 Node + 17 C++ tests passed. |
| **Gate 2** | Breadboard Wiring & 3.3V Logic Level Check | **NOT EXECUTED** | No physical bench connected; GPIO table marked `UNVERIFIED`, avoids strapping pins (`GPIO4/5/8/9/15`). |
| **Gate 3** | ESP32-C6 Firmware Flash & Serial Boot Log | **NOT EXECUTED** | Requires physical USB-C COM connection; `firmware.bin` binary ready. |
| **Gate 4** | PN532 I2C Detection & NTAG213 Read Test | **NOT EXECUTED** | Requires PN532 hardware + NTAG213 tag; Type 2 TLV extractor verified on host. |
| **Gate 5** | Waveshare 4.2" E-Paper SPI Refresh Test | **NOT EXECUTED** | Requires V2 SSD1683 E-paper module; framebuffer + ITF barcode verified on host. |
| **Gate 6** | Android APK NFC Write & Live Readback | **NOT EXECUTED** | Requires NFC-enabled Android device + NTAG213 sticker. |
| **Gate 7** | End-to-End Tap & Safe Fault Injection | **NOT EXECUTED** | Verified via host transaction harness; bench test uses safe Serial `INJECT_BUSY_TIMEOUT_ONCE` command (no pin shorting). |
| **Gate 8** | Power Cycle & NVS Cold-Boot Persistence | **NOT EXECUTED** | ESP32 NVS two-phase marker recovery & mobile `PersistentStorageAdapter` verified via software test harness. |

---

## 10. Known Limitations & Future Roadmap

1. **Bi-Stable Zero-Quiescent Power:**
   The Waveshare 4.2" E-paper module consumes 0.00 mW once an image is drawn. Future revisions will feature complete battery cutoff via a P-channel MOSFET on the ESP32-C6, waking up exclusively via PN532 IRQ interrupt on NFC RF field detection.
2. **Dual-Interface NTAG I2C Plus:**
   Instead of using a separate NFC transceiver (PN532), production baggage tags will integrate an NTAG I2C Plus chip wired directly between the antenna and the microcontroller via I2C. This eliminates the PN532 module entirely, reducing tag cost under $5.
3. **Passive RF Energy Harvesting:**
   With NTAG I2C energy harvesting or ultra-low-power e-paper drivers, the tag can draw all necessary update power directly from the passenger's smartphone NFC field during the tap, requiring zero onboard battery for the lifetime of the luggage.
