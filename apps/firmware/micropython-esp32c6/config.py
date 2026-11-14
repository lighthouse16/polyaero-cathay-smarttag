# Hardware Configuration
# Edit these values for your deployment

# =========================================================
# PN532 HAT (UART1) — ESP32-C6 pins per Waveshare HAT
# PN532 RX (HAT) <- ESP32 TX (GPIO 23)
# PN532 TX (HAT) -> ESP32 RX (GPIO 22)
# =========================================================
PN532_RX = 22
PN532_TX = 23
PN532_RST = 7
PN532_BAUD = 115200
SMARTTAG_UID = "04:A2:3B:4C:5D:6E:70"  # Unique bridge identity; match the app's assigned SmartTag.

# =========================================================
# WAVESHARE 4.2" E-PAPER (SPI) — ESP32-C6 pins
# =========================================================
EPD_CS = 18
EPD_DC = 2
EPD_RST = 3
EPD_BUSY = 6
EPD_SCK = 21
EPD_MOSI = 19

# =========================================================
# TIMING
# =========================================================
NFC_SESSION_MS = 5000        # Wait for phone activation; APDU timeout is separate.
NFC_APDU_TIMEOUT_MS = 10000  # Allow phone scheduling gaps; matches Android transceive timeout.