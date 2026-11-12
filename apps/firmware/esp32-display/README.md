# PolyAero Cathay SmartTag — ESP32-S3 E-Paper + PN532 Bridge

The ESP32 is the physical bridge between the phone, the API, and the 4.2-inch E-Paper
screen.

```
Phone Web NFC writes NDEF JSON
        │
        ▼
PN532 target mode (ESP32 emulates a Type-4 tag)
        │
        ▼
POST /api/v1/tags/{TAG_UID}/tap   { ndef_payload, reader_id, location_code }
        │
        ▼
API verifies the tag/barcode, writes a baggage_event, updates tags.tag_status
        │
        ├──> response { acknowledged, display }  ──> E-Paper renders immediately
        │
GET /api/v1/tags/{TAG_UID}/display every 3s  ──> app-side changes reach the screen
```

The phone (or any NFC writer) writes a record to the PN532. Two formats are accepted:

1. **JSON NDEF** — the `ndef_record` from `POST /api/v1/smarttag/sync/payload` (contains
   tag UUID, tag_code, booking UUID, flight, route, barcode, status).
2. **PA1 text record** — `PA1|<bagId>|<route>|<status>|<timestamp>` as produced by
   `apps/staff/src/lib/nfcWriter.ts` and any generic NFC tag writer app.

The sketch auto-detects the format, posts to `/tags/{id}/tap`, and renders the returned
display payload.

## 1. Hardware

| Device | Bus | Default pins in the sketch |
|---|---|---|
| PN532 NFC HAT | UART1 | RX `22`, TX `23`, RST `7` |
| Waveshare 4.2" E-Paper | SPI | CS `10`, DC `8`, RST `9`, BUSY `13`, SCK `12`, MOSI `11` |

The E-Paper pins are ESP32-S3 placeholders. Replace the `EPD_*` constants with the pin
map from your module before flashing. The PN532 must be in **UART mode** (HAT DIP
switches) and the sketch drives it in **target/PICC emulation**, not reader mode.

> Pins `22`/`23` come from the original ESP32 prototype. GPIO22 does not exist on an
> ESP32-S3, so move `PN532_RX` to a free S3 GPIO (for example `21`) if that is your board.

If your E-Paper is the 3-colour version, swap `GxEPD2_BW` / `GxEPD2_420` for
`GxEPD2_3C` / `GxEPD2_420c` and change the render colours.

## 2. Libraries

Install through the Arduino IDE Library Manager:

1. **ArduinoJson** (v7)
2. **GxEPD2**
3. **Adafruit GFX Library** (GxEPD2 dependency)

PN532 framing and PN532 target-mode commands are implemented directly in the sketch, so
no PN532 library is required.

## 3. Configuration

At the top of `smarttag_client.ino`:

```cpp
WIFI_SSID / WIFI_PASSWORD
API_BASE_URL    // e.g. http://192.168.1.20:8000/api/v1
TAG_UID         // must match tags.tag_code in PostgreSQL
DEVICE_KEY      // must match IOT_DEVICE_KEY when that env var is set
PN532_* / EPD_* // wiring
```

`TAG_UID` is the identity the phone writes into the NDEF record. The API also accepts
the 10-digit barcode or the tag UUID as the path identifier, but keeping `TAG_UID`
equal to `tags.tag_code` is the simplest setup.

## 4. Run

1. Start the API:
   ```bash
   cd apps/api
   uv run alembic upgrade head
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
2. Set `IOT_DEVICE_KEY` in `apps/api/.env` if you want the tap endpoint gated, and put
   the same value in `DEVICE_KEY`.
3. Link a tag to a booking in the app (`POST /bookings/link-tag`) and sync it
   (`POST /smarttag/sync/payload`).
4. Flash the sketch (`Tools -> Board -> ESP32S3 Dev Module`).
5. Tap the phone to the PN532 HAT. The phone writes the NDEF record; the ESP32 posts it
   and refreshes the display.

Manual test without the phone:

```bash
curl -X POST http://localhost:8000/api/v1/tags/04:A2:3B:4C:5D:6E:70/tap \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: $IOT_DEVICE_KEY" \
  -d '{"next_status":"LOADED","reader_id":"ESP32-PN532-01"}'
```

## 5. Display payload

`GET /tags/{id}/display` and the tap response share one payload:

```json
{
  "tag_code": "04:A2:3B:4C:5D:6E:70",
  "bag_number": "0160892012",
  "flight": "CX548",
  "origin": "HKG",
  "destination": "NRT",
  "passenger": "CHAN/T",
  "cabin": "ECONOMY",
  "weight_kg": 22.4,
  "status": "LOADED",
  "banner": "LOADED",
  "is_rush": false,
  "sync_state": "READY",
  "updated_at": "2026-11-12T10:00:00Z"
}
```

The sketch redraws only when `flight`, `destination`, `banner`, `bag_number`, or
`is_rush` changes, so the E-Ink panel does not flicker on every poll.

## 6. Statuses

IOT taps accept any of:

`CHECKED_IN`, `TAGGED`, `LOADED`, `IN_TRANSIT`, `ARRIVED`, `ON_CAROUSEL`,
`COLLECTED`, `MISROUTED`, `MISSING`, `RECOVERY_IN_PROGRESS`.

`MISROUTED`, `MISSING`, and `RECOVERY_IN_PROGRESS` render as a rush banner (inverted on
a monochrome panel). `SYNCHRONIZED` and `TAG_TAPPED` are recorded as events but do not
move the milestone.

## 7. Troubleshooting

| Symptom | Check |
|---|---|
| `HTTP 404` on `/display` | `TAG_UID` is not `tags.tag_code` / barcode / UUID in PostgreSQL |
| `HTTP 401` on `/tap` | `DEVICE_KEY` does not match `IOT_DEVICE_KEY` |
| `HTTP 409` on `/tap` | NDEF tag or barcode does not match the tag bound to that booking |
| `HTTP 422` on `/tap` | NDEF payload is not JSON, or `next_status` is unknown |
| Phone cannot write | PN532 HAT must be in UART mode and the phone must support Web NFC (Android Chrome over HTTPS) |
| Screen never updates | Check Wi-Fi, `API_BASE_URL`, and the serial log for PN532 frames |
| Tap does nothing | Serial shows `[NFC] Unknown payload format` — tag content is neither JSON nor `PA1|...` |

**Serial debug lines**

| Line | Meaning |
|---|---|
| `[NFC] JSON payload` | Valid JSON NDEF detected; posting as `ndef_payload` |
| `[NFC] PA1 bagId=0160892012 status=LOADED` | PA1 record parsed; posting as `next_status` |
| `[NFC] Unknown payload format` | Tag content not recognised |
| `[TAP] POST ... -> HTTP 200` | Tap succeeded, display refreshed |
| `[DISPLAY] GET ... -> HTTP 200` | Poll succeeded, display refreshed |

## 8. Known limits

- Polling, not MQTT push. The API's MQTT publisher is still a log-only stub.
- The device key is shared; it gates writes but does not prove the NFC UID.
- No offline queue: a failed tap is retried by the next phone write.
- `/baggage/*` remains the in-memory staff demo; staff scans mirror into PostgreSQL only
  when a matching tag exists.
