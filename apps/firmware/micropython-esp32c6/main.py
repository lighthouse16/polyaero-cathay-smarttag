# PolyAero Cathay SmartTag — ESP32-C6 MicroPython Firmware
# PN532 Type-4 Target Mode + 4.2" E-Paper (Portrait 300x400)
# Standalone: NFC tap → parse → render e-paper (no WiFi, no API)

import gc
import sys
import time
from machine import Pin, UART

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
    rst_pin = Pin(PN532_RST, Pin.OUT, value=1)
    nfc = PN532_UART(uart, reset=rst_pin, debug=False)
    version = nfc.initialize()
    print("[PN532] Firmware {}.{} verified over UART".format(version[1], version[2]))

    print("Initializing 4.2\" e-Paper (Portrait 300x400)...")
    print("[EPD] V2 monochrome; CS={}, DC={}, RST={}, BUSY={}, SCK={}, MOSI={}".format(
        EPD_CS, EPD_DC, EPD_RST, EPD_BUSY, EPD_SCK, EPD_MOSI))
    epd = EPD_4in2()
    epd.init()
    canvas = PortraitCanvas(epd)

    pending_refresh = [None]

    def refresh_display(parsed):
        if hasattr(epd, "cs"):
            pending_refresh[0] = parsed
            return
        print("[EPD] Rendering baggage label")
        render_iata_baggage_tag(canvas, parsed)
        epd.EPD_4IN2_V2_PartialDisplay(epd.buffer_1Gray)
        print("[EPD] Baggage refresh completed")

    nfc_target = NfcTarget(nfc, SMARTTAG_UID, refresh_display)
    nfc_target.configure()

    # Initial display (blank/ready state)
    canvas.clear()
    canvas.text("READY FOR TAP", 60, 180, canvas.black, scale=2, bold=True)
    canvas.text("Tap phone to write tag", 40, 220, canvas.black, scale=1)
    print("[EPD] Initial full refresh")
    epd.EPD_4IN2_V2_Display(epd.buffer_1Gray)

    print("\n>>> SYSTEM READY. Tap phone to PN532 <<<")

    while True:
        gc.collect()
        try:
            # Listen for phone NFC write (blocking, ~5s session)
            nfc_target.listen(session_ms=NFC_SESSION_MS)
            if pending_refresh[0] is not None:
                parsed = pending_refresh[0]
                pending_refresh[0] = None
                print("[EPD] Rendering baggage label")
                render_iata_baggage_tag(canvas, parsed)
                epd.EPD_4IN2_V2_PartialDisplay(epd.buffer_1Gray)
                print("[EPD] Baggage refresh completed")
                time.sleep_ms(300)
        except Exception as exc:
            print(f"[NFC] Loop recovery: {exc}")
            time.sleep_ms(20)


def run():
    try:
        main()
    except KeyboardInterrupt:
        print("Stopped")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.print_exception(e)
        print("Stopped; fix the reported error, then reset or run main.main().")


if __name__ == "__main__":
    run()