#!/usr/bin/env python3
"""
Deploy MicroPython firmware to ESP32-C6 via mpremote.

Usage:
    python deploy.py [--port PORT] [--baud BAUD]

Requires:
    pip install mpremote
"""

import argparse
import subprocess
import sys
from pathlib import Path

FIRMWARE_DIR = Path(__file__).parent
FILES = [
    "main.py",
    "config.py",
    "graphics.py",
    "barcode.py",
    "layout.py",
    "nfc_handler.py",
    "pn532_uart.py",
    "epaper4in2.py",
]


def run_cmd(cmd, check=True):
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if check and result.returncode != 0:
        sys.exit(result.returncode)
    return result


def main():
    parser = argparse.ArgumentParser(description="Deploy MicroPython firmware to ESP32-C6")
    parser.add_argument("--port", default="auto", help="Serial port (default: auto-detect)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate")
    parser.add_argument("--reset", action="store_true", help="Soft reset after deploy")
    args = parser.parse_args()

    # Build mpremote command
    mpremote = ["mpremote"]
    if args.port != "auto":
        mpremote.extend(["connect", args.port])

    # Copy all files
    for f in FILES:
        src = FIRMWARE_DIR / f
        if not src.exists():
            print(f"Warning: {src} not found, skipping")
            continue
        run_cmd(mpremote + ["cp", str(src), f":{f}"])

    # Soft reset to run main.py
    if args.reset:
        run_cmd(mpremote + ["reset"])

    print("\n✓ Deployment complete")


if __name__ == "__main__":
    main()