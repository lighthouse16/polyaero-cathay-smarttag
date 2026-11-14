#!/usr/bin/env python3
"""
Unit tests for MicroPython firmware modules.
Run on host: python -m pytest tests/ -v
"""

import sys
import json
import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest

# Add firmware dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Mocks are installed via conftest.py into sys.modules before test collection

from barcode import _encode_itf_elements, draw_itf_barcode_horizontal, draw_itf_barcode_vertical
from graphics import PortraitCanvas
from nfc_handler import NfcTarget, parse_iata_payload
from layout import render_iata_baggage_tag
from epaper4in2 import EPD_4in2
from pn532_uart import PN532_UART


class MockCanvas:
    """Mock canvas for testing layout/barcode without hardware"""
    def __init__(self):
        self.calls = []
        self.black = 0
        self.white = 1

    def fill_rect(self, x, y, w, h, color):
        self.calls.append(('fill_rect', x, y, w, h, color))

    def hline(self, x, y, w, color, thickness=1):
        self.calls.append(('hline', x, y, w, color, thickness))

    def vline(self, x, y, h, color, thickness=1):
        self.calls.append(('vline', x, y, h, color, thickness))

    def hatch_rect(self, x, y, w, h, color):
        self.calls.append(('hatch_rect', x, y, w, h, color))

    def text(self, s, x, y, color, scale=1, bold=False):
        self.calls.append(('text', s, x, y, color, scale, bold))

    def text_vertical_up(self, s, x, y, color, scale=1):
        self.calls.append(('text_vertical_up', s, x, y, color, scale))

    def draw_airplane_icon(self, x, y, color):
        self.calls.append(('draw_airplane_icon', x, y, color))

    def clear(self):
        self.calls.append(('clear',))


def test_itf_encoding():
    """Test ITF-10 element encoding"""
    elements = _encode_itf_elements("0074774268")
    # Start (4) + 5 pairs * 10 + Stop (3) = 57 elements
    assert len(elements) == 57
    # First 4 are start pattern
    assert elements[0] == (True, '0')
    assert elements[1] == (False, '0')
    assert elements[2] == (True, '0')
    assert elements[3] == (False, '0')
    # Last 3 are stop pattern
    assert elements[-3:] == [(True, '1'), (False, '0'), (True, '0')]
    print("✓ ITF encoding")


def test_itf_horizontal_dimensions():
    """Test horizontal barcode produces correct width"""
    canvas = MockCanvas()
    draw_itf_barcode_horizontal(canvas, center_x=150, y=6, code="0074774268", height=68, narrow=3, wide=7)
    # Count fill_rect calls that are black bars
    black_bars = [c for c in canvas.calls if c[0] == 'fill_rect' and c[5] == 0]
    # Should have many bars
    assert len(black_bars) > 20
    print("✓ Horizontal barcode dimensions")


def test_itf_vertical_dimensions():
    """Test vertical barcode produces correct height"""
    canvas = MockCanvas()
    draw_itf_barcode_vertical(canvas, center_x=150, y=88, code="0074774268", bar_width=255, narrow=2, wide=5)
    black_bars = [c for c in canvas.calls if c[0] == 'fill_rect' and c[5] == 0]
    assert len(black_bars) > 20
    print("✓ Vertical barcode dimensions")


def test_parse_pipe_delimited():
    """Test NDEF parser with pipe-delimited payload"""
    # Build a fake NDEF buffer with pipe-delimited text
    payload = "0074774268|JFK|NEW YORK|KL 1592|30SEP|1740|NGUYEN/DUC MANH"
    # NDEF Text record format:
    # [0-1] NDEF message length (big-endian) = 7 + len(payload)
    # [2]   MB=1, TNF=1 (Well-known) = 0xD1
    # [3]   Type Length = 1
    # [4]   Payload Length = 3 + len(payload) (status + language + text)
    # [5]   Type = 'T' (0x54)
    # [6]   Language Length = 2
    # [7-8] Language = 'en' (0x65 0x6E)
    # [9:]  Payload
    msg_len = 7 + len(payload)
    ndef = bytearray([msg_len >> 8, msg_len & 0xFF, 0xD1, 0x01, 3 + len(payload), 0x54, 0x02, 0x65, 0x6E])
    ndef.extend(payload.encode())
    # Pad to 512
    ndef.extend(b'\x00' * (512 - len(ndef)))

    result = parse_iata_payload(ndef)
    assert result is not None
    assert result["tag_num"] == "0074774268"
    assert result["dest_code"] == "JFK"
    assert result["dest_city"] == "NEW YORK"
    assert result["flight"] == "KL 1592"
    assert result["date"] == "30SEP"
    assert result["time"] == "1740"
    assert result["passenger"] == "NGUYEN/DUC MANH"
    print("✓ Pipe-delimited parsing")


def test_parse_digits_only():
    """Test NDEF parser with digits-only payload"""
    payload = "0074774268"
    msg_len = 7 + len(payload)
    ndef = bytearray([msg_len >> 8, msg_len & 0xFF, 0xD1, 0x01, 3 + len(payload), 0x54, 0x02, 0x65, 0x6E])
    ndef.extend(payload.encode())
    ndef.extend(b'\x00' * (512 - len(ndef)))

    result = parse_iata_payload(ndef)
    assert result is not None
    assert result["tag_num"] == "0074774268"
    print("✓ Digits-only parsing")


def test_parse_init_returns_none():
    """Test INIT payload returns None"""
    ndef = bytearray([0x00, 0x0B, 0xD1, 0x01, 0x07, 0x54, 0x02, 0x65, 0x6E, 0x49, 0x4E, 0x49, 0x54])
    ndef.extend(b'\x00' * (512 - len(ndef)))

    result = parse_iata_payload(ndef)
    assert result is None
    print("✓ INIT returns None")


def test_layout_render_calls():
    """Test layout renderer produces expected draw calls"""
    canvas = MockCanvas()
    data = {
        "tag_num": "0074774268",
        "dest_code": "JFK",
        "dest_city": "NEW YORK",
        "flight": "KL 1592",
        "date": "30SEP",
        "time": "1740",
        "passenger": "NGUYEN/DUC MANH"
    }
    render_iata_baggage_tag(canvas, data)

    # Should have many drawing calls
    assert len(canvas.calls) > 50
    # Check key elements present
    call_types = {c[0] for c in canvas.calls}
    assert 'fill_rect' in call_types
    assert 'text' in call_types
    assert 'hline' in call_types
    assert 'draw_airplane_icon' in call_types
    print("✓ Layout render calls")


def ndef_text(text):
    payload = b'\x02en' + text.encode()
    if len(payload) <= 255:
        record = bytes([0xD1, 1, len(payload)]) + b'T' + payload
    else:
        record = bytes([0xC1, 1]) + len(payload).to_bytes(4, "big") + b'T' + payload
    return len(record).to_bytes(2, "big") + record


def bridge_record(**overrides):
    record = {
        "v": 1, "tag": "0160123456", "tag_code": "04:A2:3B:4C:5D:6E:70",
        "route": "HKG-NRT", "flight": "CX548", "date": "2026-11-21",
        "passenger": "H.T.", "sync_id": "current-write",
    }
    record.update(overrides)
    return ndef_text(json.dumps(record, separators=(",", ":")))


class FakeNfc:
    def __init__(self):
        self.responses = []

    def call_function(self, command, **kwargs):
        if command == 0x8E:
            self.responses.append(bytes(kwargs["params"]))
        return bytearray([0])


def write_bridge(target, message):
    target._process_apdu(bytearray([0, 0xA4, 0, 0x0C, 2, 0xE1, 4]))
    target._process_apdu(bytearray([0, 0xD6, 0, 0, 2, 0, 0]))
    for offset in range(2, len(message), 48):
        chunk = message[offset:offset + 48]
        target._process_apdu(bytearray([0, 0xD6, offset >> 8, offset & 255, len(chunk)]) + chunk)
    target._process_apdu(bytearray([0, 0xD6, 0, 0, 2]) + message[:2])


@pytest.mark.parametrize("padding", ["", "x" * 180])
def test_parse_native_json_short_and_long_ndef(padding):
    parsed = parse_iata_payload(bridge_record(extra=padding))
    assert parsed["tag_num"] == "0160123456"
    assert parsed["dest_code"] == "NRT"
    assert parsed["flight"] == "CX548"
    assert parsed["date"] == "21NOV"
    assert parsed["sync_id"] == "current-write"


@pytest.mark.parametrize("text", ['{"tag":"0160123456"}', '{"tag":', '["0160123456"]'])
def test_invalid_json_never_becomes_an_unrelated_default_bag(text):
    assert parse_iata_payload(ndef_text(text)) is None


def test_truncated_or_chunked_ndef_is_rejected():
    assert parse_iata_payload(b'\x00\x01\xD1' + b'\x00' * 10) is None
    chunked = bytearray(bridge_record())
    chunked[2] |= 0x20
    assert parse_iata_payload(chunked) is None
    assert parse_iata_payload(bridge_record()[:-1]) is None


def test_display_receipt_is_available_only_after_refresh_returns():
    nfc = FakeNfc()
    rendered = []
    target = NfcTarget(nfc)

    def refresh(parsed):
        assert target.refresh_receipt is None
        assert nfc.responses[-1] == b'\x90\x00'
        rendered.append(parsed)

    target.refresh_display = refresh
    write_bridge(target, bridge_record(extra="x" * 100))
    target._process_apdu(bytearray([0x80, 0x11, 0, 0, 0]))
    assert len(rendered) == 1
    assert rendered[0]["dest_code"] == "NRT"
    assert nfc.responses[-1] == b'PA1|current-write\x90\x00'
    target._process_apdu(bytearray([0, 0xD6, 0, 0, 2, 0, 0]))
    target._process_apdu(bytearray([0x80, 0x11, 0, 0, 0]))
    assert nfc.responses[-1] == b'\x65\x81'


@pytest.mark.parametrize("wrong_identity", [False, True])
def test_failed_refresh_or_wrong_bridge_never_acknowledges(wrong_identity):
    nfc = FakeNfc()
    calls = []

    def failed_refresh(parsed):
        calls.append(parsed)
        raise TimeoutError("Panel still busy")

    target = NfcTarget(nfc, refresh_display=failed_refresh)
    record = bridge_record(tag_code="04:B3:7C:1D:9E:2F:81") if wrong_identity else bridge_record()
    write_bridge(target, record)
    target._process_apdu(bytearray([0x80, 0x11, 0, 0, 0]))
    assert nfc.responses[-1] == b'\x65\x81'
    assert len(calls) == (0 if wrong_identity else 1)


def test_partial_or_out_of_bounds_ndef_writes_are_rejected():
    nfc = FakeNfc()
    target = NfcTarget(nfc, refresh_display=lambda _: pytest.fail("Must not render"))
    target._process_apdu(bytearray([0, 0xA4, 0, 0x0C, 2, 0xE1, 4]))
    for command in (
        [0, 0xD6, 0, 0, 2, 0, 20],  # Commit missing payload.
        [0, 0xD6, 1, 255, 2, 0, 0],  # Outside the NDEF file.
        [0, 0xD6, 0, 2, 3, 1],  # Truncated APDU.
        [0, 0xD6, 0, 0, 2, 2, 0],  # NLEN exceeds capacity.
    ):
        target._process_apdu(bytearray(command))
        assert nfc.responses[-1] == b'\x67\x00'
    assert not target.write_completed
    assert target.refresh_receipt is None


def test_ndef_application_select_and_live_readback():
    nfc = FakeNfc()
    target = NfcTarget(nfc, refresh_display=lambda _: None)
    target._process_apdu(bytearray([0, 0xA4, 4, 0, 7, 0xD2, 0x76, 0, 0, 0x85, 1, 1, 0]))
    assert nfc.responses[-1] == b'\x90\x00'
    message = bridge_record()
    write_bridge(target, message)
    target._process_apdu(bytearray([0, 0xB0, 0, 0, 48]))
    assert nfc.responses[-1] == message[:48] + b'\x90\x00'


def test_startup_full_refresh_precedes_partial_refresh_for_nfc_write(monkeypatch):
    monkeypatch.setattr(sys.modules["machine"], "reset", lambda: None, raising=False)
    spec = importlib.util.spec_from_file_location(
        "smarttag_firmware_main", Path(__file__).parent.parent / "main.py")
    firmware = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(firmware)

    updates = []
    panel = SimpleNamespace(
        buffer_1Gray=bytearray(15000),
        init=lambda: updates.append("init"),
        EPD_4IN2_V2_Display=lambda _: updates.append("full"),
        EPD_4IN2_V2_PartialDisplay=lambda _: updates.append("partial"),
    )
    targets = []

    class SingleTapTarget(NfcTarget):
        def listen(self, session_ms):
            write_bridge(self, bridge_record())
            raise KeyboardInterrupt

    def create_target(nfc, uid, refresh):
        target = SingleTapTarget(nfc, uid, refresh)
        targets.append(target)
        return target

    monkeypatch.setattr(firmware, "PN532_UART", lambda *args, **kwargs: FakeNfc())
    monkeypatch.setattr(firmware, "EPD_4in2", lambda: panel)
    monkeypatch.setattr(firmware, "PortraitCanvas", lambda _: MockCanvas())
    monkeypatch.setattr(firmware, "NfcTarget", create_target)

    with pytest.raises(KeyboardInterrupt):
        firmware.main()

    assert updates == ["init", "full", "partial"]
    assert targets[0].refresh_receipt == "current-write"


@pytest.mark.parametrize("busy_values", [[1], [0]])
def test_busy_timeout_or_missing_panel_fails_refresh(monkeypatch, busy_values):
    import epaper4in2

    clock = iter(range(0, 10000, 100))
    monkeypatch.setattr(epaper4in2.time, "ticks_ms", lambda: next(clock), raising=False)
    monkeypatch.setattr(epaper4in2.time, "ticks_diff", lambda end, start: end - start, raising=False)
    monkeypatch.setattr(epaper4in2.time, "sleep_ms", lambda _: None, raising=False)
    panel = EPD_4in2()
    panel.busy = SimpleNamespace(value=lambda: busy_values[0])
    with pytest.raises(TimeoutError):
        panel.EPD_4IN2_V2_PartialDisplay(panel.buffer_1Gray)


def test_refresh_requires_a_complete_busy_cycle_and_v2_update_commands(monkeypatch):
    import epaper4in2

    states = iter([0, 1, 1, 0])
    clock = iter(range(100))
    monkeypatch.setattr(epaper4in2.time, "ticks_ms", lambda: next(clock), raising=False)
    monkeypatch.setattr(epaper4in2.time, "ticks_diff", lambda end, start: end - start, raising=False)
    monkeypatch.setattr(epaper4in2.time, "sleep_ms", lambda _: None, raising=False)
    panel = EPD_4in2()
    panel.busy = SimpleNamespace(value=lambda: next(states))
    commands = []
    panel._send_command = commands.append
    panel.EPD_4IN2_V2_PartialDisplay(panel.buffer_1Gray)
    assert commands[-3:] == [0x24, 0x22, 0x20]
    assert 0x12 not in commands


def test_pn532_uart_validates_frame_checksum_and_strips_response_command(monkeypatch):
    import pn532_uart

    monkeypatch.setattr(pn532_uart.time, "ticks_ms", lambda: 0, raising=False)
    monkeypatch.setattr(pn532_uart.time, "ticks_diff", lambda end, start: end - start, raising=False)
    monkeypatch.setattr(pn532_uart.time, "sleep_ms", lambda _: None, raising=False)
    body = bytes([0xD5, 0x87, 0, 0x80, 0x11, 0, 0, 0])
    response = bytearray(PN532_UART.ACK + b'\x00\x00\xFF' +
                         bytes([len(body), (-len(body)) & 255]) + body +
                         bytes([(-sum(body)) & 255, 0]))

    def read(count):
        data = response[:count]
        del response[:count]
        return data

    uart = SimpleNamespace(any=lambda: len(response), read=read, write=lambda _: None)
    assert PN532_UART(uart).call_function(0x86, response_length=128) == bytearray([0, 0x80, 0x11, 0, 0, 0])


if __name__ == "__main__":
    test_itf_encoding()
    test_itf_horizontal_dimensions()
    test_itf_vertical_dimensions()
    test_parse_pipe_delimited()
    test_parse_digits_only()
    test_parse_init_returns_none()
    test_layout_render_calls()
    print("\n✅ All tests passed!")