# Waveshare 4.2" E-Paper Driver (400x300) for MicroPython
# Based on Waveshare EPD_4in2_V2 specification
# Supports partial update mode for fast refresh

from machine import Pin, SPI
import time
import framebuf


class EPD_4in2:
    WIDTH = 400
    HEIGHT = 300

    # Command codes (from Waveshare datasheet)
    PANEL_SETTING = 0x00
    POWER_SETTING = 0x01
    POWER_OFF = 0x02
    POWER_OFF_SEQ = 0x03
    POWER_ON = 0x04
    POWER_ON_MEASURE = 0x05
    BOOSTER_SOFT_START = 0x06
    DEEP_SLEEP = 0x07
    DATA_START_TRANSMISSION_1 = 0x10  # Black/White data
    DATA_START_TRANSMISSION_2 = 0x13  # Red data (3-color)
    DISPLAY_REFRESH = 0x12
    PARTIAL_DISPLAY_REFRESH = 0x1A
    VCOM_AND_DATA_INTERVAL = 0x50
    TCON_RESOLUTION = 0x61
    FLASH_MODE = 0xE5

    def __init__(self):
        # Hardware pins (from config)
        from config import EPD_CS, EPD_DC, EPD_RST, EPD_BUSY, EPD_SCK, EPD_MOSI

        self.cs = Pin(EPD_CS, Pin.OUT)
        self.dc = Pin(EPD_DC, Pin.OUT)
        self.rst = Pin(EPD_RST, Pin.OUT)
        self.busy = Pin(EPD_BUSY, Pin.IN)

        # SPI
        self.spi = SPI(1, baudrate=4_000_000, polarity=0, phase=0,
                       sck=Pin(EPD_SCK), mosi=Pin(EPD_MOSI))

        # Frame buffers
        self.buffer_1Gray = bytearray(self.WIDTH * self.HEIGHT // 8)
        self.image1Gray = framebuf.FrameBuffer(
            self.buffer_1Gray, self.WIDTH, self.HEIGHT, framebuf.MONO_HLSB
        )

        # Color constants (MONO_HLSB: 0=black, 1=white)
        self.black = 0
        self.white = 1

    # ---- Low-level SPI commands ----

    def _send_command(self, cmd: int):
        self.cs.value(0)
        self.dc.value(0)
        self.spi.write(bytearray([cmd]))
        self.cs.value(1)

    def _send_data(self, data: bytearray):
        self.cs.value(0)
        self.dc.value(1)
        self.spi.write(data)
        self.cs.value(1)

    def _wait_busy(self, timeout_ms: int = 5000):
        start = time.ticks_ms()
        while self.busy.value() == 1:
            if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
                break
            time.sleep_ms(10)

    def _reset(self):
        self.rst.value(1)
        time.sleep_ms(10)
        self.rst.value(0)
        time.sleep_ms(100)
        self.rst.value(1)
        time.sleep_ms(100)

    # ---- Initialization ----

    def init(self):
        """Full initialization for 4.2\" V2 panel"""
        self._reset()

        self._send_command(self.BOOSTER_SOFT_START)
        self._send_data(bytearray([0x17, 0x17, 0x17]))

        self._send_command(self.POWER_SETTING)
        self._send_data(bytearray([0x03, 0x00, 0x2B, 0x2B, 0x09]))

        self._send_command(self.POWER_ON)
        self._wait_busy()

        self._send_command(self.PANEL_SETTING)
        self._send_data(bytearray([0x1F]))  # KW-32, KWR-32

        self._send_command(self.TCON_RESOLUTION)
        self._send_data(bytearray([self.WIDTH >> 8, self.WIDTH & 0xFF,
                                   self.HEIGHT >> 8, self.HEIGHT & 0xFF]))

        self._send_command(self.VCOM_AND_DATA_INTERVAL)
        self._send_data(bytearray([0x10, 0x07]))  # VCOM, interval

        print("[EPD] Initialized")

    # ---- Display operations ----

    def EPD_4IN2_V2_Display(self, buffer: bytearray):
        """Full refresh display"""
        self._send_command(self.DATA_START_TRANSMISSION_1)
        self._send_data(buffer)
        self._send_command(self.DISPLAY_REFRESH)
        self._wait_busy()

    def EPD_4IN2_V2_PartialDisplay(self, buffer: bytearray):
        """Partial refresh (faster, no full flash)"""
        self._send_command(self.DATA_START_TRANSMISSION_1)
        self._send_data(buffer)
        self._send_command(self.PARTIAL_DISPLAY_REFRESH)
        self._wait_busy()

    def clear(self, color: int = 1):
        """Fill buffer with color (0=black, 1=white)"""
        fill_byte = 0x00 if color == 0 else 0xFF
        self.buffer_1Gray[:] = bytearray([fill_byte]) * len(self.buffer_1Gray)

    def sleep(self):
        """Enter deep sleep"""
        self._send_command(self.POWER_OFF)
        self._wait_busy()
        self._send_command(self.DEEP_SLEEP)
        self._send_data(bytearray([0xA5]))