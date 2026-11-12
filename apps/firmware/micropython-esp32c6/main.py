# PolyAero Cathay SmartTag — ESP32-C6 MicroPython Firmware
# PN532 Type-4 Target Mode + 4.2" E-Paper (Portrait 300x400)
# Backend: POST /tags/{id}/tap, GET /tags/{id}/display (3s poll)

import gc
import time
import ujson as json
import ubinascii
from machine import Pin, SPI, UART, reset
import network
import urequests as requests

# Local modules
from pn532_uart import PN532_UART
from epaper4in2 import EPD_4in2
from graphics import PortraitCanvas
from barcode import draw_itf_barcode_horizontal, draw_itf_barcode_vertical
from layout import render_iata_baggage_tag
from nfc_handler import NfcTarget, parse_iata_payload
from config import (
    WIFI_SSID, WIFI_PASSWORD, API_BASE_URL, TAG_UID, DEVICE_KEY,
    PN532_RX, PN532_TX, PN532_RST, PN532_BAUD,
    EPD_CS, EPD_DC, EPD_RST, EPD_BUSY, EPD_SCK, EPD_MOSI,
    POLL_INTERVAL_MS, NFC_SESSION_MS
)

# =========================================================
# GLOBAL STATE
# =========================================================
last_poll_ms = 0
last_rendered_sig = ""
wifi_connected = False

# =========================================================
# WIFI & HTTP HELPERS
# =========================================================
def connect_wifi() -> bool:
    global wifi_connected
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        wifi_connected = True
        print(f"[WIFI] Already connected: {wlan.ifconfig()[0]}")
        return True

    print(f"[WIFI] Connecting to {WIFI_SSID}...")
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    for _ in range(40):
        if wlan.isconnected():
            wifi_connected = True
            print(f"[WIFI] Connected: {wlan.ifconfig()[0]}")
            return True
        time.sleep_ms(500)
    print("[WIFI] Connection failed")
    return False


def http_post_tap(ndef_payload: str = None, next_status: str = None, identifier: str = None) -> dict:
    """POST /tags/{id}/tap with either ndef_payload or next_status"""
    url = f"{API_BASE_URL}/tags/{identifier or TAG_UID}/tap"
    headers = {"Content-Type": "application/json"}
    if DEVICE_KEY:
        headers["X-Device-Key"] = DEVICE_KEY

    body = {"reader_id": "ESP32-C6-PN532", "location_code": "HKG-STAGE-DEMO"}
    if ndef_payload:
        body["ndef_payload"] = ndef_payload
    elif next_status:
        body["next_status"] = next_status
    else:
        return {"error": "No payload"}

    try:
        resp = requests.post(url, headers=headers, data=json.dumps(body), timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            resp.close()
            return data
        else:
            print(f"[TAP] HTTP {resp.status_code}: {resp.text}")
            resp.close()
    except Exception as e:
        print(f"[TAP] Exception: {e}")
    return None


def http_get_display(identifier: str = None) -> dict:
    """GET /tags/{id}/display"""
    url = f"{API_BASE_URL}/tags/{identifier or TAG_UID}/display"
    try:
        resp = requests.get(url, timeout=3)
        if resp.status_code == 200:
            data = resp.json()
            resp.close()
            return data
        else:
            print(f"[DISPLAY] HTTP {resp.status_code}")
            resp.close()
    except Exception as e:
        print(f"[DISPLAY] Exception: {e}")
    return None


def render_display(canvas: PortraitCanvas, epd: EPD_4in2, data: dict):
    """Render API display payload to e-paper"""
    global last_rendered_sig

    flight = data.get("flight", "--")
    dest = data.get("destination", "---")
    bag = data.get("bag_number", "")
    banner = data.get("banner", "AWAITING SYNC")
    rush = data.get("is_rush", False)

    sig = f"{flight}|{dest}|{banner}|{bag}|{rush}"
    if sig == last_rendered_sig:
        return
    last_rendered_sig = sig

    # Build IATA layout data from API payload
    layout_data = {
        "tag_num": bag or "0074774268",
        "dest_code": dest,
        "dest_city": data.get("origin", "") + ">" + dest if data.get("origin") else dest,
        "flight": flight,
        "date": time.localtime()[2:4],  # placeholder
        "time": "0000",
        "passenger": data.get("passenger", "PASSENGER"),
    }
    render_iata_baggage_tag(canvas, layout_data)
    epd.EPD_4IN2_V2_PartialDisplay(epd.buffer_1Gray)


# =========================================================
# MAIN LOOP
# =========================================================
def main():
    global last_poll_ms

    # Initialize hardware
    print("Initializing PN532...")
    uart = UART(1, baudrate=PN532_BAUD, tx=Pin(PN532_TX), rx=Pin(PN532_RX), timeout=25, timeout_char=5)
    rst_pin = Pin(PN532_RST, Pin.OUT)
    nfc = PN532_UART(uart, reset=rst_pin, debug=False)

    # Configure PN532 as Type-4 PICC target
    nfc_target = NfcTarget(nfc)
    nfc_target.configure()

    print("Initializing 4.2\" e-Paper (Portrait 300x400)...")
    epd = EPD_4in2()
    canvas = PortraitCanvas(epd)

    # Initial display
    if connect_wifi():
        initial = http_get_display()
        if initial:
            render_display(canvas, epd, initial)

    print("\n>>> SYSTEM READY. Tap phone to PN532 <<<")

    while True:
        gc.collect()

        # 1. Ensure Wi-Fi
        if not wifi_connected:
            connect_wifi()

        # 2. Listen for phone NFC write (blocking, ~5s session)
        baggage_data = nfc_target.listen(session_ms=NFC_SESSION_MS)

        if baggage_data:
            print("\n[V] NDEF received, parsing...")
            parsed = parse_iata_payload(baggage_data)
            if parsed:
                print(f"    Parsed: {parsed}")

                # Build NDEF JSON for API (matches /smarttag/sync/payload format)
                ndef_json = json.dumps({
                    "v": 1,
                    "tag": parsed.get("tag_num", "0074774268"),
                    "tag_code": TAG_UID,
                    "booking": "unknown",  # filled by backend if tag matches
                    "flight": parsed.get("flight", "CX888"),
                    "route": f"{parsed.get('dest_city','HKG').split('>')[0]}-{parsed.get('dest_code','NRT')}",
                    "barcode": parsed.get("tag_num", "0074774268"),
                    "status": "TAGGED",
                    "at": time.time(),
                })

                # POST tap → get display → render
                result = http_post_tap(ndef_payload=ndef_json)
                if result and result.get("acknowledged"):
                    render_display(canvas, epd, result["display"])
                else:
                    print("[!] Tap failed, rendering local")
                    render_display(canvas, epd, {
                        "flight": parsed.get("flight", "CX888"),
                        "destination": parsed.get("dest_code", "NRT"),
                        "bag_number": parsed.get("tag_num", "0074774268"),
                        "banner": "TAGGED",
                        "is_rush": False,
                        "passenger": parsed.get("passenger", "PASSENGER"),
                    })

            else:
                print("[!] Could not parse NDEF payload")

            # Brief pause before next session
            time.sleep(2)
            nfc_target.reset()

        # 3. Periodic display poll (catches app-side status changes)
        now = time.ticks_ms()
        if time.ticks_diff(now, last_poll_ms) >= POLL_INTERVAL_MS:
            last_poll_ms = now
            if wifi_connected:
                display_data = http_get_display()
                if display_data:
                    render_display(canvas, epd, display_data)

        time.sleep_ms(20)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Stopped")
    except Exception as e:
        print(f"Fatal error: {e}")
        time.sleep(5)
        reset()