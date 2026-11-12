# PolyAero Cathay SmartTag — ESP32-C6 MicroPython Firmware

ESP32-C6 firmware for PN532 Type-4 Target (PICC emulation) + Waveshare 4.2" E-Paper display.
Phone writes NDEF via Web NFC → PN532 receives → POST to API → E-Paper renders baggage tag.

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
├── main.py              # Entry point, main loop
├── config.py            # WiFi, API, pin mapping — EDIT THIS
├── graphics.py          # PortraitCanvas (300x400 coordinate mapping)
├── barcode.py           # ITF-10 horizontal/vertical barcode generators
├── layout.py            # IATA baggage tag renderer (4-section layout)
├── nfc_handler.py       # PN532 Type-4 target APDU handler + NDEF parser
├── pn532_uart.py        # PN532 UART driver (TgInitAsTarget, TgGetData, TgSetData)
└── epaper4in2.py        # Waveshare 4.2" V2 driver (partial refresh)
```

**Do NOT deploy:** `tests/`, `requirements.txt`, `deploy.py`, `conftest.py`

---

## Configuration

Edit `config.py` before deploying:

```python
# WiFi
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# API (your backend server)
API_BASE_URL = "http://192.168.1.100:8000/api/v1"

# Tag identity — must match tags.tag_code in PostgreSQL
TAG_UID = "04:A2:3B:4C:5D:6E:70"

# Optional device auth — must match IOT_DEVICE_KEY env var on API
# Leave empty if API has no IOT_DEVICE_KEY set
DEVICE_KEY = ""

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
POLL_INTERVAL_MS = 3000      # Display poll interval
NFC_SESSION_MS = 5000        # Max wait for phone NFC write
```

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

## IoT Flow

```
Phone (Web NFC)          PN532 (Target)        ESP32-C6              Backend API
     |                       |                    |                      |
     |--- Write NDEF ------->|                    |                      |
     |                       |--- APDU UPDATE --->|                      |
     |                       |<-- 90 00 ---------|                      |
     |                       |                    |--- POST /tags/{id}/tap (ndef_payload) -->|
     |                       |                    |<-- {acknowledged, display} ------------|
     |                       |                    |--- Render display to E-Paper --------->|
     |                       |                    |                      |
     |                       |                    |--- GET /tags/{id}/display (every 3s) -->|
     |                       |                    |<-- display payload ----------------------|
     |                       |                    |--- Render if changed ------------------>|
```

**NDEF Format** (matches `POST /smarttag/sync/payload`):
```json
{
  "v": 1,
  "tag": "0074774268",
  "tag_code": "04:A2:3B:4C:5D:6E:70",
  "booking": "uuid-from-backend",
  "flight": "CX888",
  "route": "HKG-NRT",
  "barcode": "0074774268",
  "status": "TAGGED",
  "at": 1700000000
}
```

**Pipe-delimited text payload** (also accepted):
```
0074774268|NRT|TOKYO|CX 548|12DEC|1430|PASSENGER/NAME
```

---

## Phone NFC Write

**Android Chrome (Web NFC):** Requires HTTPS. For localhost development:
```bash
adb reverse tcp:8000 tcp:8000
```
Then open `https://localhost:8000` on phone.

**Staff Portal:** "Write NDEF" button at `/staff` writes the pipe-delimited format.

**Mobile App:** `NativeNfcService.ts` writes NDEF JSON format.

---

## E-Paper Display

- **Resolution:** 400×300 native → rendered as 300×400 portrait
- **Mode:** Partial refresh (`PARTIAL_DISPLAY_REFRESH` command 0x1A)
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
| WiFi fails | Wrong credentials | Check `WIFI_SSID`/`WIFI_PASSWORD` in `config.py` |
| API 401/403 | Device key mismatch | Set `DEVICE_KEY` = `IOT_DEVICE_KEY` on API, or leave both empty |
| Display not updating | Poll interval | Check `POLL_INTERVAL_MS = 3000`, WiFi connected |
| Phone can't write | HTTP not HTTPS | Use `adb reverse` or deploy API with TLS |

---

## Development

**Run unit tests on host:**
```bash
cd apps/firmware/micropython-esp32c6
python -m pytest tests/test_firmware.py -v
```

**Add urequests if missing on device:**
```bash
mpremote mip install github:micropython/micropython-lib/urequests
```

---

## Backend API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/tags/{id}/tap` | Submit NDEF payload or next_status |
| GET | `/tags/{id}/display` | Poll for display payload |
| POST | `/smarttag/sync/payload` | Build NDEF JSON (used by staff/mobile apps) |

See `apps/api/app/api/v1/endpoints/tags.py` and `smarttag.py`.