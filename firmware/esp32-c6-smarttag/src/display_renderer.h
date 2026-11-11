#ifndef DISPLAY_RENDERER_H
#define DISPLAY_RENDERER_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "smarttag_protocol.h"

#ifdef __cplusplus
extern "C" {
#endif

#define EPD_WIDTH  400
#define EPD_HEIGHT 300
#define EPD_BUFFER_SIZE ((EPD_WIDTH * EPD_HEIGHT) / 8)

// 1-bit color definitions (Waveshare SSD1683: 1 = White, 0 = Black)
#define EPD_COLOR_BLACK 0
#define EPD_COLOR_WHITE 1

/**
 * Portable 1-bit monochrome frame buffer for 400x300 E-paper.
 */
typedef struct {
    uint8_t buffer[EPD_BUFFER_SIZE];
    uint16_t width;
    uint16_t height;
} EpdFrameBuffer;

void epd_buffer_init(EpdFrameBuffer *fb);
void epd_buffer_clear(EpdFrameBuffer *fb, uint8_t color);
void epd_draw_pixel(EpdFrameBuffer *fb, int x, int y, uint8_t color);
void epd_draw_fast_hline(EpdFrameBuffer *fb, int x, int y, int w, uint8_t color);
void epd_draw_fast_vline(EpdFrameBuffer *fb, int x, int y, int h, uint8_t color);
void epd_fill_rect(EpdFrameBuffer *fb, int x, int y, int w, int h, uint8_t color);
void epd_draw_rect(EpdFrameBuffer *fb, int x, int y, int w, int h, uint8_t color);

/**
 * Draws simple 5x7 bitmap font string scaled by `scale`.
 */
void epd_draw_string(EpdFrameBuffer *fb, int x, int y, const char *str, uint8_t color, int scale);

/**
 * Renders standard IATA Interleaved 2 of 5 barcode for numeric string.
 */
bool epd_draw_barcode_itf(EpdFrameBuffer *fb, int x, int y, int h, const char *digits, int narrow_w, int wide_w);

/**
 * Renders complete Cathay SmartTag baggage label (400x300) from record.
 */
void epd_render_baggage_tag(EpdFrameBuffer *fb, const SmartTagRecord *rec);

#ifdef __cplusplus
}
#endif

#endif // DISPLAY_RENDERER_H
