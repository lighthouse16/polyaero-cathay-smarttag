# PolyAero Cathay SmartTag — ESP32-C6 Hardware Wiring & Safety Guide

> [!CAUTION]
> **Breadboard Pin Verification Notice (`UNVERIFIED`)**:
> No physical ESP32-C6 board is attached to the build host, and existing firmware/pin definitions were not present in the repository. Consequently, the ESP32-C6 GPIO pin numbers listed below match the default build flags in `platformio.ini` and are marked **`UNVERIFIED`** for your physical breadboard prototype. **Inspect every jumper wire on your physical breadboard and update `platformio.ini` before flashing.**

---

## 1. Electrical & Logic-Level Safety Rules

1. **ESP32-C6 GPIOs Are Strictly 3.3V (NOT 5V-Tolerant)**  
   Absolute maximum GPIO input voltage on ESP32-C6 (`ESP32-C6-DEV-KIT-N16-M` / DevKitC-1 / DevKitM-1) is **3.6V**. Connecting a 5V logic output (`TX`, `SDA`, `MISO`, `BUSY`, `INT0`) directly to an ESP32-C6 GPIO risks permanent chip damage.

2. **Waveshare 4.2-inch E-Paper Module V2 (SSD1683, 400×300)**  
   - **Connect `VCC` to ESP32 `3V3` — DO NOT connect `VCC` to `5V`.**  
   - The Waveshare E-paper board has an onboard voltage translator (`TXS0108E` or equivalent). When `VCC` is connected to `3V3`, its `BUSY` output stays at safe 3.3V logic levels. Powering `VCC` with 5V raises `BUSY` to 5V.
   - E-paper retains its rendered airline baggage tag indefinitely without power, and draws peak current (~26mW typical) only during physical display refreshes. Respect the `BUSY` pin — never de-assert power or start a new SPI transfer while `BUSY` is HIGH (or active depending on panel revision; `GxEPD2` handles polling cleanly).

3. **Waveshare PN532 NFC HAT**  
   - Power `3.3V` rail via ESP32-C6 `3V3` (Raspberry Pi 40-pin Header Pin 1 or Pin 17) and `GND` (Pin 6 / 9). Verify onboard jumper headers (`5V`/`3.3V`) on your HAT revision with a multimeter so all data pins measure `<= 3.3V` before wiring to ESP32-C6.
   - Note: The PN532 RF field requires steady current (~100-150mA pulses while active). Use a reliable USB supply (`>= 5V 1A`) connected to the ESP32-C6 DevKit USB port.

---

## 2. Waveshare PN532 NFC HAT Mode Selection

Verify **both** the `[I1..I0]` jumper caps AND the 8-channel DIP switch (`SCK MISO MOSI NSS SCL SDA RX TX`) on the Waveshare PN532 NFC HAT match your selected transport mode:

| Mode | Firmware Flag | `[I1..I0]` Jumpers | 8-Pin DIP Switch (`SCK MISO MOSI NSS SCL SDA RX TX`) | Notes |
|---|---|---|---|---|
| **I2C (Recommended Default)** | `-D PN532_MODE_I2C=1` | `I0 = H`, `I1 = L` (`LH`) | `00001100` (Only `SCL`, `SDA` ON) | Zero SPI bus conflict with E-paper display. Requires `IRQ` (`INT0`) + `RSTPDN`. |
| **SPI (Shared Bus Option)** | `-D PN532_MODE_SPI=1` | `I0 = L`, `I1 = H` (`HL`) | `11110000` (`SCK`, `MISO`, `MOSI`, `NSS` ON) | Shares SPI clock/MOSI with E-paper; requires **separate** CS (`PIN_PN532_CS`) and tri-state verification. |
| **UART (HSU Option)** | `-D PN532_MODE_UART=1` | `I0 = L`, `I1 = L` (`LL`) | `00000011` (Only `RX`, `TX` ON) | Uses hardware `Serial1`; zero SPI/I2C contention. |

*(Reference: Official Waveshare PN532 NFC HAT Wiki specification.)*

---

## 3. GPIO Pin Mapping Table

### A. Waveshare 4.2" E-Paper Module V2 (SPI) -> ESP32-C6

| E-Paper Pin | Function | Voltage Level | ESP32-C6 GPIO (`platformio.ini`) | Status |
|---|---|---|---|---|
| `VCC` | Power Supply | `3.3V` (strict) | `3V3` | Required |
| `GND` | Common Ground | `0V` | `GND` | Required |
| `DIN` | SPI MOSI Data | `3.3V` | `GPIO 11` (`PIN_EPD_MOSI`) | `UNVERIFIED` |
| `CLK` | SPI Clock | `3.3V` | `GPIO 10` (`PIN_EPD_SCK`) | `UNVERIFIED` |
| `CS` | SPI Chip Select | `3.3V` | `GPIO 18` (`PIN_EPD_CS`) | `UNVERIFIED` |
| `DC` | Data/Command Control | `3.3V` | `GPIO 19` (`PIN_EPD_DC`) | `UNVERIFIED` |
| `RST` | Hardware Reset | `3.3V` | `GPIO 20` (`PIN_EPD_RST`) | `UNVERIFIED` |
| `BUSY` | Busy Status Output | `3.3V` | `GPIO 21` (`PIN_EPD_BUSY`) | `UNVERIFIED` |

### B. Waveshare PN532 NFC HAT (Default: I2C Mode `PN532_MODE_I2C=1`) -> ESP32-C6

*(Note: Verify ESP32-C6 strapping pins before relocating wires. Avoid pulling GPIO4, GPIO5, GPIO8, GPIO9, GPIO15 into wrong boot levels at reset!)*

| PN532 HAT Header Pin | Function | Voltage Level | ESP32-C6 GPIO (`platformio.ini`) | Status |
|---|---|---|---|---|
| `Pin 1` or `17` (`3.3V`) | Logic Power | `3.3V` | `3V3` | Required |
| `Pin 6` or `9` (`GND`) | Common Ground | `0V` | `GND` | Required |
| `SDA` (`Pin 3`, BCM2) | I2C Data | `3.3V` | `GPIO 6` (`PIN_PN532_SDA`) | `UNVERIFIED` |
| `SCL` (`Pin 5`, BCM3) | I2C Clock | `3.3V` | `GPIO 7` (`PIN_PN532_SCL`) | `UNVERIFIED` |
| `INT0` (`Pin 36`, BCM16 / J5) | PN532 Interrupt (Optional/Req) | `3.3V` | `GPIO 2` (`PIN_PN532_IRQ`) | `UNVERIFIED` |
| `RSTPDN` (`Pin 38`, BCM20 / J5) | Reset / Power-down | `3.3V` | `GPIO 3` (`PIN_PN532_RST`) | `UNVERIFIED` |

*Notes on PN532 HAT jumpers:* On the Waveshare PN532 NFC HAT, short `RSTPDN` to `D20` and `INT0` to `D16` (or wire direct breadboard jumpers from the HAT header pins marked `RSTPDN` / `INT0` to `GPIO 3` / `GPIO 2`).

### C. Alternative PN532 SPI Mode (`PN532_MODE_SPI=1`, if breadboard uses shared SPI)

If your prototype wires PN532 to the same SPI bus as the E-paper:
- `SCK` -> `GPIO 10` (Shared with E-paper `CLK`) — `UNVERIFIED`
- `MOSI` -> `GPIO 11` (Shared with E-paper `DIN`) — `UNVERIFIED`
- `MISO` -> `GPIO 1` (Connect only if using SPI) — `UNVERIFIED`
- `NSS` (`CS_PN532`) -> `GPIO 0` (Non-strapping GPIO; must remain independent of EPD CS) — `UNVERIFIED`
- `CS_EPD` (`GPIO 18`) and `CS_PN532` (`GPIO 0`) must remain **independent** chip-select lines, driven HIGH (deselected) when the other peripheral communicates.

---

## 4. Strapping Pin Precautions & Pre-Flash Backup on ESP32-C6

### A. Strapping Pins on ESP32-C6
Consult the official Espressif ESP32-C6 Datasheet before wiring or reassigning breadboard jumpers:
- **GPIO 4 (`MTMS`) & GPIO 5 (`MTDI`)**: JTAG / boot strapping pins. Default `platformio.ini` avoids these pins (`PIN_EPD_SCK=10`, `PIN_EPD_MOSI=11`). If your existing prototype already wired E-paper SCK/MOSI to GPIO4/5, verify boot reliability or update `platformio.ini`.
- **GPIO 8 (`LOG_PRINT`)**: Strapping pin. Avoid pull-down resistors on GPIO 8 at power-on reset.
- **GPIO 9 (`BOOT`)**: Chip boot mode (LOW = download boot mode, HIGH = SPI boot). The DevKit has an onboard pull-up and BOOT switch. Do not connect signals that hold GPIO 9 LOW during power-on.
- **GPIO 15 (`MTDO`)**: JTAG strapping pin.
- **GPIO 12, GPIO 13**: Dedicated USB-JTAG (`D-`, `D+`) on DevKit native USB port. Do **not** wire E-paper or PN532 to GPIO 12 or GPIO 13 if using the native USB port!

### B. Pre-Flash Firmware Backup (Recommended)
Before flashing the SmartTag firmware for the first time, back up any pre-existing factory firmware on your ESP32-C6 module using `esptool`:
```bash
# Back up full 16MB flash (or 8MB for 8MB modules) before overwriting:
python -m esptool --chip esp32c6 --port <COM_PORT> --baud 921600 read_flash 0 0x1000000 esp32c6_factory_backup.bin
```

---

## 5. Verification Checklist Before First Power-Up
1. **Multimeter Check**: Measure voltage across `3V3` and `GND` pins on the ESP32-C6 DevKit. Must read **3.3V ± 0.1V**.
2. **PN532 VCC & Logic Level**: Confirm PN532 HAT header Pin 1/17 is fed from **3.3V**, never 5V.
3. **EPD VCC**: Confirm Waveshare E-Paper `VCC` is connected to **3.3V**.
4. **PN532 Mode**: Confirm `[I1..I0]=LH` and DIP switch `00001100` (I2C) or `[I1..I0]=HL` and `11110000` (SPI).
