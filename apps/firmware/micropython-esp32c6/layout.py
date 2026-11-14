# IATA Baggage Tag Layout Renderer (Portrait 300x400)
# 4-section layout matching airline baggage tag standard

from graphics import PortraitCanvas
from barcode import draw_itf_barcode_horizontal, draw_itf_barcode_vertical


def render_iata_baggage_tag(canvas: PortraitCanvas, data: dict):
    """
    Render complete IATA baggage tag to canvas.

    Expected data keys:
    - tag_num: 10-digit license plate (e.g. "0074774268")
    - dest_code: 3-letter IATA (e.g. "JFK")
    - dest_city: city name (e.g. "NEW YORK")
    - flight: flight number (e.g. "KL 1592")
    - date: date string (e.g. "30SEP")
    - time: time string (e.g. "1740")
    - passenger: passenger name (e.g. "NGUYEN/DUC MANH")
    """
    canvas.clear()

    tag_num = data.get("tag_num", "0074774268")
    dest_code = data.get("dest_code", "JFK")
    dest_city = data.get("dest_city", "NEW YORK")
    flight = data.get("flight", "KL 1592")
    date_str = data.get("date", "30SEP")
    time_str = data.get("time", "1740")
    passenger = data.get("passenger", "NGUYEN/DUC MANH")

    # Extract airline numeric code (digits 1-3) & 2-letter carrier code
    airline_num = tag_num[1:4] if len(tag_num) >= 4 else "074"
    serial_num = tag_num[4:10] if len(tag_num) >= 10 else tag_num[-6:]
    carrier_2l = "".join([c for c in flight if 'A' <= c <= 'Z'])[:2] or "VN"
    license_str = f"{tag_num[:4]}{carrier_2l}  {serial_num}"

    # =========================================================
    # SECTION 1: MAXIMIZED ORTHOGONAL BARCODE ZONE (Y = 6 to 275)
    # Two barcodes with mandatory quiet zones
    # =========================================================

    # 1A. Top Horizontal Barcode (255x68 px, Y = 6..74)
    draw_itf_barcode_horizontal(canvas, center_x=150, y=6, code=tag_num, height=68, narrow=3, wide=7)

    # 14px Quiet Zone (Y = 74..88) - canvas stays white

    # 1B. Vertical Ladder Barcode (255x177 px, Y = 88..265)
    draw_itf_barcode_vertical(canvas, center_x=150, y=88, code=tag_num, bar_width=255, narrow=2, wide=5)

    # 11px Quiet Zone below ladder (Y = 265..276)

    # =========================================================
    # SECTION 2: LICENSE PLATE, AIRLINE BADGE & PASSENGER (Y = 276 to 312)
    # =========================================================

    # Frame
    canvas.hline(10, 276, 280, canvas.black, thickness=1)
    canvas.vline(10, 276, 90, canvas.black, thickness=1)
    canvas.vline(290, 276, 90, canvas.black, thickness=1)
    canvas.hatch_rect(11, 277, 10, 88, canvas.black)   # Left stripe
    canvas.hatch_rect(280, 277, 10, 88, canvas.black)  # Right stripe

    # Row 1: License plate + Inverted airline badge + Airplane
    canvas.text(license_str, 25, 280, canvas.black, scale=1, bold=True)
    canvas.fill_rect(190, 278, 38, 12, canvas.black)
    canvas.text(airline_num, 197, 280, canvas.white, scale=1, bold=True)
    canvas.draw_airplane_icon(234, 279, canvas.black)

    # Row 2: Destination City / Code
    canvas.text(f"{dest_city[:16]} / {dest_code}", 25, 291, canvas.black, scale=1)

    # Row 3: Passenger Name
    canvas.text(f"PAX: {passenger[:23]}", 25, 301, canvas.black, scale=1, bold=True)

    # =========================================================
    # SECTION 3: MAIN DESTINATION & FLIGHT BLOCK (Y = 312 to 365)
    # =========================================================

    canvas.hline(10, 312, 280, canvas.black, thickness=1)

    # Destination City Header
    canvas.text(dest_city[:16], 36, 315, canvas.black, scale=1, bold=True)

    # Vertical "TO" label
    canvas.text_vertical_up("TO", 24, 355, canvas.black, scale=1)

    # Large Inverted Black Destination Box (X=34, Y=325, W=134, H=37)
    canvas.fill_rect(34, 325, 134, 37, canvas.black)
    # 3-letter IATA code centered in box (scale=4 -> 32x32 per char)
    code_x = 34 + (134 - (len(dest_code) * 8 * 4)) // 2
    canvas.text(dest_code, code_x, 328, canvas.white, scale=4, bold=True)

    # Vertical Departure Time Badge on right edge of black box
    canvas.fill_rect(170, 328, 12, 31, canvas.black)
    canvas.text_vertical_up(time_str[:4], 172, 358, canvas.white, scale=1)

    # Flight Number, Date, Sequence on right side
    canvas.text(flight[:7], 188, 326, canvas.black, scale=1, bold=True)
    canvas.text(f"DATE:{date_str[:5]}", 188, 339, canvas.black, scale=1)
    canvas.text(f"SEQ:{serial_num}", 188, 351, canvas.black, scale=1)

    # =========================================================
    # SECTION 4: BOTTOM BAGGAGE STUB (Y = 365 to 398)
    # =========================================================

    canvas.hline(10, 365, 280, canvas.black, thickness=1)

    # Stub Barcode (narrow=2, wide=5 -> Width=198px, Height=28px)
    draw_itf_barcode_horizontal(canvas, center_x=114, y=369, code=tag_num, height=28, narrow=2, wide=5)
    canvas.text(dest_code, 224, 371, canvas.black, scale=2, bold=True)
    canvas.text(airline_num, 236, 389, canvas.black, scale=1, bold=True)