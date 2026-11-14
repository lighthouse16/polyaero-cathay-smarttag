# PolyAero Cathay SmartTag — ESP32-C6 MicroPython Firmware
# PN532 Type-4 Target Mode + 4.2" E-Paper (Portrait 300x400)
# Standalone: NFC tap → parse → render e-paper (no WiFi, no API)

import gc
import time
import ujson as json
from machine import Pin, UART, reset

# Local modules
from pn532_uart import PN532_UART
from epaper4in2 import EPD_4in2
from graphics import PortraitCanvas
from layout import render_iata_baggage_tag
from nfc_handler import NfcTarget
from config import (
    PN532_RX, PN532_TX, PN532_RST, PN532_BAUD,
    EPD_CS, EPD_DC, EPD_RST, EPD_BUSY, EPD_SCK, EPD_MOSI,
    NFC_SESSION_MS, SMARTTAG_UID
)


# =========================================================
# MAIN LOOP
# =========================================================
def main():
    # Initialize hardware
    print("Initializing PN532...")
    uart = UART(1, baudrate=PN532_BAUD, tx=Pin(PN532_TX), rx=Pin(PN532_RX), timeout=25, timeout_char=5)
    rst_pin = Pin(PN532_RST, Pin.OUT)
    nfc = PN532_UART(uart, reset=rst_pin, debug=False)

    print("Initializing 4.2\" e-Paper (Portrait 300x400)...")
    epd = EPD_4in2()
    epd.init()
    canvas = PortraitCanvas(epd)

    def refresh_display(parsed):
        render_iata_baggage_tag(canvas, parsed)
        epd.EPD_4IN2_V2_Display(epd.buffer_1Gray)

    nfc_target = NfcTarget(nfc, SMARTTAG_UID, refresh_display)
    nfc_target.configure()

    # Initial display (blank/ready state)
    canvas.clear()
    canvas.text("READY FOR TAP", 60, 180, canvas.black, scale=2, bold=True)
    canvas.text("Tap phone to write tag", 40, 220, canvas.black, scale=1)
    epd.EPD_4IN2_V2_PartialDisplay(epd.buffer_1Gray)

    print("\n>>> SYSTEM READY. Tap phone to PN532 <<<")

    while True:
        gc.collect()

        # Listen for phone NFC write (blocking, ~5s session)
        baggage_data = nfc_target.listen(session_ms=NFC_SESSION_MS)

        if baggage_data:
            # Brief pause before next session
            time.sleep(2)
            nfc_target.reset()

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