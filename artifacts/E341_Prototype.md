# E341 — PolyAero

## Prototype & Codebase

- **Public repository:** https://github.com/lighthouse16/polyaero-cathay-smarttag
- **Staff web portal:** https://cathay.haidangtrih.me
- **Fallback portal:** https://polyaero-staff-portal.vercel.app
- **Backend API documentation:** https://smarttag-demo-4pu4shawla-df.a.run.app/docs
- **Android APK release:** https://github.com/lighthouse16/polyaero-cathay-smarttag/releases/download/v1.0.0/CathaySmartTag-Release.apk
- **Release page:** https://github.com/lighthouse16/polyaero-cathay-smarttag/releases/tag/v1.0.0
- **Hardware source and setup:** https://github.com/lighthouse16/polyaero-cathay-smarttag/tree/main/apps/firmware/micropython-esp32c6
- **Hardware prototype photos:** https://github.com/lighthouse16/polyaero-cathay-smarttag/tree/main/docs/hardware

## Demo scope and limitations

Baggage Recovery Copilot combines a staff operations dashboard, a passenger mobile app, and an NFC/e-paper SmartTag prototype. See repository README for setup and current integration boundaries.

The physical prototype uses an externally powered ESP32-C6, PN532 NFC module, and Waveshare 4.2-inch e-paper display. It does not demonstrate passive NFC energy harvesting. Native NFC requires compatible Android hardware; web/demo simulation does not verify physical writes.

The APK release is a versioned build and does not automatically include later source fixes. Receipt/readback checks do not establish IATA certification, universal optical scanner compatibility, measured recovery improvement, or production security readiness. Physical regression checks remain necessary after firmware/app changes.

No public video download is included because the local recording is not tracked or published as a release asset. The AI demo depends on its configured upstream LLM service remaining available.
