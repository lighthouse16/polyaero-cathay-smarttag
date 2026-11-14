# Waveshare 4.2" V2 monochrome controller, 400x300.
# Register reference: waveshareteam/e-Paper, python/lib/waveshare_epd/epd4in2_V2.py
from machine import Pin, SPI
import errno
import time
import framebuf


class EPD_4in2:
    WIDTH = 400
    HEIGHT = 300

    def __init__(self):
        from config import EPD_CS, EPD_DC, EPD_RST, EPD_BUSY, EPD_SCK, EPD_MOSI

        self.cs = Pin(EPD_CS, Pin.OUT, value=1)
        self.dc = Pin(EPD_DC, Pin.OUT, value=0)
        self.rst = Pin(EPD_RST, Pin.OUT, value=1)
        self.busy = Pin(EPD_BUSY, Pin.IN)
        self.busy_gpio = EPD_BUSY
        self.spi = SPI(1, baudrate=4_000_000, polarity=0, phase=0,
                       sck=Pin(EPD_SCK), mosi=Pin(EPD_MOSI))
        self.buffer_1Gray = bytearray(self.WIDTH * self.HEIGHT // 8)
        self.image1Gray = framebuf.FrameBuffer(
            self.buffer_1Gray, self.WIDTH, self.HEIGHT, framebuf.MONO_HLSB)
        self.black = 0
        self.white = 1

    def _send_command(self, cmd):
        self.dc.value(0)
        self.cs.value(0)
        self.spi.write(bytearray([cmd]))
        self.cs.value(1)

    def _send_data(self, data):
        self.dc.value(1)
        self.cs.value(0)
        self.spi.write(data)
        self.cs.value(1)

    def _wait_busy(self, timeout_ms=5000, require_activity=False, phase="display operation"):
        start = time.ticks_ms()
        if require_activity:
            while self.busy.value() != 1:
                if time.ticks_diff(time.ticks_ms(), start) > 1000:
                    raise OSError(errno.ETIMEDOUT,
                                  "E-paper {}: BUSY GPIO{} did not assert within 1000ms".format(
                                      phase, self.busy_gpio))
                time.sleep_ms(1)
        while self.busy.value() == 1:
            if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
                raise OSError(errno.ETIMEDOUT,
                              "E-paper {}: BUSY GPIO{} stayed high after {}ms".format(
                                  phase, self.busy_gpio, timeout_ms))
            time.sleep_ms(10)

    def _set_window(self):
        for command, data in (
            (0x44, [0, self.WIDTH // 8 - 1]),
            (0x45, [0, 0, (self.HEIGHT - 1) & 0xFF, (self.HEIGHT - 1) >> 8]),
            (0x4E, [0]),
            (0x4F, [0, 0]),
        ):
            self._send_command(command)
            self._send_data(bytearray(data))

    def init(self):
        self.rst.value(1)
        time.sleep_ms(100)
        self.rst.value(0)
        time.sleep_ms(2)
        self.rst.value(1)
        time.sleep_ms(100)
        self._wait_busy(phase="hardware reset")
        self._send_command(0x12)  # Software reset, not display refresh on V2.
        self._wait_busy(phase="software reset")
        for command, data in ((0x21, [0x40, 0]), (0x3C, [0x05]), (0x11, [0x03])):
            self._send_command(command)
            self._send_data(bytearray(data))
        self._set_window()
        self._wait_busy(phase="RAM window setup")

    def _refresh(self, mode):
        self._send_command(0x22)
        self._send_data(bytearray([mode]))
        self._send_command(0x20)
        self._wait_busy(require_activity=True,
                        phase="full refresh" if mode == 0xF7 else "partial refresh")

    def EPD_4IN2_V2_Display(self, buffer):
        self._wait_busy(phase="before full refresh")
        for ram in (0x24, 0x26):
            self._set_window()
            self._send_command(ram)
            self._send_data(buffer)
        self._refresh(0xF7)

    def EPD_4IN2_V2_PartialDisplay(self, buffer):
        self._wait_busy(phase="before partial refresh")
        for command, data in ((0x3C, [0x80]), (0x21, [0, 0])):
            self._send_command(command)
            self._send_data(bytearray(data))
        self._set_window()
        self._send_command(0x24)
        self._send_data(buffer)
        self._refresh(0xFF)

    def clear(self, color=1):
        self.buffer_1Gray[:] = bytes([0 if color == 0 else 0xFF]) * len(self.buffer_1Gray)

    def sleep(self):
        self._send_command(0x22)
        self._send_data(bytearray([0x83]))
        self._send_command(0x20)
        self._wait_busy(phase="sleep")
        self._send_command(0x10)
        self._send_data(bytearray([0x01]))
