# Portrait Graphics Engine (300x400 on 400x300 native e-paper)
# Coordinate mapping: Portrait (x,y) -> Native (y, 300-x-w)

import framebuf


class PortraitCanvas:
    WIDTH = 300
    HEIGHT = 400

    def __init__(self, epd):
        self.epd = epd
        self.fb = epd.image1Gray
        self.black = epd.black
        self.white = epd.white

        # Scratch buffer for text rendering (max 32 chars * 8px = 256px wide)
        self._scratch_buf = bytearray(256)
        self._scratch = framebuf.FrameBuffer(self._scratch_buf, 256, 8, framebuf.MONO_VLSB)

    # ---- Core drawing primitives with coordinate mapping ----

    def clear(self):
        self.fb.fill(self.white)

    def fill_rect(self, x, y, w, h, color):
        """Fill rectangle in portrait coords -> mapped to native"""
        if x < 0:
            w += x
            x = 0
        if y < 0:
            h += y
            y = 0
        if x + w > self.WIDTH:
            w = self.WIDTH - x
        if y + h > self.HEIGHT:
            h = self.HEIGHT - y
        if w <= 0 or h <= 0:
            return

        # Portrait (x,y,w,h) -> Native (nx, ny, nw, nh)
        # Native is 400 wide, 300 tall. Portrait origin top-left.
        # Mapping: native_x = y, native_y = WIDTH - x - w
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
        """Halftone pattern for side stripes"""
        for py in range(y, y + h, 2):
            offset = (py // 2) % 2
            for px in range(x + offset, x + w, 2):
                self.fill_rect(px, py, 1, 1, color)

    # ---- Text rendering ----

    def text(self, s, x, y, color, scale=1, bold=False):
        if not s:
            return
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
        """Text rotated 90° CCW (reads bottom-to-top)"""
        if not s:
            return
        s = str(s)[:16]
        w_px = len(s) * 8
        self._scratch.fill(0)
        self._scratch.text(s, 0, 0, 1)
        for py in range(8):
            for px in range(w_px):
                if self._scratch.pixel(px, py):
                    self.fill_rect(x + py * scale, y - (px + 1) * scale, scale, scale, color)

    # ---- Icons ----

    def draw_airplane_icon(self, x, y, color):
        """16x10 pixel airplane silhouette"""
        self.fill_rect(x + 2, y + 4, 12, 2, color)   # Fuselage
        self.fill_rect(x + 12, y + 3, 3, 2, color)   # Nose
        self.fill_rect(x + 6, y + 1, 3, 8, color)    # Main wings
        self.fill_rect(x + 1, y + 2, 2, 4, color)    # Tail fin