# pytest configuration for MicroPython firmware tests
# This runs BEFORE any test collection - use pytest_configure hook

import sys
import builtins

# Mock MicroPython modules
class MockFrameBuffer:
    MONO_VLSB = 0
    MONO_HLSB = 1

    def __init__(self, buf, w, h, fmt):
        self.buf = buf
        self.w = w
        self.h = h
        self.fmt = fmt
        self._pixels = {}

    def fill(self, color):
        self._pixels.clear()

    def text(self, s, x, y, color):
        for i, ch in enumerate(s):
            self._pixels[(x + i * 8, y)] = color

    def pixel(self, x, y):
        return self._pixels.get((x, y), 0)


class MockPin:
    IN, OUT = 0, 1
    def __init__(self, pin, mode=None, value=None):
        self.pin = pin
        self.mode = mode
        self._value = value if value is not None else 0

    def value(self, v=None):
        if v is not None:
            self._value = 1 if v else 0
        return self._value


class MockSPI:
    def __init__(self, *args, **kwargs):
        pass
    def write(self, data):
        pass


class MockUART:
    def __init__(self, *args, **kwargs):
        self._buffer = bytearray()
    def any(self):
        return len(self._buffer)
    def read(self, n=1):
        if self._buffer:
            return bytes(self._buffer[:n])
        return b''
    def write(self, data):
        self._buffer.extend(data)


# Install mocks into sys.modules BEFORE any imports
sys.modules['framebuf'] = type('module', (), {'FrameBuffer': MockFrameBuffer, 'MONO_VLSB': 0, 'MONO_HLSB': 1})
sys.modules['machine'] = type('module', (), {'Pin': MockPin, 'SPI': MockSPI, 'UART': MockUART})
sys.modules['network'] = type('module', (), {'WLAN': type('WLAN', (), {'STA_IF': 0, 'active': lambda s: None, 'connect': lambda s,a,b: None, 'isconnected': lambda s: False, 'ifconfig': lambda s: ['0.0.0.0']})()})
sys.modules['ujson'] = __import__('json')
sys.modules['ubinascii'] = __import__('binascii')
sys.modules['urequests'] = type('module', (), {
    'post': lambda *a,**k: type('obj',(),{'status_code':200,'json':lambda:{"acknowledged":True,"display":{}},'close':lambda:None})(),
    'get': lambda *a,**k: type('obj',(),{'status_code':200,'json':lambda:{},'close':lambda:None})()
})

# Also install in builtins for good measure
builtins.framebuf = sys.modules['framebuf']
builtins.machine = sys.modules['machine']
builtins.network = sys.modules['network']
builtins.ujson = sys.modules['ujson']
builtins.ubinascii = sys.modules['ubinascii']
builtins.urequests = sys.modules['urequests']