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

    # Initial display (Cathay SmartTag ready state)
    canvas.clear()
    canvas.fill_rect(20, 30, 260, 48, canvas.black)
    canvas.text("CATHAY PACIFIC", 35, 46, canvas.white, scale=2, bold=True)
    canvas.rect(20, 88, 260, 240, canvas.black, thickness=2)
    canvas.text("SmartTag(TM)", 65, 120, canvas.black, scale=2, bold=True)
    canvas.draw_airplane_icon(142, 160, canvas.black)
    canvas.text("READY TO PAIR", 60, 200, canvas.black, scale=2, bold=True)
    canvas.text("Tap phone with NFC", 55, 235, canvas.black, scale=1)
    canvas.text("to write baggage tag", 50, 255, canvas.black, scale=1)
    canvas.text("IATA DIGITAL BAGGAGE", 45, 350, canvas.black, scale=1, bold=True)
    print("[EPD] Initial full refresh (Ready state)")
    try:
        epd.EPD_4IN2_V2_Display(epd.buffer_1Gray)
    except Exception as e:
        print(f"[EPD] Cold-boot full refresh fallback to partial: {e}")
        epd.EPD_4IN2_V2_PartialDisplay(epd.buffer_1Gray)

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
                time.sleep_ms(3000)
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
