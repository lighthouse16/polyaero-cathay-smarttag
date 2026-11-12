# PolyAero Cathay SmartTag — ESP32-S3 E-Paper Bridge

## Required Arduino Libraries
1. **ArduinoJson** (v7.x by Benoit Blanchon) — install via Arduino IDE Library Manager.
2. **GxEPD2** or **Waveshare 4.2" E-Paper SPI driver** (already configured in Matthew's test sketch).

## How to Merge with Matthew's E-Paper Sketch
1. Open `smarttag_client.ino` in Arduino IDE (`Tools -> Board -> ESP32S3 Dev Module`).
2. Set `WIFI_SSID` and `WIFI_PASSWORD` to the same Wi-Fi network or iPhone Personal Hotspot as Paulin's MacBook.
3. Verify `API_BASE_URL` matches Paulin's Mac IP (`ipconfig getifaddr en0`, currently `http://10.11.72.211:8000/api/v1`).
4. Paste the Waveshare 4.2" SPI initialization into `initEinkHardware()` and the screen drawing calls into `renderEinkDisplay(...)`.
5. Upload to the ESP32-S3:
   - Because `smarttag_client.ino` tracks `lastRenderedSignature`, the E-Paper display refreshes **only when the flight, destination, or IRROPS banner changes** from the Mobile App or Ground Staff Portal—preventing continuous E-Ink screen flicker on stage.
