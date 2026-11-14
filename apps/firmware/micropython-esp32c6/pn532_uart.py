# PN532 UART Driver for MicroPython
# Minimal implementation for TgInitAsTarget / TgGetData / TgSetData

from machine import UART, Pin
import errno
import time


class PN532_UART:
    PN532_PREAMBLE = 0x00
    PN532_STARTCODE1 = 0x00
    PN532_STARTCODE2 = 0xFF
    PN532_HOSTTOPN532 = 0xD4
    PN532_PN532TOHOST = 0xD5
    PN532_POSTAMBLE = 0x00

    ACK = bytearray([0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00])

    def __init__(self, uart: UART, reset: Pin = None, debug: bool = False):
        self.uart = uart
        self.reset_pin = reset
        self.debug = debug

    def reset(self):
        if self.reset_pin:
            self.reset_pin.value(1)
            time.sleep_ms(10)
            self.reset_pin.value(0)
            time.sleep_ms(50)
            self.reset_pin.value(1)
            time.sleep_ms(80)
        while self.uart.any():
            self.uart.read()

    def initialize(self):
        self.reset()
        self.uart.write(b'\x55\x55\x00\x00\x00')
        version = self.call_function(0x02, response_length=4)
        if version is None or len(version) != 4 or version[0] != 0x32:
            raise OSError(errno.ENODEV, "PN532 GetFirmwareVersion failed; check UART mode, pins and power")
        # Normal SAM mode exits LowVbat; send HSU wakeup preamble immediately before command.
        self.uart.write(b'\x55\x55\x00\x00\x00')
        sam = self.call_function(0x14, response_length=1, params=bytearray([0x01, 0x14, 0x01]))
        if sam != bytearray():
            raise OSError(errno.EIO, "PN532 SAMConfiguration failed")
        return version

    def _write_frame(self, data: bytearray):
        """Write a frame to PN532"""
        length = len(data) + 1  # +1 for TFI
        checksum = (self.PN532_HOSTTOPN532 + sum(data)) & 0xFF
        frame = bytearray([
            self.PN532_PREAMBLE,
            self.PN532_STARTCODE1,
            self.PN532_STARTCODE2,
            length,
            (~length + 1) & 0xFF,
            self.PN532_HOSTTOPN532,
        ])
        frame.extend(data)
        frame.append((~checksum + 1) & 0xFF)
        frame.append(self.PN532_POSTAMBLE)

        self.uart.write(frame)
        if self.debug:
            print(f"[PN532 TX] {' '.join(f'{b:02X}' for b in frame)}")

    def _read_ack(self, timeout: int = 1000) -> bool:
        """Wait for ACK frame"""
        start = time.ticks_ms()
        matched = 0
        while time.ticks_diff(time.ticks_ms(), start) < timeout:
            if self.uart.any():
                data = self.uart.read(1)
                if not data:
                    continue
                b = data[0]
                if b == self.ACK[matched]:
                    matched += 1
                    if matched == len(self.ACK):
                        return True
                else:
                    matched = 2 if matched == 2 and b == 0 else (1 if b == 0 else 0)
            time.sleep_ms(1)
        return False

    def _read_frame(self, timeout: int = 1000) -> bytearray:
        """Read a response frame from PN532"""
        start = time.ticks_ms()
        # Find preamble (00 00 FF)
        preamble = bytearray(3)
        idx = 0
        while time.ticks_diff(time.ticks_ms(), start) < timeout:
            if self.uart.any():
                b = self.uart.read(1)[0]
                if idx == 0 and b == 0x00:
                    preamble[idx] = b
                    idx += 1
                elif idx == 1 and b == 0x00:
                    preamble[idx] = b
                    idx += 1
                elif idx == 2:
                    if b == 0xFF:
                        idx += 1
                        break
                    idx = 2 if b == 0x00 else 0
                else:
                    idx = 0 if b != 0x00 else 1
            time.sleep_ms(1)

        if idx < 3:
            return None

        # Read length, LCS
        while self.uart.any() < 2:
            if time.ticks_diff(time.ticks_ms(), start) >= timeout:
                return None
            time.sleep_ms(1)
        length = self.uart.read(1)[0]
        lcs = self.uart.read(1)[0]
        if ((length + lcs) & 0xFF) != 0x00:
            return None

        if length == 0:
            # Read DCS + postamble
            self.uart.read(2)
            return bytearray()

        # Read data + DCS + postamble
        expected = length + 2
        data = bytearray()
        while len(data) < expected and time.ticks_diff(time.ticks_ms(), start) < timeout:
            if self.uart.any():
                data.append(self.uart.read(1)[0])
            time.sleep_ms(1)

        if len(data) < expected:
            return None

        # Verify DCS
        dcs = data[-2]
        postamble = data[-1]
        payload = data[:-2]

        calc_dcs = (-sum(payload)) & 0xFF
        if dcs != calc_dcs or postamble != 0x00:
            return None

        if len(payload) < 2 or payload[0] != self.PN532_PN532TOHOST:
            return None

        return payload[1:]  # Skip TFI

    def call_function(self, cmd: int, response_length: int = 0, params: bytearray = None, timeout: int = 1000) -> bytearray:
        """Send command and optionally read response"""
        if params is None:
            params = bytearray()

        data = bytearray([cmd])
        data.extend(params)
        self._write_frame(data)

        if not self._read_ack(timeout):
            if self.debug:
                print("[PN532] No ACK")
            return None

        if response_length == 0:
            return bytearray()

        resp = self._read_frame(timeout)
        if resp is None:
            if self.debug:
                print("[PN532] No response frame")
            return None

        if self.debug:
            print(f"[PN532 RX] {' '.join(f'{b:02X}' for b in resp)}")
        if not resp or resp[0] != ((cmd + 1) & 0xFF):
            return None
        return resp[1:]  # Skip the PN532 response command byte.