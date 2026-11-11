#include "display_renderer.h"
#include <string.h>
#include <stdio.h>
#include <ctype.h>

// ---------------------------------------------------------------------------
// 5x7 Monospace Font Table (ASCII 32 ' ' to 126 '~')
// ---------------------------------------------------------------------------
static const uint8_t FONT_5X7[][5] = {
    {0x00, 0x00, 0x00, 0x00, 0x00}, // 32 ' '
    {0x00, 0x00, 0x5F, 0x00, 0x00}, // 33 '!'
    {0x00, 0x07, 0x00, 0x07, 0x00}, // 34 '"'
    {0x14, 0x7F, 0x14, 0x7F, 0x14}, // 35 '#'
    {0x24, 0x2A, 0x7F, 0x2A, 0x12}, // 36 '$'
    {0x23, 0x13, 0x08, 0x64, 0x62}, // 37 '%'
    {0x36, 0x49, 0x55, 0x22, 0x50}, // 38 '&'
    {0x00, 0x05, 0x03, 0x00, 0x00}, // 39 '''
    {0x00, 0x1C, 0x22, 0x41, 0x00}, // 40 '('
    {0x00, 0x41, 0x22, 0x1C, 0x00}, // 41 ')'
    {0x14, 0x08, 0x3E, 0x08, 0x14}, // 42 '*'
    {0x08, 0x08, 0x3E, 0x08, 0x08}, // 43 '+'
    {0x00, 0x50, 0x30, 0x00, 0x00}, // 44 ','
    {0x08, 0x08, 0x08, 0x08, 0x08}, // 45 '-'
    {0x00, 0x60, 0x60, 0x00, 0x00}, // 46 '.'
    {0x20, 0x10, 0x08, 0x04, 0x02}, // 47 '/'
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, // 48 '0'
    {0x00, 0x42, 0x7F, 0x40, 0x00}, // 49 '1'
    {0x42, 0x61, 0x51, 0x49, 0x46}, // 50 '2'
    {0x21, 0x41, 0x45, 0x4B, 0x31}, // 51 '3'
    {0x18, 0x14, 0x12, 0x7F, 0x10}, // 52 '4'
    {0x27, 0x45, 0x45, 0x45, 0x39}, // 53 '5'
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, // 54 '6'
    {0x01, 0x71, 0x09, 0x05, 0x03}, // 55 '7'
    {0x36, 0x49, 0x49, 0x49, 0x36}, // 56 '8'
    {0x06, 0x49, 0x49, 0x29, 0x1E}, // 57 '9'
    {0x00, 0x36, 0x36, 0x00, 0x00}, // 58 ':'
    {0x00, 0x56, 0x36, 0x00, 0x00}, // 59 ';'
    {0x08, 0x14, 0x22, 0x41, 0x00}, // 60 '<'
    {0x14, 0x14, 0x14, 0x14, 0x14}, // 61 '='
    {0x00, 0x41, 0x22, 0x14, 0x08}, // 62 '>'
    {0x02, 0x01, 0x51, 0x09, 0x06}, // 63 '?'
    {0x32, 0x49, 0x79, 0x41, 0x3E}, // 64 '@'
    {0x7E, 0x11, 0x11, 0x11, 0x7E}, // 65 'A'
    {0x7F, 0x49, 0x49, 0x49, 0x36}, // 66 'B'
    {0x3E, 0x41, 0x41, 0x41, 0x22}, // 67 'C'
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, // 68 'D'
    {0x7F, 0x49, 0x49, 0x49, 0x41}, // 69 'E'
    {0x7F, 0x09, 0x09, 0x09, 0x01}, // 70 'F'
    {0x3E, 0x41, 0x49, 0x49, 0x7A}, // 71 'G'
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, // 72 'H'
    {0x00, 0x41, 0x7F, 0x41, 0x00}, // 73 'I'
    {0x20, 0x40, 0x41, 0x3F, 0x01}, // 74 'J'
    {0x7F, 0x08, 0x14, 0x22, 0x41}, // 75 'K'
    {0x7F, 0x40, 0x40, 0x40, 0x40}, // 76 'L'
    {0x7F, 0x02, 0x0C, 0x02, 0x7F}, // 77 'M'
    {0x7F, 0x04, 0x08, 0x10, 0x7F}, // 78 'N'
    {0x3E, 0x41, 0x41, 0x41, 0x3E}, // 79 'O'
    {0x7F, 0x09, 0x09, 0x09, 0x06}, // 80 'P'
    {0x3E, 0x41, 0x51, 0x21, 0x5E}, // 81 'Q'
    {0x7F, 0x09, 0x19, 0x29, 0x46}, // 82 'R'
    {0x46, 0x49, 0x49, 0x49, 0x31}, // 83 'S'
    {0x01, 0x01, 0x7F, 0x01, 0x01}, // 84 'T'
    {0x3F, 0x40, 0x40, 0x40, 0x3F}, // 85 'U'
    {0x1F, 0x20, 0x40, 0x20, 0x1F}, // 86 'V'
    {0x3F, 0x40, 0x38, 0x40, 0x3F}, // 87 'W'
    {0x63, 0x14, 0x08, 0x14, 0x63}, // 88 'X'
    {0x07, 0x08, 0x70, 0x08, 0x07}, // 89 'Y'
    {0x61, 0x51, 0x49, 0x45, 0x43}, // 90 'Z'
    {0x00, 0x7F, 0x41, 0x41, 0x00}, // 91 '['
    {0x02, 0x04, 0x08, 0x10, 0x20}, // 92 '\'
    {0x00, 0x41, 0x41, 0x7F, 0x00}, // 93 ']'
    {0x04, 0x02, 0x01, 0x02, 0x04}, // 94 '^'
    {0x40, 0x40, 0x40, 0x40, 0x40}, // 95 '_'
    {0x00, 0x01, 0x02, 0x04, 0x00}, // 96 '`'
    {0x20, 0x54, 0x54, 0x54, 0x78}, // 97 'a'
    {0x7F, 0x48, 0x44, 0x44, 0x38}, // 98 'b'
    {0x38, 0x44, 0x44, 0x44, 0x20}, // 99 'c'
    {0x38, 0x44, 0x44, 0x48, 0x7F}, // 100 'd'
    {0x38, 0x54, 0x54, 0x54, 0x18}, // 101 'e'
    {0x08, 0x7E, 0x09, 0x01, 0x02}, // 102 'f'
    {0x0C, 0x52, 0x52, 0x52, 0x3E}, // 103 'g'
    {0x7F, 0x08, 0x04, 0x04, 0x78}, // 104 'h'
    {0x00, 0x44, 0x7D, 0x40, 0x00}, // 105 'i'
    {0x20, 0x40, 0x44, 0x3D, 0x00}, // 106 'j'
    {0x7F, 0x10, 0x28, 0x44, 0x00}, // 107 'k'
    {0x00, 0x41, 0x7F, 0x40, 0x00}, // 108 'l'
    {0x7C, 0x04, 0x18, 0x04, 0x78}, // 109 'm'
    {0x7C, 0x08, 0x04, 0x04, 0x78}, // 110 'n'
    {0x38, 0x44, 0x44, 0x44, 0x38}, // 111 'o'
    {0x7C, 0x14, 0x14, 0x14, 0x08}, // 112 'p'
    {0x08, 0x14, 0x14, 0x18, 0x7C}, // 113 'q'
    {0x7C, 0x08, 0x04, 0x04, 0x08}, // 114 'r'
    {0x48, 0x54, 0x54, 0x54, 0x20}, // 115 's'
    {0x04, 0x3F, 0x44, 0x40, 0x20}, // 116 't'
    {0x3C, 0x40, 0x40, 0x20, 0x7C}, // 117 'u'
    {0x1C, 0x20, 0x40, 0x20, 0x1C}, // 118 'v'
    {0x3C, 0x40, 0x30, 0x40, 0x3C}, // 119 'w'
    {0x44, 0x28, 0x10, 0x28, 0x44}, // 120 'x'
    {0x0C, 0x50, 0x50, 0x50, 0x3C}, // 121 'y'
    {0x44, 0x64, 0x54, 0x4C, 0x44}, // 122 'z'
    {0x00, 0x08, 0x36, 0x41, 0x00}, // 123 '{'
    {0x00, 0x00, 0x7F, 0x00, 0x00}, // 124 '|'
    {0x00, 0x41, 0x36, 0x08, 0x00}, // 125 '}'
    {0x08, 0x08, 0x2A, 0x1C, 0x08}  // 126 '~'
};

// ---------------------------------------------------------------------------
// Interleaved 2 of 5 Barcode Weights
// ---------------------------------------------------------------------------
// Each digit (0-9) represented by 5 elements (2 wide '1', 3 narrow '0')
static const uint8_t ITF_PATTERNS[10] = {
    0x06, // 0: 00110 [1,1,3,3,1]
    0x11, // 1: 10001 [3,1,1,1,3]
    0x09, // 2: 01001 [1,3,1,1,3]
    0x18, // 3: 11000 [3,3,1,1,1]
    0x05, // 4: 00101 [1,1,3,1,3]
    0x14, // 5: 10100 [3,1,3,1,1]
    0x0C, // 6: 01100 [1,3,3,1,1]
    0x03, // 7: 00011 [1,1,1,3,3]
    0x12, // 8: 10010 [3,1,1,3,1]
    0x0A  // 9: 01010 [1,3,1,3,1]
};

void epd_buffer_init(EpdFrameBuffer *fb) {
    if (!fb) return;
    fb->width = EPD_WIDTH;
    fb->height = EPD_HEIGHT;
    epd_buffer_clear(fb, EPD_COLOR_WHITE);
}

void epd_buffer_clear(EpdFrameBuffer *fb, uint8_t color) {
    if (!fb) return;
    uint8_t byte_val = (color == EPD_COLOR_WHITE) ? 0xFF : 0x00;
    memset(fb->buffer, byte_val, EPD_BUFFER_SIZE);
}

void epd_draw_pixel(EpdFrameBuffer *fb, int x, int y, uint8_t color) {
    if (!fb || x < 0 || x >= EPD_WIDTH || y < 0 || y >= EPD_HEIGHT) return;
    size_t byte_idx = (y * EPD_WIDTH + x) / 8;
    uint8_t bit_mask = (uint8_t)(0x80 >> (x % 8));

    if (color == EPD_COLOR_WHITE) {
        fb->buffer[byte_idx] |= bit_mask;
    } else {
        fb->buffer[byte_idx] &= ~bit_mask;
    }
}

void epd_draw_fast_hline(EpdFrameBuffer *fb, int x, int y, int w, uint8_t color) {
    for (int i = 0; i < w; i++) {
        epd_draw_pixel(fb, x + i, y, color);
    }
}

void epd_draw_fast_vline(EpdFrameBuffer *fb, int x, int y, int h, uint8_t color) {
    for (int i = 0; i < h; i++) {
        epd_draw_pixel(fb, x, y + i, color);
    }
}

void epd_fill_rect(EpdFrameBuffer *fb, int x, int y, int w, int h, uint8_t color) {
    for (int j = 0; j < h; j++) {
        epd_draw_fast_hline(fb, x, y + j, w, color);
    }
}

void epd_draw_rect(EpdFrameBuffer *fb, int x, int y, int w, int h, uint8_t color) {
    epd_draw_fast_hline(fb, x, y, w, color);
    epd_draw_fast_hline(fb, x, y + h - 1, w, color);
    epd_draw_fast_vline(fb, x, y, h, color);
    epd_draw_fast_vline(fb, x + w - 1, y, h, color);
}

void epd_draw_string(EpdFrameBuffer *fb, int x, int y, const char *str, uint8_t color, int scale) {
    if (!fb || !str || scale <= 0) return;
    int cursor_x = x;

    while (*str) {
        char c = *str++;
        if (c < 32 || c > 126) c = '?';
        const uint8_t *glyph = FONT_5X7[c - 32];

        for (int col = 0; col < 5; col++) {
            uint8_t line = glyph[col];
            for (int row = 0; row < 7; row++) {
                if (line & (1 << row)) {
                    if (scale == 1) {
                        epd_draw_pixel(fb, cursor_x + col, y + row, color);
                    } else {
                        epd_fill_rect(fb, cursor_x + col * scale, y + row * scale, scale, scale, color);
                    }
                }
            }
        }
        cursor_x += 6 * scale;
    }
}

bool epd_draw_barcode_itf(EpdFrameBuffer *fb, int x, int y, int h, const char *digits, int narrow_w, int wide_w) {
    if (!fb || !digits) return false;
    size_t len = strlen(digits);
    if (len % 2 != 0 || len == 0) return false;

    int cur_x = x;

    // Start pattern: narrow bar, narrow space, narrow bar, narrow space
    epd_fill_rect(fb, cur_x, y, narrow_w, h, EPD_COLOR_BLACK); cur_x += narrow_w;
    cur_x += narrow_w; // space
    epd_fill_rect(fb, cur_x, y, narrow_w, h, EPD_COLOR_BLACK); cur_x += narrow_w;
    cur_x += narrow_w; // space

    // Data pairs
    for (size_t pair = 0; pair < len; pair += 2) {
        int d1 = digits[pair] - '0';
        int d2 = digits[pair + 1] - '0';
        if (d1 < 0 || d1 > 9 || d2 < 0 || d2 > 9) return false;

        uint8_t p1 = ITF_PATTERNS[d1];
        uint8_t p2 = ITF_PATTERNS[d2];

        for (int bit = 4; bit >= 0; bit--) {
            int bar_w = (p1 & (1 << bit)) ? wide_w : narrow_w;
            int space_w = (p2 & (1 << bit)) ? wide_w : narrow_w;

            epd_fill_rect(fb, cur_x, y, bar_w, h, EPD_COLOR_BLACK);
            cur_x += bar_w;
            cur_x += space_w;
        }
    }

    // Stop pattern: wide bar, narrow space, narrow bar
    epd_fill_rect(fb, cur_x, y, wide_w, h, EPD_COLOR_BLACK); cur_x += wide_w;
    cur_x += narrow_w; // space
    epd_fill_rect(fb, cur_x, y, narrow_w, h, EPD_COLOR_BLACK); cur_x += narrow_w;

    return true;
}

void epd_render_baggage_tag(EpdFrameBuffer *fb, const SmartTagRecord *rec) {
    if (!fb || !rec) return;

    epd_buffer_clear(fb, EPD_COLOR_WHITE);

    // 1. Top Header Banner (0..50)
    epd_fill_rect(fb, 0, 0, EPD_WIDTH, 48, EPD_COLOR_BLACK);
    epd_draw_string(fb, 14, 8, "CATHAY PACIFIC", EPD_COLOR_WHITE, 2);
    epd_draw_string(fb, 14, 28, "SMARTTAG DIGITAL BAGGAGE", EPD_COLOR_WHITE, 1);

    // Flight & Route badges on right
    char flight_str[24];
    snprintf(flight_str, sizeof(flight_str), "%s", rec->flight);
    epd_draw_string(fb, 260, 6, flight_str, EPD_COLOR_WHITE, 3);

    char route_str[24];
    snprintf(route_str, sizeof(route_str), "%s -> %s", rec->from, rec->to);
    epd_draw_string(fb, 260, 32, route_str, EPD_COLOR_WHITE, 1);

    // 2. Baggage License Plate (54..105)
    epd_draw_string(fb, 14, 58, "BAGGAGE IDENTIFIER (IATA 10-DIGIT):", EPD_COLOR_BLACK, 1);
    epd_draw_string(fb, 14, 72, rec->bag_id, EPD_COLOR_BLACK, 4);

    char tag_str[32];
    snprintf(tag_str, sizeof(tag_str), "TAG ID: %s", rec->tag_id);
    epd_draw_string(fb, 260, 78, tag_str, EPD_COLOR_BLACK, 2);

    // Divider line
    epd_draw_fast_hline(fb, 14, 114, EPD_WIDTH - 28, EPD_COLOR_BLACK);
    epd_draw_fast_hline(fb, 14, 115, EPD_WIDTH - 28, EPD_COLOR_BLACK);

    // 3. IATA Barcode Section (122..215)
    // Draw 10-digit IATA barcode centered (w=340 approx)
    bool barcode_ok = epd_draw_barcode_itf(fb, 28, 124, 68, rec->bag_id, 2, 5);
    if (!barcode_ok) {
        epd_draw_string(fb, 80, 150, "[BARCODE ENCODING ERROR]", EPD_COLOR_BLACK, 2);
    }

    // Human readable spaced digits below barcode
    char spaced_digits[32];
    size_t b_len = strlen(rec->bag_id);
    size_t s_idx = 0;
    for (size_t i = 0; i < b_len && s_idx < sizeof(spaced_digits) - 2; i++) {
        spaced_digits[s_idx++] = rec->bag_id[i];
        spaced_digits[s_idx++] = ' ';
    }
    spaced_digits[s_idx] = '\0';
    epd_draw_string(fb, 90, 200, spaced_digits, EPD_COLOR_BLACK, 2);

    // Divider line
    epd_draw_fast_hline(fb, 14, 222, EPD_WIDTH - 28, EPD_COLOR_BLACK);

    // 4. Status Banner (228..290)
    char status_label[48];
    snprintf(status_label, sizeof(status_label), "STATUS: %s", rec->status);
    epd_fill_rect(fb, 14, 230, 240, 36, EPD_COLOR_BLACK);
    epd_draw_string(fb, 22, 240, status_label, EPD_COLOR_WHITE, 2);

    // Meta box: Rev & CRC
    char rev_str[32];
    snprintf(rev_str, sizeof(rev_str), "REV: %u", (unsigned int)rec->revision);
    epd_draw_string(fb, 270, 232, rev_str, EPD_COLOR_BLACK, 2);

    char crc_str[32];
    snprintf(crc_str, sizeof(crc_str), "CRC: %04X", rec->crc16);
    epd_draw_string(fb, 270, 252, crc_str, EPD_COLOR_BLACK, 1);

    // Bottom verification notice
    epd_draw_string(fb, 14, 278, "OFFLINE VERIFIED PASSIVE E-PAPER * NO BACKEND REQUIRED", EPD_COLOR_BLACK, 1);
}
