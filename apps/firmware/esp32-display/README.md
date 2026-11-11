from machine import Pin, SPI, UART
import time
import framebuf
from pn532.uart import PN532_UART
import epaper4in2

# =========================================================

# 1. PIN WRAPPER CLASS FOR PN532 RESET

# =========================================================

class ResetPinWrapper:
def **init**(self, pin_num):
self._pin = Pin(pin_num, Pin.OUT)
@property
def direction(self): return 0
@direction.setter
def direction(self, val): pass
@property
def value(self): return self._pin.value()
@value.setter
def value(self, val): self._pin.value(1 if val else 0)

# =========================================================

# 2. PORTRAIT GRAPHICS ENGINE (300x400 ON 400x300 E-PAPER)

# =========================================================

class PortraitCanvas:
WIDTH = 300
HEIGHT = 400

    def __init__(self, epd):
        self.epd = epd
        self.fb = epd.image1Gray
        self.black = epd.black
        self.white = epd.white
        # Scratch buffer for rendering & scaling text (max 32 chars = 256x8 px)
        self._scratch_buf = bytearray(256)
        self._scratch = framebuf.FrameBuffer(self._scratch_buf, 256, 8, framebuf.MONO_VLSB)

    def clear(self):
        self.fb.fill(self.white)

    def fill_rect(self, x, y, w, h, color):
        # Clip to 300x400 portrait bounds
        if x < 0: w += x; x = 0
        if y < 0: h += y; y = 0
        if x + w > self.WIDTH: w = self.WIDTH - x
        if y + h > self.HEIGHT: h = self.HEIGHT - y
        if w <= 0 or h <= 0: return
        # Map Portrait (x, y, w, h) -> Native 400x300 (nx, ny, nw, nh)
        nx = y
        ny = self.WIDTH - x - w
        self.fb.fill_rect(nx, ny, h, w, color)

    def rect(self, x, y, w, h, color, thickness=1):
        self.fill_rect(x, y, w, thickness, color)
        self.fill_rect(x, y + h - thickness, w, thickness, color)
        self.fill_rect(x, y, thickness, h, color)
        self.fill_rect(x + w - thickness, y, thickness, h, color)

    def hline(self, x, y, w, color, thickness=1):
        self.fill_rect(x, y, w, thickness, color)

    def vline(self, x, y, h, color, thickness=1):
        self.fill_rect(x, y, thickness, h, color)

    def hatch_rect(self, x, y, w, h, color):
        # Halftone pattern to represent colored side stripes on monochrome e-Paper
        for py in range(y, y + h, 2):
            offset = (py // 2) % 2
            for px in range(x + offset, x + w, 2):
                self.fill_rect(px, py, 1, 1, color)

    def text(self, s, x, y, color, scale=1, bold=False):
        if not s: return
        s = str(s)[:32]
        w_px = len(s) * 8
        self._scratch.fill(0)
        self._scratch.text(s, 0, 0, 1)
        extra_w = 1 if bold else 0
        for py in range(8):
            for px in range(w_px):
                if self._scratch.pixel(px, py):
                    self.fill_rect(x + px * scale, y + py * scale, scale + extra_w, scale, color)

    def text_vertical_up(self, s, x, y, color, scale=1):
        # Draws text rotated 90 degrees counter-clockwise (reading bottom-to-top)
        if not s: return
        s = str(s)[:16]
        w_px = len(s) * 8
        self._scratch.fill(0)
        self._scratch.text(s, 0, 0, 1)
        for py in range(8):
            for px in range(w_px):
                if self._scratch.pixel(px, py):
                    self.fill_rect(x + py * scale, y - (px + 1) * scale, scale, scale, color)

    def draw_airplane_icon(self, x, y, color):
        # Crisp 16x10 pixel airplane silhouette
        self.fill_rect(x + 2, y + 4, 12, 2, color)  # Fuselage
        self.fill_rect(x + 12, y + 3, 3, 2, color)  # Nose
        self.fill_rect(x + 6, y + 1, 3, 8, color)   # Main wings
        self.fill_rect(x + 1, y + 2, 2, 4, color)   # Tail fin

# =========================================================

# 3. IATA ITF-10 BARCODE GENERATORS (HIGH-CONTRAST SCALING)

# =========================================================

ITF_PATTERNS = [
"00110", "10001", "01001", "11000", "00101",
"10100", "01100", "00011", "10010", "01010"
]

def _encode_itf_elements(code): # Ensure 10-digit even-length numeric string for IATA standard
digits = "".join([c for c in str(code) if '0' <= c <= '9'])
if not digits:
digits = "0074774268"
if len(digits) < 10:
digits = ("0" * (10 - len(digits))) + digits
elif len(digits) > 10:
digits = digits[:10]
if len(digits) % 2 != 0:
digits = "0" + digits

    # Start code: narrow bar, narrow space, narrow bar, narrow space
    elements = [(True, '0'), (False, '0'), (True, '0'), (False, '0')]
    # Interleaved digit pairs (50 elements total for 10 digits)
    for i in range(0, len(digits), 2):
        p_bar = ITF_PATTERNS[int(digits[i])]
        p_space = ITF_PATTERNS[int(digits[i + 1])]
        for j in range(5):
            elements.append((True, p_bar[j]))
            elements.append((False, p_space[j]))
    # Stop code: wide bar, narrow space, narrow bar
    elements.extend([(True, '1'), (False, '0'), (True, '0')])
    return elements

def draw_itf_barcode_horizontal(canvas, center_x, y, code, height=68, narrow=3, wide=7): # Picket-fence orientation (vertical bars |||, scanned horizontally) # Default narrow=3, wide=7 -> Total width = 36*3 + 21*7 = 255 px
elements = _encode_itf_elements(code)
total_w = sum(wide if w_type == '1' else narrow for _, w_type in elements)
cur_x = center_x - (total_w // 2)
for is_black, w_type in elements:
w = wide if w_type == '1' else narrow
if is_black:
canvas.fill_rect(cur_x, y, w, height, canvas.black)
cur_x += w

def draw_itf_barcode_vertical(canvas, center_x, y, code, bar_width=255, narrow=2, wide=5): # Ladder orientation (horizontal bars === stacked top-to-bottom, scanned vertically) # Default narrow=2, wide=5 -> Total height = 36*2 + 21*5 = 177 px
elements = _encode_itf_elements(code)
start_x = center_x - (bar_width // 2)
cur_y = y
for is_black, w_type in elements:
h = wide if w_type == '1' else narrow
if is_black:
canvas.fill_rect(start_x, cur_y, bar_width, h, canvas.black)
cur_y += h

# =========================================================

# 4. COMPLETE IATA BAGGAGE TAG LAYOUT RENDERER (PORTRAIT)

# =========================================================

def render_iata_baggage_tag(canvas, data):
canvas.clear()

    tag_num   = data["tag_num"]     # e.g. "0074774268"
    dest_code = data["dest_code"]   # e.g. "JFK"
    dest_city = data["dest_city"]   # e.g. "NEW YORK"
    flight    = data["flight"]      # e.g. "KL 1592"
    date_str  = data["date"]        # e.g. "30SEP"
    time_str  = data["time"]        # e.g. "1740"
    passenger = data["passenger"]   # e.g. "NGUYEN/DUC MANH"

    # Extract 3-digit airline numeric code (digits 1..4) & 2-letter carrier code
    airline_num = tag_num[1:4] if len(tag_num) >= 4 else "074"
    serial_num  = tag_num[4:10] if len(tag_num) >= 10 else tag_num[-6:]
    carrier_2l  = "".join([c for c in flight if 'A' <= c <= 'Z'])[:2] or "VN"
    license_str = f"{tag_num[:4]}{carrier_2l}  {serial_num}"

    # ---------------------------------------------------------
    # SECTION 1: MAXIMIZED ORTHOGONAL BARCODE ZONE (Y = 6 to 275)
    # Occupies ~68% of screen height with unobstructed Quiet Zones
    # ---------------------------------------------------------
    # 1A. Top Horizontal Barcode (255x68 px, narrow=3, wide=7, Y = 6..74)
    draw_itf_barcode_horizontal(canvas, center_x=150, y=6, code=tag_num, height=68, narrow=3, wide=7)

    # 14 px Pure White Quiet Zone between barcodes (Y = 74..88)

    # 1B. Vertical Ladder Barcode (255x177 px, narrow=2, wide=5, Y = 88..265)
    draw_itf_barcode_vertical(canvas, center_x=150, y=88, code=tag_num, bar_width=255, narrow=2, wide=5)

    # 11 px Pure White Quiet Zone below ladder barcode (Y = 265..276)

    # ---------------------------------------------------------
    # SECTION 2: LICENSE PLATE, AIRLINE BADGE & PASSENGER (Y = 276 to 312)
    # ---------------------------------------------------------
    canvas.hline(10, 276, 280, canvas.black, thickness=1)
    canvas.vline(10, 276, 90, canvas.black, thickness=1)
    canvas.vline(290, 276, 90, canvas.black, thickness=1)
    canvas.hatch_rect(11, 277, 10, 88, canvas.black)
    canvas.hatch_rect(280, 277, 10, 88, canvas.black)

    # Row 1: License plate on left + Inverted [074] badge & Airplane icon on right
    canvas.text(license_str, 25, 280, canvas.black, scale=1, bold=True)
    canvas.fill_rect(190, 278, 38, 12, canvas.black)
    canvas.text(airline_num, 197, 280, canvas.white, scale=1, bold=True)
    canvas.draw_airplane_icon(234, 279, canvas.black)

    # Row 2: Destination City / Code
    canvas.text(f"{dest_city[:16]} / {dest_code}", 25, 291, canvas.black, scale=1)

    # Row 3: Passenger Name
    canvas.text(f"PAX: {passenger[:23]}", 25, 301, canvas.black, scale=1, bold=True)

    # ---------------------------------------------------------
    # SECTION 3: MAIN DESTINATION & FLIGHT BLOCK (Y = 312 to 365)
    # ---------------------------------------------------------
    canvas.hline(10, 312, 280, canvas.black, thickness=1)

    # Destination City Header
    canvas.text(dest_city[:16], 36, 315, canvas.black, scale=1, bold=True)

    # Vertical "TO" label on the left
    canvas.text_vertical_up("TO", 24, 355, canvas.black, scale=1)

    # Large Inverted Black Destination Box (X = 34, Y = 325, W = 134, H = 37)
    canvas.fill_rect(34, 325, 134, 37, canvas.black)
    # 3-letter IATA Airport Code (scale=4 -> 32x32 px per char)
    code_x = 34 + (134 - (len(dest_code) * 8 * 4)) // 2
    canvas.text(dest_code, code_x, 328, canvas.white, scale=4, bold=True)

    # Vertical Departure Time Badge attached to right edge of black box
    canvas.fill_rect(170, 328, 12, 31, canvas.black)
    canvas.text_vertical_up(time_str[:4], 172, 358, canvas.white, scale=1)

    # Flight Number, Date, and Sequence on the right side
    canvas.text(flight[:7], 188, 326, canvas.black, scale=1, bold=True)
    canvas.text(f"DATE:{date_str[:5]}", 188, 339, canvas.black, scale=1)
    canvas.text(f"SEQ:{serial_num}", 188, 351, canvas.black, scale=1)

    # ---------------------------------------------------------
    # SECTION 4: HIGH-CONTRAST BOTTOM BAGGAGE STUB (Y = 365 to 398)
    # ---------------------------------------------------------
    canvas.hline(10, 365, 280, canvas.black, thickness=1)

    # Stub Barcode upgraded to narrow=2, wide=5 (Width = 198 px, Height = 28 px)
    draw_itf_barcode_horizontal(canvas, center_x=114, y=369, code=tag_num, height=28, narrow=2, wide=5)
    canvas.text(dest_code, 224, 371, canvas.black, scale=2, bold=True)
    canvas.text(airline_num, 236, 389, canvas.black, scale=1, bold=True)

# =========================================================

# 5. NDEF PAYLOAD PARSER & NFC TYPE 4 EMULATOR

# =========================================================

CC_FILE = bytearray([
0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34,
0x04, 0x06, 0xE1, 0x04, 0x00, 0xFF, 0x00, 0x00
])

TARGET_PARAMS = bytearray([
0x00,
0x04, 0x00, 0x12, 0x34, 0x56, 0x20,
0x01, 0xFE, 0x05, 0x01, 0x86, 0x04, 0x02, 0x02, 0x03, 0x00, 0x4B, 0x02, 0x4F, 0x49, 0x8A, 0x00, 0xFF, 0xFF,
0xAA, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11,
0x00, 0x00
])

def configure_nfc_picc(nfc):
nfc.call_function(0x12, response_length=0, params=bytearray([0x34]), timeout=200)

def parse_iata_payload(ndef_buf):
nlen = (ndef_buf[0] << 8) | ndef_buf[1]
search_end = min(len(ndef_buf), (2 + nlen) if nlen > 0 else 180)
raw_bytes = ndef_buf[2:search_end]

    text_str = ""
    for idx in range(min(12, len(raw_bytes) - 3)):
        if raw_bytes[idx] == 0x54:  # 'T' record type
            plen = raw_bytes[idx - 1]
            lang_len = raw_bytes[idx + 1] & 0x3F
            start = idx + 2 + lang_len
            end = min(len(raw_bytes), idx + 1 + plen)
            text_str = "".join([chr(b) for b in raw_bytes[start:end] if 32 <= b <= 126])
            break

    if not text_str:
        text_str = "".join([chr(b) for b in raw_bytes if 32 <= b <= 126])

    text_str = text_str.strip()
    if not text_str or text_str == "INIT":
        return None

    print(f"    -> Decoded NDEF Text: '{text_str}'")

    result = {
        "tag_num": "0074774268",
        "dest_code": "JFK",
        "dest_city": "NEW YORK",
        "flight": "KL 1592",
        "date": "30SEP",
        "time": "1740",
        "passenger": "NGUYEN/DUC MANH"
    }

    if "|" in text_str:
        parts = [p.strip().upper() for p in text_str.split("|")]
        if len(parts) >= 1 and parts[0]:
            nums = "".join([c for c in parts[0] if '0' <= c <= '9'])
            if nums: result["tag_num"] = (nums + "0000000000")[:10]
        if len(parts) >= 2 and parts[1]:
            result["dest_code"] = parts[1][:3]
        if len(parts) >= 3 and parts[2]:
            result["dest_city"] = parts[2]
        if len(parts) >= 4 and parts[3]:
            result["flight"] = parts[3]
        if len(parts) >= 5 and parts[4]:
            result["date"] = parts[4]
        if len(parts) >= 6 and parts[5]:
            result["time"] = parts[5]
        if len(parts) >= 7 and parts[6]:
            result["passenger"] = parts[6]
        return result
    else:
        nums = "".join([c for c in text_str if '0' <= c <= '9'])
        if len(nums) >= 6:
            result["tag_num"] = (nums + "0000000000")[:10]
            return result

    return None

def listen_phone_data(nfc, uart_port, ndef_file):
current_file = 0xE103
write_completed = False
wrote_payload = False

    def process_apdu(apdu):
        nonlocal current_file, write_completed, wrote_payload
        hex_str = " ".join([f"{b:02X}" for b in apdu])
        print(f"    -> APDU: {hex_str}")

        # 1. SELECT (00 A4 ...)
        if len(apdu) >= 2 and apdu[0] == 0x00 and apdu[1] == 0xA4:
            if apdu[2] == 0x04:
                if len(apdu) >= 12 and apdu[5:11] == b'\xD2\x76\x00\x00\x85\x01':
                    nfc.call_function(0x8E, response_length=1, params=bytearray([0x90, 0x00]), timeout=300)
                else:
                    nfc.call_function(0x8E, response_length=1, params=bytearray([0x6A, 0x82]), timeout=300)
            elif apdu[2] == 0x00 and len(apdu) >= 7:
                current_file = (apdu[5] << 8) | apdu[6]
                if current_file in (0xE103, 0xE104):
                    nfc.call_function(0x8E, response_length=1, params=bytearray([0x90, 0x00]), timeout=300)
                else:
                    nfc.call_function(0x8E, response_length=1, params=bytearray([0x6A, 0x82]), timeout=300)
            else:
                nfc.call_function(0x8E, response_length=1, params=bytearray([0x90, 0x00]), timeout=300)

        # 2. READ BINARY (00 B0 ...)
        elif len(apdu) >= 5 and apdu[0] == 0x00 and apdu[1] == 0xB0:
            offset = (apdu[2] << 8) | apdu[3]
            le = apdu[4]
            if current_file == 0xE103:
                data = CC_FILE[offset : offset + le]
            else:
                data = ndef_file[offset : offset + le]
            res = bytearray(data) + bytearray([0x90, 0x00])
            nfc.call_function(0x8E, response_length=1, params=res, timeout=300)

        # 3. UPDATE BINARY (00 D6 ...) - Supports multi-packet writes
        elif len(apdu) >= 5 and apdu[0] == 0x00 and apdu[1] == 0xD6:
            offset = (apdu[2] << 8) | apdu[3]
            lc = apdu[4]
            payload = apdu[5 : 5 + lc]
            ndef_file[offset : offset + lc] = payload

            nfc.call_function(0x8E, response_length=1, params=bytearray([0x90, 0x00]), timeout=300)

            if offset >= 2 or lc > 2:
                wrote_payload = True
            if offset == 0 and lc == 2 and ((payload[0] << 8) | payload[1]) > 0 and wrote_payload:
                write_completed = True
            elif offset == 0 and lc > 5:
                write_completed = True

        # 4. Reject proprietary classes (e.g. DESFire 90 60) with 6E 00
        elif apdu[0] != 0x00:
            nfc.call_function(0x8E, response_length=1, params=bytearray([0x6E, 0x00]), timeout=300)

        # 5. Unsupported instruction
        else:
            nfc.call_function(0x8E, response_length=1, params=bytearray([0x6D, 0x00]), timeout=300)

    try:
        init_res = nfc.call_function(0x8C, response_length=64, params=TARGET_PARAMS, timeout=5000)
        if init_res:
            print("\n[+] PHONE CONNECTED! Receiving IATA tag data...")
            first_cmd = init_res[1:]
            if len(first_cmd) >= 2 and (first_cmd[0] == 0x00 or first_cmd[0] == 0x90):
                process_apdu(first_cmd)

            for _ in range(40):
                req = nfc.call_function(0x86, response_length=128, timeout=600)
                if not req:
                    break
                status = req[0]
                if status != 0x00:
                    print(f"    -> Session ended (Status: 0x{status:02X})")
                    break
                if len(req) > 1:
                    process_apdu(req[1:])
                    if write_completed:
                        return parse_iata_payload(ndef_file)

            if wrote_payload:
                return parse_iata_payload(ndef_file)

    except Exception as e:
        print("    -> Communication interrupted, resetting target:", e)
        while uart_port.any():
            uart_port.read()
        nfc.reset()
        configure_nfc_picc(nfc)

    return None

# =========================================================

# 6. SYSTEM INITIALIZATION & MAIN LOOP

# =========================================================

uart_port = UART(1, baudrate=115200, tx=Pin(23), rx=Pin(22), timeout=25, timeout_char=5)
rst_pin = ResetPinWrapper(7)
nfc = PN532_UART(uart_port, reset=rst_pin, debug=False)
configure_nfc_picc(nfc)

# Pre-load 512-byte NDEF buffer with a valid initial Text record ("INIT")

ndef_memory = bytearray(512)
init_record = bytearray([0x00, 0x0B, 0xD1, 0x01, 0x07, 0x54, 0x02, 0x65, 0x6E, 0x49, 0x4E, 0x49, 0x54])
ndef_memory[0:len(init_record)] = init_record

print("Initializing 4.2-inch e-Paper in Portrait Mode (300x400)...")
epd = epaper4in2.EPD_4in2()
canvas = PortraitCanvas(epd)

print("\n>>> SYSTEM READY. TAP PHONE TO WRITE IATA BAGGAGE TAG <<<")

while True:
baggage_data = listen_phone_data(nfc, uart_port, ndef_memory)

    if baggage_data:
        print("\n[V] IATA BAGGAGE DATA RECEIVED:")
        for k, v in baggage_data.items():
            print(f"    {k.upper()}: {v}")

        render_iata_baggage_tag(canvas, baggage_data)

        print("Updating e-Paper display...")
        epd.EPD_4IN2_V2_PartialDisplay(epd.buffer_1Gray)
        print("Done! Ready for next scan.")

        time.sleep(3)
        nfc.reset()
        configure_nfc_picc(nfc)
