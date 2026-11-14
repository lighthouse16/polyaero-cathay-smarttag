# PolyAero Cathay SmartTag — ESP32-C6 MicroPython Firmware

ESP32-C6 firmware for PN532 Type-4 Target (PICC emulation) + Waveshare 4.2" E-Paper display.

**Standalone operation**: Phone writes NDEF via NFC → PN532 receives → ESP32-C6 parses locally → E-Paper renders baggage tag. **No WiFi, no API calls from device.**

---

## Hardware

| Component | Connection | ESP32-C6 GPIO |
|-----------|------------|---------------|
| PN532 HAT (UART) | RX → ESP32 TX | 23 |
| PN532 HAT (UART) | TX → ESP32 RX | 22 |
| PN532 HAT (UART) | RST | 7 |
| Waveshare 4.2" E-Paper | CS | 18 |
| Waveshare 4.2" E-Paper | DC | 2 |
| Waveshare 4.2" E-Paper | RST | 3 |
| Waveshare 4.2" E-Paper | BUSY | 6 |
| Waveshare 4.2" E-Paper | SCK | 21 |
| Waveshare 4.2" E-Paper | MOSI | 19 |

---

## PN532 HAT DIP Switch Configuration

**Critical:** Set before powering on.

| Switch | Position |
|--------|----------|
| Yellow jumper 1 (SEL0) | **L** (left) |
| Yellow jumper 2 (SEL1) | **L** (left) |
| UART DIP 1 | **ON** |
| UART DIP 2 | **ON** |
| SPI DIP switches | **OFF** |
| I2C DIP switches | **OFF** |

This configures PN532 for **UART mode at 115200 baud**.

---

## Files to Deploy

```
apps/firmware/micropython-esp32c6/
├── main.py              # Entry point, main loop (standalone NFC → e-paper)
├── config.py            # Pin mapping + timing — EDIT THIS
├── graphics.py          # PortraitCanvas (300x400 coordinate mapping)
├── barcode.py           # ITF-10 horizontal/vertical barcode generators
├── layout.py            # IATA baggage tag renderer (4-section layout)
├── nfc_handler.py       # PN532 Type-4 target APDU handler + NDEF parser
├── pn532_uart.py        # PN532 UART driver (TgInitAsTarget, TgGetData, TgSetData)
└── epaper4in2.py        # Waveshare 4.2" V2 driver (partial refresh)
```

**Do NOT deploy:** `tests/`, `requirements.txt`, `deploy.py`, `conftest.py`, `README.md`

---

## Configuration

Edit `config.py` before deploying:

```python
# PN532 UART1 pins (Waveshare HAT)
PN532_RX = 22
PN532_TX = 23
PN532_RST = 7
PN532_BAUD = 115200

# E-Paper SPI pins (Waveshare 4.2")
EPD_CS = 18
EPD_DC = 2
EPD_RST = 3
EPD_BUSY = 6
EPD_SCK = 21
EPD_MOSI = 19

# Timing
NFC_SESSION_MS = 5000        # Max wait for phone NFC write
```

**No WiFi/API credentials needed** — firmware is standalone.

### Verified mobile sync

Set `SMARTTAG_UID` in `config.py` to the SmartTag identity assigned in the app.
Give each bridge a distinct value. This is a configured logical identity, not the
PN532's short emulated RF UID and not proof of ownership.

Reflash the firmware and rebuild the Expo development client before testing.
Expo Go and web remain simulation-only. The native app uses one ISO-DEP session:

1. Select NDEF application `D2760000850101` and read bridge identity (`80 10 00 00 00`).
2. Clear NLEN, write the NDEF Text record in chunks, then commit NLEN.
3. Firmware validates and renders the payload, activates the V2 display refresh,
   and waits for BUSY to assert and then clear. No receipt is issued on failure.
4. Read the refresh receipt (`80 11 00 00 00`), match its `sync_id` to this write,
   and read back the entire NDEF record before marking the tag verified.

Successful proprietary responses contain UTF-8 `PA1|<identity>` or
`PA1|<sync_id>` followed by `90 00`; a missing/failed refresh returns `65 81`.
An NDEF write acknowledgement alone does not confirm display refresh.
Verification confirms controller completion and payload readback, not optical
barcode readability or the physical appearance of every pixel.

The driver targets the **monochrome Waveshare 4.2-inch V2** controller: RAM writes
use `24`, refresh activation uses `22`/`20`, and partial update mode is `FF`.
It is not compatible with older or three-colour panels.

---

## Deploy

**Prerequisites:**
```bash
pip install mpremote
```

**Deploy and run:**
```bash
cd apps/firmware/micropython-esp32c6
python deploy.py --reset
```

This copies all 8 firmware files to the device and soft-resets to start `main.py`.

---

## Run Manually (via REPL)

```bash
mpremote connect auto repl
```
Then in REPL:
```python
import main
main.main()
```

---

## Standalone Flow

```
Phone (NFC Write)          PN532 (Target)        ESP32-C6              E-Paper Display
     |                       |                    |                      |
     |--- Write NDEF ------->|                    |                      |
     |                       |--- APDU UPDATE --->|                      |
     |                       |<-- 90 00 ---------|                      |
     |                       |                    |--- parse_iata_payload() --->|
     |                       |                    |--- render_iata_baggage_tag() ->|
     |                       |                    |                      |--- Partial refresh -->
```

**NDEF Payload Formats Accepted:**

1. **Pipe-delimited text** (preferred for phone keyboards):
   ```
   0074774268|NRT|TOKYO|CX 548|12DEC|1430|PASSENGER/NAME
   ```

2. **JSON NDEF** (from mobile app):
   ```json
   {
     "v": 1,
     "tag": "0074774268",
     "tag_code": "04:A2:3B:4C:5D:6E:70",
     "booking": "unknown",
     "flight": "CX888",
     "route": "HKG-NRT",
     "barcode": "0074774268",
     "passenger": "CHAN/T",
     "date": "2026-11-21",
     "sync_id": "unique-per-write",
     "status": "TAGGED",
     "at": 1700000000
   }
   ```

---

## Mobile App Responsibility (DB Update)

**The mobile app must call the API after writing NFC** to update the database:

```typescript
// After successful NFC write:
await fetch('https://api.example.com/api/v1/tags/04:A2:3B:4C:5D:6E:70/tap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reader_id: 'MOBILE-APP',
    location_code: 'HKG-CHECKIN',
    ndef_payload: JSON.stringify(ndefJson)  // same payload written to tag
  })
});
```

**API Endpoint:** `POST /tags/{id}/tap` — already implemented in backend.

---

## Phone NFC Write

**Android Chrome (Web NFC):** Requires HTTPS. For localhost development:
```bash
adb reverse tcp:8000 tcp:8000
```
Then open `https://localhost:8000` on phone.

**Mobile App:** `NativeNfcService.ts` writes NDEF JSON over ISO-DEP and verifies
the firmware's refresh receipt plus NDEF readback.

---

## E-Paper Display

- **Resolution:** 400×300 native → rendered as 300×400 portrait
- **Mode:** Initial full refresh, then partial refresh (`22 FF`, `20`)
- **Layout:** 4-section IATA baggage tag
  1. **Maximized barcode zone** — horizontal (255×68) + vertical ladder (255×177) ITF-10
  2. **License plate + airline badge + passenger**
  3. **Large destination code + flight info**
  4. **Bottom stub barcode + dest code**

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| PN532 not responding | Wrong DIP switches | Verify UART jumpers L-L, UART ON, SPI/I2C OFF |
| "No ACK" in logs | Baud rate mismatch | Confirm `PN532_BAUD = 115200` |
| Display not updating | NDEF parse failed | Check phone writes valid pipe-delimited or JSON NDEF |
| Phone can't write | Tag not in PICC mode | Verify PN532 reset + TgInitAsTarget on boot |

---

## Testing with Mobile + IoT Device

### 1. Hardware Setup
- ESP32-C6 + PN532 HAT + Waveshare 4.2" E-Paper wired per table above
- PN532 DIP switches set to UART mode
- Phone with NFC enabled (Android/iOS)

### 2. Deploy Firmware
```bash
cd apps/firmware/micropython-esp32c6
python deploy.py --reset
```
Watch serial output: `>>> SYSTEM READY. Tap phone to PN532 <<<`

### 3. Write NDEF from Phone

**Option A: Web NFC (Android Chrome)**
- Open staff portal or demo page with "Write NDEF" button
- Hold phone to PN532 antenna
- E-paper updates within 1-2 seconds

**Option B: Mobile App (React Native/Expo)**
- Navigate to "Sync SmartTag" screen
- Tap "Start NFC sync"
- Hold phone to PN532 antenna
- App writes NDEF, then calls API to update DB

**Option C: NFC Tools App (Manual Test)**
- Install "NFC Tools" (Android/iOS)
- Create NDEF Text record with pipe-delimited payload:
  ```
  0074774268|JFK|NEW YORK|KL 1592|30SEP|1740|NGUYEN/DUC MANH
  ```
- Write to tag (tap phone to PN532)
- E-paper renders baggage tag

### 4. Verify DB Update (Mobile App Flow)
After verified physical sync, the mobile app posts the tap to the API. The
API payload uses `tag_code` and `barcode`; `tag` is reserved for a database tag UUID.
Verify the demo baggage record in the backend:
```bash
# Check baggage events
curl https://api.example.com/api/v1/baggage/0160892012
```
Its `events` should include `TAGGED` with `scanner_type: NFC_TAP`.

---

## Development

**Run unit tests on host:**
```bash
cd apps/firmware/micropython-esp32c6
python -m pytest tests/test_firmware.py -v
```

---

## Files Summary for Device

**Upload these 8 files to ESP32-C6:**
| File | Purpose |
|------|---------|
| `main.py` | Main loop |
| `config.py` | Pin config |
| `graphics.py` | Canvas/rendering |
| `barcode.py` | ITF-10 barcodes |
| `layout.py` | IATA tag layout |
| `nfc_handler.py` | PN532 APDU + NDEF parser |
| `pn532_uart.py` | PN532 UART driver |
| `epaper4in2.py` | E-paper driver |

**Do NOT upload:** `tests/`, `deploy.py`, `conftest.py`, `README.md`, `requirements.txt`