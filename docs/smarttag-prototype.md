# PolyAero SmartTag Hardware & Prototype Specification

## 1. Physical Device Architecture

- **Concept**: Reusable electronic baggage tag (EBT) engineered as a sustainable alternative to single-use thermal paper baggage tags.
- **Display**: 2.9-inch 3-color (Black / White / Red) or monochrome electrophoretic E-ink display (typically 296 x 128 pixels).
- **Power Subsystem**: Passive RF energy harvesting. The device operates battery-free, drawing power from the smartphone's NFC electromagnetic field during the tap/coupling event to refresh the bistable display.
- **Enclosure**: Custom 3D-printed impact-resistant housing with luggage strap loop.
- **Tag Identity**: Pre-programmed ISO 14443-A UID (7-byte factory identifier). Optional secondary NFC sticker or barcode tag for redundancy.

---

## 2. E-ink Display Data Layout

```
+--------------------------------------------------------+
| CX888                                              YVR |
| ------------------------------------------------------ |
| PASSENGER: CHAN/T            BAG TAG: 0160892012       |
| CLASS:     PRIORITY J        ROUTING: HKG -> YVR       |
| DATE:      10 NOV 2026       SCALE WT: 22.4 KG         |
|                                                        |
|   ||| || ||| | |||| ||| || | |||| ||| || ||| || |||    |
|                      0160892012                        |
|                                                        |
| STATUS: SYNCHRONIZED         FORMAT: INTERLEAVED 2/5   |
+--------------------------------------------------------+
```

1. **Top Bar**: High-contrast flight code (`CX888`) and 3-letter IATA destination (`YVR`).
2. **Passenger & Itinerary**: Passenger initials/surname, booking reference, and class.
3. **Weight Display**: Recorded by the check-in bag-drop scale and written to the display during check-in. The SmartTag has no built-in weighing sensors.
4. **Barcode Symbology**: The 10-digit IATA baggage license plate is represented as an Interleaved 2 of 5 (ITF) barcode. Note: Physical optical scanner read rates across varied baggage handling systems require verification with the physical prototype.

---

## 3. NFC Interaction & Security Model

### A. Separation of Concerns
1. **NFC UID**: Factory hardware identifier. Identifies the physical tag, but does not prove ownership of a booking.
2. **Baggage Identity (10-Digit IATA BSM License Plate)**: Assigned by the airline Departure Control System (DCS) upon booking/check-in.
3. **Backend Authorization**: The airline backend verifies passenger credentials before issuing an authorized provisioning payload.
4. **E-ink Buffer Transmission**: A 296x128 1-bit frame buffer is generated and transmitted via vendor-specific APDU commands / I2C bridge frames during the active RF touch.

### B. Implementation Status
- **Phase 0 (Current)**: `MockNfcService` provides deterministic emulation with scan latency, write buffer calculation, timeout handling, and cancellation hooks.
- **Phase 1 (Native Build)**: Integration with native NFC drivers via Expo Development Client and `react-native-nfc-manager` for physical device communication.
