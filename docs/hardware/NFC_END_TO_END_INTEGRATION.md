# Cathay SmartTag — NFC-to-E-Paper End-to-End Integration Manual

**System Revision:** 1.0 (Hackathon Release)  
**Date:** November 2026  
**Architecture:** PolyAero Aviation Architecture / Cathay SmartTag Prototype  
**Target Hardware:** ESP32-C6 DevKit + Waveshare PN532 NFC HAT + Waveshare 4.2" B/W E-Paper Module V2  
**Target Mobile App:** Cathay SmartTag Standalone Android APK (`com.polyaero.cathaysmarttag`)  

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
|  |                                                               |  SCK:4,     |  |
|  |                                                               |  MOSI:5)    |  |
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
| **Mobile Device** | Android NFC Smartphone (Android 8.0+) | Runs `CathaySmartTag-NFC-Write-Preview.apk`. Standalone offline operation. |

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
Length: 51 ASCII characters (51 bytes).

### 3.3 CRC-16-CCITT Definition
- **Polynomial:** `0x1021` ($x^{16} + x^{12} + x^5 + 1$)
- **Initial Value:** `0xFFFF`
- **Reflection:** None (MSB-first)
- **Final XOR:** `0x0000`
- **Scope:** Computed over all characters preceding the final pipe (e.g. `PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1`).

### 3.4 Type 2 Tag NDEF Memory Layout
In standard NTAG213 tags, the text record is encoded as an NFC Forum Type 2 NDEF TLV:
- **Pages 0–3:** Serial Number, Lock bytes, CC (Capability Container = `E1 10 12 00` for NTAG213).
- **Page 4 (0x04):** `0x03` (NDEF TLV tag), followed by length byte `0x37` (55 bytes).
- **NDEF Record Header:** `0xD1` (MB=1, ME=1, SR=1, TNF=0x01 Well-Known).
- **Type:** `0x01` (`'T'` for RTD_TEXT).
- **Payload:** Status byte `0x02` (UTF-8, 2-byte lang code `'e' 'n'`), followed by 51 bytes of `PA2|...`.
- **Terminator:** `0xFE` (Terminator TLV).

Total occupied user memory: 59 bytes. This easily fits in the smallest NTAG213 tag (144 bytes user space, >56% headroom).

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
> All breadboard jumper connections listed below are the firmware default assignments and must be treated as **UNVERIFIED** until confirmed on your physical bench. Avoid ESP32-C6 strapping pins (GPIO 8, 9, 15) during cold boot if possible.

#### E-Paper Module (Waveshare 4.2" V2):
| E-Paper Wire | Pin Name | ESP32-C6 GPIO Pin | Electrical Spec |
| :--- | :--- | :--- | :--- |
| **Red** | `VCC` | `3V3` | 3.3V Power Supply |
| **Black** | `GND` | `GND` | Common Ground |
| **Blue** | `DIN` (MOSI) | `GPIO 5` (`PIN_EPD_MOSI`) | SPI Data Out (Master -> Display) |
| **Yellow** | `CLK` (SCK) | `GPIO 4` (`PIN_EPD_SCK`) | SPI Clock Out |
| **Orange** | `CS` | `GPIO 18` (`PIN_EPD_CS`) | Active-Low Chip Select |
| **Green** | `DC` | `GPIO 19` (`PIN_EPD_DC`) | Data / Command Control |
| **White** | `RST` | `GPIO 20` (`PIN_EPD_RST`) | Active-Low Hardware Reset |
| **Purple** | `BUSY` | `GPIO 21` (`PIN_EPD_BUSY`) | Active-High Busy Output (Safe 3.3V) |

#### PN532 Module (I2C Mode — Default):
| PN532 Pin | ESP32-C6 Pin | Function / Notes |
| :--- | :--- | :--- |
| `VCC` | `3V3` or `5V` | Regulated to 3.3V on HAT |
| `GND` | `GND` | Common Ground |
| `SDA` | `GPIO 6` (`PIN_PN532_SDA`) | I2C Data Line (External pull-up to 3.3V on HAT) |
| `SCL` | `GPIO 7` (`PIN_PN532_SCL`) | I2C Clock Line (External pull-up to 3.3V on HAT) |
| `RSTPD_N` (RST) | `GPIO 3` (`PIN_PN532_RST`) | PN532 Hardware Reset (Active Low) |
| `IRQ` | `GPIO 2` (`PIN_PN532_IRQ`) | PN532 Data Ready Interrupt |

#### PN532 Module (SPI Alternative Mode):
| PN532 Pin | ESP32-C6 Pin | Function / Notes |
| :--- | :--- | :--- |
| `SCK` | `GPIO 4` | Shared with EPD SCK |
| `MOSI` | `GPIO 5` | Shared with EPD MOSI |
| `MISO` | `GPIO 11` | SPI Master In / Slave Out |
| `NSS` (CS) | `GPIO 15` | Dedicated PN532 Chip Select (Active Low) |
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
  Cathay SmartTag NFC-to-E-Paper Gateway (ESP32-C6)
  Firmware Rev 1.0 — PolyAero Aviation Architecture
=============================================================
[SMARTTAG-CFG] PN532 Interface: I2C (SDA=6, SCL=7, IRQ=14, RST=15)
[SMARTTAG-CFG] E-Paper Interface: SPI (CS=23, DC=18, RST=5, BUSY=4, SCK=20, MOSI=22)
[SMARTTAG-CFG] WARNING: All breadboard pin mappings UNVERIFIED on physical hardware.
[SMARTTAG-EPD] Initializing Waveshare 4.2" E-paper display...
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
artifacts/CathaySmartTag-NFC-Write-Preview.apk
```

To install via ADB:
```powershell
adb install -r artifacts/CathaySmartTag-NFC-Write-Preview.apk
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

## 8. Error Handling & Troubleshooting Matrix

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
| **Receiver:** E-Paper not updating | Power supply droop or busy timeout | ESP32-C6 powers down SPI cleanly | Ensure ESP32-C6 is supplied with stable 5V / 1A USB power. |

---

## 9. Test Evidence & Verification Record

### 9.1 Automated Software & Logic Tests (100% Passed)
- **Protocol & CRC Unit Tests (`packages/shared`):** 10 Vitest tests verified CRC-16 CCITT, pipe serialization, and revision progression.
- **Node Integration Tests (`tests/nfc-integration.test.cjs`):** 3 tests verified NDEF message generation (59 bytes), state machine transitions, and error boundary handling.
- **C++ Protocol & TLV Extraction Suite (`test/test_protocol.cpp`):** 7 tests compiled with MSYS2 GCC passed:
  - CRC-16 CCITT computation against aviation test vectors.
  - Pipe-delimited parsing of `PA2|...`.
  - Stale and identical revision rejection.
  - Live extraction of 51-byte text payload from actual 59-byte `react-native-nfc-manager` Type 2 TLV bytes.

### 9.2 Physical Bench Tests Record
Due to development environment separation, physical hardware bench tests are cataloged with strict truthfulness:

| Test ID | Description | Execution Status | Evidence / Verification Method |
| :---: | :--- | :---: | :--- |
| **Test A** | Android NDEF write & live RF readback on NTAG213 | **NOT EXECUTED** | Logic verified via Android unit harness & mock NdefHandler. |
| **Test B** | Blue Fob MIFARE Classic write rejection | **NOT EXECUTED** | Handled by `isMifareClassic` detection in `hardwareScan.native.ts`. |
| **Test C** | PN532 I2C detection & NTAG213 page read | **NOT EXECUTED** | C++ TLV extractor verified against byte captures; driver compiled. |
| **Test D** | Waveshare 4.2" E-paper SPI refresh | **NOT EXECUTED** | Framebuffer generator & ITF barcode tested in C++ suite. |
| **Test E** | Corrupted CRC payload rejection | **NOT EXECUTED** | C++ test `test_corrupt_payload_rejected` PASSED on host. |
| **Test F** | NVS cold boot state recovery | **NOT EXECUTED** | Preferences logic implemented in `main.cpp`; requires hardware flash. |
| **Test G** | End-to-end phone -> tag -> receiver -> e-paper | **NOT EXECUTED** | Documented in Section 7 for live hackathon execution. |

---

## 10. Known Limitations & Future Roadmap

1. **Bi-Stable Zero-Quiescent Power:**
   The Waveshare 4.2" E-paper module consumes 0.00 mW once an image is drawn. Future revisions will feature complete battery cutoff via a P-channel MOSFET on the ESP32-C6, waking up exclusively via PN532 IRQ interrupt on NFC RF field detection.
2. **Dual-Interface NTAG I2C Plus:**
   Instead of using a separate NFC transceiver (PN532), production baggage tags will integrate an NTAG I2C Plus chip wired directly between the antenna and the microcontroller via I2C. This eliminates the PN532 module entirely, reducing tag cost under $5.
3. **Passive RF Energy Harvesting:**
   With NTAG I2C energy harvesting or ultra-low-power e-paper drivers, the tag can draw all necessary update power directly from the passenger's smartphone NFC field during the tap, requiring zero onboard battery for the lifetime of the luggage.
