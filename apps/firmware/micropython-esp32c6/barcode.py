# IATA ITF-10 (Interleaved 2 of 5) Barcode Generators
# Two orientations: horizontal (picket-fence) and vertical (ladder)

ITF_PATTERNS = [
    "00110",  # 0
    "10001",  # 1
    "01001",  # 2
    "11000",  # 3
    "00101",  # 4
    "10100",  # 5
    "01100",  # 6
    "00011",  # 7
    "10010",  # 8
    "01010",  # 9
]


def _encode_itf_elements(code: str):
    """Encode digits into ITF bar/space width types ('0'=narrow, '1'=wide)"""
    # Extract digits, pad to 10
    digits = "".join([c for c in str(code) if '0' <= c <= '9'])
    if not digits:
        digits = "0074774268"
    if len(digits) < 10:
        digits = ("0" * (10 - len(digits))) + digits
    elif len(digits) > 10:
        digits = digits[:10]
    if len(digits) % 2 != 0:
        digits = "0" + digits

    # Start pattern: narrow bar, narrow space, narrow bar, narrow space
    elements = [(True, '0'), (False, '0'), (True, '0'), (False, '0')]

    # Interleaved digit pairs (5 pairs for 10 digits = 50 elements)
    for i in range(0, len(digits), 2):
        p_bar = ITF_PATTERNS[int(digits[i])]
        p_space = ITF_PATTERNS[int(digits[i + 1])]
        for j in range(5):
            elements.append((True, p_bar[j]))      # Bar
            elements.append((False, p_space[j]))   # Space

    # Stop pattern: wide bar, narrow space, narrow bar
    elements.extend([(True, '1'), (False, '0'), (True, '0')])
    return elements


def draw_itf_barcode_horizontal(canvas, center_x: int, y: int, code: str,
                                 height: int = 68, narrow: int = 3, wide: int = 7):
    """
    Picket-fence orientation (vertical bars |||)
    Default narrow=3, wide=7 -> Total width = 36*3 + 21*7 = 255 px
    """
    elements = _encode_itf_elements(code)
    total_w = sum(wide if w_type == '1' else narrow for _, w_type in elements)
    cur_x = center_x - (total_w // 2)
    for is_black, w_type in elements:
        w = wide if w_type == '1' else narrow
        if is_black:
            canvas.fill_rect(cur_x, y, w, height, canvas.black)
        cur_x += w


def draw_itf_barcode_vertical(canvas, center_x: int, y: int, code: str,
                               bar_width: int = 255, narrow: int = 2, wide: int = 5):
    """
    Ladder orientation (horizontal bars === stacked)
    Default narrow=2, wide=5 -> Total height = 36*2 + 21*5 = 177 px
    """
    elements = _encode_itf_elements(code)
    start_x = center_x - (bar_width // 2)
    cur_y = y
    for is_black, w_type in elements:
        h = wide if w_type == '1' else narrow
        if is_black:
            canvas.fill_rect(start_x, cur_y, bar_width, h, canvas.black)
        cur_y += h