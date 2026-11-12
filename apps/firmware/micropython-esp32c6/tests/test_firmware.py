#!/usr/bin/env python3
"""
Unit tests for MicroPython firmware modules.
Run on host: python -m pytest tests/ -v
"""

import sys
from pathlib import Path

# Add firmware dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Mocks are installed via conftest.py into sys.modules before test collection

from barcode import _encode_itf_elements, draw_itf_barcode_horizontal, draw_itf_barcode_vertical
from graphics import PortraitCanvas
from nfc_handler import parse_iata_payload
from layout import render_iata_baggage_tag


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
    # [4]   Payload Length = 4 + len(payload) (type + lang_len + lang + payload)
    # [5]   Type = 'T' (0x54)
    # [6]   Language Length = 2
    # [7-8] Language = 'en' (0x65 0x6E)
    # [9:]  Payload
    msg_len = 7 + len(payload)
    ndef = bytearray([msg_len >> 8, msg_len & 0xFF, 0xD1, 0x01, 4 + len(payload), 0x54, 0x02, 0x65, 0x6E])
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
    ndef = bytearray([msg_len >> 8, msg_len & 0xFF, 0xD1, 0x01, 4 + len(payload), 0x54, 0x02, 0x65, 0x6E])
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


if __name__ == "__main__":
    test_itf_encoding()
    test_itf_horizontal_dimensions()
    test_itf_vertical_dimensions()
    test_parse_pipe_delimited()
    test_parse_digits_only()
    test_parse_init_returns_none()
    test_layout_render_calls()
    print("\n✅ All tests passed!")