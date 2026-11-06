# PolyAero SmartTag Hardware & Prototype Specification

## 1. Physical Device Specification

- **Form Factor**: Reusable luggage tag with reinforced aerospace-grade polymer casing.
- **Display**: 2.9-inch 3-color (Black / White / Red) electrophoretic E-ink display (296 x 128 resolution).
- **Controller & RF**: NXP NTAG I2C Plus or STMicroelectronics ST25DV dynamic NFC tag IC.
- **Power Subsystem**:
  - Passive RF energy harvesting from the passenger's smartphone during NFC tap.
  - Optional ultra-low power CR2032 coin cell for periodic BLE beaconing (6-month battery lifespan).

---

## 2. E-ink Screen Layout & Visual Data

```
┌────────────────────────────────────────────────────────┐
│ CX888                                              YVR │
│ ────────────────────────────────────────────────────── │
│ PASSENGER: CHAN/T            BAG TAG: 0160892012       │
│ WEIGHT:    22.4 KG           CLASS:   PRIORITY J       │
│ DATE:      10 NOV 2026       ROUTING: HKG -> YVR       │
│                                                        │
│ [ ||||||||||||||||||||||||||||||||||||||||||||||||| ]  │
│                   *0160892012*                         │
│                                                        │
│ SECURITY: #E3B0C442          E-INK STATUS: SYNCED      │
└────────────────────────────────────────────────────────┘
```

1. **Top Bar**: High-contrast flight number (`CX888`) and 3-letter IATA destination (`YVR`).
2. **Passenger & Itinerary Details**: Standard airline baggage tag fields.
3. **Machine-Readable Barcode**: High-density Code 128 barcode renderable by standard airport optical sort scanners.
4. **Security Digest**: SHA-256 truncated signature ensuring tag data cannot be spoofed by unauthorized NFC writers.

---

## 3. Communication Protocol

### A. Phase 0 Mock Simulation
- Implemented via `MockNfcService` in `@polyaero/shared`.
- Emulates 600-800ms NFC communication latency and tag memory persistence.

### B. Phase 1 Native Integration Plan
- Mobile app connects via `react-native-nfc-manager`.
- Writes compressed bitmap buffer and NDEF metadata payload during phone contact.
- Uses ISO 14443-A Transceive / APDU commands for vendor-specific E-ink controller update.
