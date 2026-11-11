#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Preferences.h>
#include <Adafruit_PN532.h>
#include <GxEPD2_BW.h>

#include "smarttag_protocol.h"
#include "display_renderer.h"

// =============================================================================
// PIN DEFINITIONS & MODES (Synchronized with platformio.ini & WIRING.md)
// Note: All breadboard jumper connections are UNVERIFIED on physical hardware.
// =============================================================================

#ifndef PN532_MODE_I2C
#define PN532_MODE_I2C 1
#endif

#ifndef PN532_MODE_SPI
#define PN532_MODE_SPI 0
#endif

#ifndef PN532_MODE_UART
#define PN532_MODE_UART 0
#endif

// PN532 I2C Pins (ESP32-C6)
#ifndef PIN_PN532_SDA
#define PIN_PN532_SDA 6
#endif
#ifndef PIN_PN532_SCL
#define PIN_PN532_SCL 7
#endif
#ifndef PIN_PN532_IRQ
#define PIN_PN532_IRQ 2
#endif
#ifndef PIN_PN532_RST
#define PIN_PN532_RST 3
#endif

// PN532 SPI / HSU Pins (ESP32-C6)
#ifndef PIN_PN532_CS
#define PIN_PN532_CS 0
#endif
#ifndef PIN_PN532_MISO
#define PIN_PN532_MISO 1
#endif

// Waveshare 4.2inch B/W E-Paper Pins (ESP32-C6, avoids strapping pins)
#ifndef PIN_EPD_CS
#define PIN_EPD_CS 18
#endif
#ifndef PIN_EPD_DC
#define PIN_EPD_DC 19
#endif
#ifndef PIN_EPD_RST
#define PIN_EPD_RST 20
#endif
#ifndef PIN_EPD_BUSY
#define PIN_EPD_BUSY 21
#endif
#ifndef PIN_EPD_SCK
#define PIN_EPD_SCK 10
#endif
#ifndef PIN_EPD_MOSI
#define PIN_EPD_MOSI 11
#endif

#ifndef SMARTTAG_FW_VERSION
#define SMARTTAG_FW_VERSION "2.0.0"
#endif

// =============================================================================
// HARDWARE INSTANCES
// =============================================================================

#if PN532_MODE_I2C
Adafruit_PN532 nfc(PIN_PN532_IRQ, PIN_PN532_RST);
#elif PN532_MODE_SPI
Adafruit_PN532 nfc(PIN_PN532_CS, &SPI);
#elif PN532_MODE_UART
Adafruit_PN532 nfc(PIN_PN532_RST, &Serial1);
#endif

// Waveshare 4.2" B/W display (400x300)
#ifdef EPD_WAVESHARE_420_V1
GxEPD2_BW<GxEPD2_420, GxEPD2_420::HEIGHT> display(
    GxEPD2_420(PIN_EPD_CS, PIN_EPD_DC, PIN_EPD_RST, PIN_EPD_BUSY)
);
#else
// Default: Waveshare 4.2" V2 (SSD1683 controller, GDEY042T81)
GxEPD2_BW<GxEPD2_420_GDEY042T81, GxEPD2_420_GDEY042T81::HEIGHT> display(
    GxEPD2_420_GDEY042T81(PIN_EPD_CS, PIN_EPD_DC, PIN_EPD_RST, PIN_EPD_BUSY)
);
#endif

// Global State
static Preferences s_prefs;
static EpdFrameBuffer s_epd_fb;
static SmartTagRecord s_last_record;
static bool s_has_last_record = false;
static bool s_pn532_ready = false;
static bool s_epd_ready = false;
static uint32_t s_idle_poll_cycles = 0;

// =============================================================================
// DISPLAY UPDATE ROUTINE
// =============================================================================

void epd_flush_to_screen() {
    if (!s_epd_ready) {
        Serial.println("[SMARTTAG-EPD] Display hardware not initialized, skipping SPI transfer.");
        return;
    }

    // Sanity check BUSY line before initiating full refresh
    if (digitalRead(PIN_EPD_BUSY) == HIGH) {
        Serial.println("[SMARTTAG-EPD] WARNING: EPD BUSY pin is HIGH before refresh; waiting briefly...");
        unsigned long wait_start = millis();
        while (digitalRead(PIN_EPD_BUSY) == HIGH && (millis() - wait_start < 5000)) {
            delay(10);
        }
        if (digitalRead(PIN_EPD_BUSY) == HIGH) {
            Serial.println("[SMARTTAG-EPD] ERROR: EPD BUSY timeout (>5s). Preserving NFC loop and skipping display flush.");
            return;
        }
    }

    Serial.println("[SMARTTAG-EPD] Transferring 400x300 frame buffer to E-paper...");
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        // EpdFrameBuffer encoding: 1 = white, 0 = black.
        for (int y = 0; y < EPD_HEIGHT; y++) {
            for (int x = 0; x < EPD_WIDTH; x++) {
                int byte_idx = (y * EPD_WIDTH + x) / 8;
                int bit_idx = 7 - (x % 8);
                bool is_white = (s_epd_fb.buffer[byte_idx] >> bit_idx) & 1;
                if (!is_white) {
                    display.drawPixel(x, y, GxEPD_BLACK);
                }
            }
        }
    } while (display.nextPage());

    display.powerOff();
    Serial.println("[SMARTTAG-EPD] E-Paper refresh complete. Display powered down to save energy.");
}

// =============================================================================
// NVS PERSISTENCE HELPERS
// =============================================================================

void nvs_save_record(const char *raw_payload, const SmartTagRecord *rec) {
    if (!s_prefs.begin("smarttag", false)) {
        Serial.println("[SMARTTAG-NVS] ERROR: Failed to open NVS namespace 'smarttag' for write.");
        return;
    }
    s_prefs.putString("payload", raw_payload);
    s_prefs.putUInt("revision", rec->revision);
    s_prefs.putString("tag_id", rec->tag_id);
    s_prefs.putString("bag_id", rec->bag_id);
    s_prefs.putString("flight", rec->flight);
    s_prefs.end();
    Serial.printf("[SMARTTAG-NVS] Persisted state to NVS: Tag=%s Bag=%s Rev=%lu\n",
                  rec->tag_id, rec->bag_id, (unsigned long)rec->revision);
}

bool nvs_load_record(SmartTagRecord *out_rec) {
    if (!s_prefs.begin("smarttag", true)) {
        Serial.println("[SMARTTAG-NVS] No 'smarttag' NVS namespace found.");
        return false;
    }

    String payload = s_prefs.getString("payload", "");
    s_prefs.end();

    if (payload.length() == 0) {
        Serial.println("[SMARTTAG-NVS] No prior baggage payload stored in NVS.");
        return false;
    }

    SmartTagParseResult res = smarttag_parse_payload(payload.c_str(), payload.length(), out_rec);
    if (res != SMARTTAG_OK) {
        Serial.printf("[SMARTTAG-NVS] Stored payload failed validation (%s): %s\n",
                      smarttag_error_string(res), payload.c_str());
        return false;
    }

    Serial.printf("[SMARTTAG-NVS] Restored valid baggage state from NVS: Tag=%s Bag=%s Flight=%s Rev=%lu\n",
                  out_rec->tag_id, out_rec->bag_id, out_rec->flight, (unsigned long)out_rec->revision);
    return true;
}

// =============================================================================
// SETUP
// =============================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("=============================================================");
    Serial.printf("  Cathay SmartTag NFC-to-E-Paper Gateway (ESP32-C6) v%s\n", SMARTTAG_FW_VERSION);
    Serial.println("  PolyAero Aviation Architecture — Protocol PA2 (CRC-16)");
    Serial.println("=============================================================");

#if PN532_MODE_I2C
    Serial.printf("[SMARTTAG-CFG] PN532 Interface: I2C (SDA=%d, SCL=%d, IRQ=%d, RST=%d)\n",
                  PIN_PN532_SDA, PIN_PN532_SCL, PIN_PN532_IRQ, PIN_PN532_RST);
#elif PN532_MODE_SPI
    Serial.printf("[SMARTTAG-CFG] PN532 Interface: SPI (NSS=%d, SCK=%d, MOSI=%d, MISO=%d, RST=%d)\n",
                  PIN_PN532_CS, PIN_EPD_SCK, PIN_EPD_MOSI, PIN_PN532_MISO, PIN_PN532_RST);
#elif PN532_MODE_UART
    Serial.printf("[SMARTTAG-CFG] PN532 Interface: UART Serial1 (RST=%d)\n", PIN_PN532_RST);
#endif
    Serial.printf("[SMARTTAG-CFG] E-Paper Interface: SPI (CS=%d, DC=%d, RST=%d, BUSY=%d, SCK=%d, MOSI=%d)\n",
                  PIN_EPD_CS, PIN_EPD_DC, PIN_EPD_RST, PIN_EPD_BUSY, PIN_EPD_SCK, PIN_EPD_MOSI);
    Serial.println("[SMARTTAG-CFG] WARNING: All breadboard pin mappings UNVERIFIED on physical hardware.");
    Serial.println("[SMARTTAG-CFG] 3.3V Logic Safety: ESP32-C6 GPIOs accept 3.6V max. Power EPD at 3.3V VCC.");

    // 1. Initialize Framebuffer
    epd_buffer_init(&s_epd_fb);

    // 2. Initialize SPI & E-Paper hardware
    Serial.println("[SMARTTAG-EPD] Configuring ESP32-C6 SPI bus and Waveshare 4.2\" E-paper display...");
#if PN532_MODE_SPI
    SPI.begin(PIN_EPD_SCK, PIN_PN532_MISO, PIN_EPD_MOSI, -1);
#else
    SPI.begin(PIN_EPD_SCK, -1, PIN_EPD_MOSI, PIN_EPD_CS);
#endif
    display.init(115200, true, 2, false);
    s_epd_ready = true;
    Serial.println("[SMARTTAG-EPD] Display initialized.");

    // 3. Restore last stored state from NVS if available
    if (nvs_load_record(&s_last_record)) {
        s_has_last_record = true;
        Serial.println("[SMARTTAG-EPD] Restoring cached baggage tag from NVS cold-boot...");
        epd_render_baggage_tag(&s_epd_fb, &s_last_record);
        epd_flush_to_screen();
    } else {
        Serial.println("[SMARTTAG-EPD] No prior state. Rendering standby prompt...");
        epd_buffer_clear(&s_epd_fb, EPD_COLOR_WHITE);
        epd_draw_rect(&s_epd_fb, 10, 10, EPD_WIDTH - 20, EPD_HEIGHT - 20, EPD_COLOR_BLACK);
        epd_draw_string(&s_epd_fb, 40, 60, "CATHAY SMARTTAG", EPD_COLOR_BLACK, 3);
        epd_draw_string(&s_epd_fb, 40, 120, "READY FOR NFC PAIRING", EPD_COLOR_BLACK, 2);
        epd_draw_string(&s_epd_fb, 40, 170, "Tap phone or NTAG213 tag", EPD_COLOR_BLACK, 2);
        epd_draw_string(&s_epd_fb, 40, 220, "to assign baggage label", EPD_COLOR_BLACK, 2);
        epd_flush_to_screen();
    }

    // 4. Initialize PN532
#if PN532_MODE_I2C
    Wire.begin(PIN_PN532_SDA, PIN_PN532_SCL);
#elif PN532_MODE_UART
    Serial1.begin(115200);
#endif
    nfc.begin();

    uint32_t versiondata = nfc.getFirmwareVersion();
    if (!versiondata) {
        Serial.println("[SMARTTAG-PN532] ERROR: Didn't find PN53x board! Check wiring and DIP switches.");
        s_pn532_ready = false;
    } else {
        Serial.printf("[SMARTTAG-PN532] Found chip PN5%02lX, Firmware ver. %lu.%lu\n",
                      (unsigned long)((versiondata >> 24) & 0xFF),
                      (unsigned long)((versiondata >> 16) & 0xFF),
                      (unsigned long)((versiondata >> 8) & 0xFF));
        nfc.SAMConfig();
        s_pn532_ready = true;
        Serial.println("[SMARTTAG-PN532] SAM configured. Listening for ISO14443A NFC targets...");
    }
}

// =============================================================================
// MAIN LOOP
// =============================================================================

void loop() {
    if (!s_pn532_ready) {
        Serial.println("[SMARTTAG-PN532] PN532 not ready. Resetting bus and retrying in 3 seconds...");
        delay(3000);
#if PN532_MODE_I2C
        Wire.end();
        delay(50);
        Wire.begin(PIN_PN532_SDA, PIN_PN532_SCL);
#elif PN532_MODE_UART
        Serial1.begin(115200);
#endif
        nfc.begin();
        uint32_t v = nfc.getFirmwareVersion();
        if (v) {
            nfc.SAMConfig();
            s_pn532_ready = true;
            s_idle_poll_cycles = 0;
            Serial.println("[SMARTTAG-PN532] Re-connection successful!");
        }
        return;
    }

    uint8_t uid[7];
    uint8_t uid_len = 0;

    bool detected = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uid_len, 250);

    if (!detected) {
        s_idle_poll_cycles++;
        // Periodic health check every ~120 idle cycles (~40 seconds) to recover from loose jumper wires
        if (s_idle_poll_cycles >= 120) {
            s_idle_poll_cycles = 0;
            if (!nfc.getFirmwareVersion()) {
                Serial.println("[SMARTTAG-PN532] Health check failed! Marking PN532 offline for recovery...");
                s_pn532_ready = false;
                return;
            }
        }
        delay(100);
        return;
    }
    s_idle_poll_cycles = 0;

    Serial.printf("\n[SMARTTAG-NFC] Target detected! UID Length: %u bytes, UID: ", (unsigned int)uid_len);
    for (uint8_t i = 0; i < uid_len; i++) {
        Serial.printf("%02X", uid[i]);
    }
    Serial.println();

    if (uid_len == 4) {
        Serial.println("[SMARTTAG-NFC] NOTE: 4-byte UID detected (likely MIFARE Classic 1K / Blue Fob).");
        Serial.println("[SMARTTAG-NFC] MIFARE Classic requires proprietary Crypto-1 keys and has no standard NDEF.");
        Serial.println("[SMARTTAG-NFC] Recommendation: Use standard NFC Forum Type 2 tag (NTAG213/215/216) or phone HCE.");
    }

    // Dynamic Type 2 Tag reading (NTAG213 / 215 / 216)
    // Buffer sized up to 256 bytes (64 pages) to handle standard NTAG213..216 capacities
    uint8_t user_memory[256];
    memset(user_memory, 0, sizeof(user_memory));
    bool read_ok = true;

    // Phase 1: Read initial 16 bytes (Pages 4 through 7) to parse NDEF TLV header
    for (uint8_t page = 4; page <= 7; page++) {
        uint8_t page_buf[4];
        if (!nfc.ntag2xx_ReadPage(page, page_buf)) {
            read_ok = false;
            Serial.printf("[SMARTTAG-NFC] Phase 1 Page %u read failed.\n", (unsigned int)page);
            break;
        }
        memcpy(user_memory + ((page - 4) * 4), page_buf, 4);
    }

    if (!read_ok) {
        Serial.println("[SMARTTAG-NFC] Failed to read initial NTAG pages. Tag removed early or unsupported card.");
        delay(1000);
        return;
    }

    // Estimate total bytes needed based on TLV header
    size_t est_bytes = smarttag_estimate_type2_total_bytes(user_memory, 16);
    uint8_t total_pages = 4; // Already read Pages 4..7 (4 pages)

    if (est_bytes > 0) {
        if (est_bytes > sizeof(user_memory)) {
            est_bytes = sizeof(user_memory);
        }
        total_pages = (uint8_t)((est_bytes + 3) / 4);
        if (total_pages < 4) total_pages = 4;
        if (total_pages > (sizeof(user_memory) / 4)) {
            total_pages = (uint8_t)(sizeof(user_memory) / 4);
        }
        Serial.printf("[SMARTTAG-NFC] Dynamic TLV detected: %u bytes needed (%u pages total).\n",
                      (unsigned int)est_bytes, (unsigned int)total_pages);
    } else if (user_memory[0] == 'P' && user_memory[1] == 'A') {
        // Raw ASCII PA payload starting directly at page 4: read up to 24 pages (96 bytes)
        total_pages = 24;
        Serial.println("[SMARTTAG-NFC] Raw ASCII PA header detected at Page 4.");
    } else {
        // Fallback default: read standard NTAG213 user memory (36 pages = 144 bytes)
        total_pages = 36;
    }

    // Phase 2: Read remaining required pages
    for (uint8_t page = 8; page < 4 + total_pages; page++) {
        uint8_t page_buf[4];
        if (!nfc.ntag2xx_ReadPage(page, page_buf)) {
            read_ok = false;
            Serial.printf("[SMARTTAG-NFC] Phase 2 Page %u read failed.\n", (unsigned int)page);
            break;
        }
        memcpy(user_memory + ((page - 4) * 4), page_buf, 4);
    }

    if (!read_ok) {
        Serial.println("[SMARTTAG-NFC] Failed to complete tag reading. Tag removed mid-read.");
        delay(1000);
        return;
    }

    // Extract text payload from NDEF TLV
    char payload_text[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    memset(payload_text, 0, sizeof(payload_text));

    size_t actual_mem_len = (size_t)total_pages * 4;
    size_t extracted_len = smarttag_extract_text_from_type2_tlv(
        user_memory, actual_mem_len, payload_text, sizeof(payload_text)
    );

    if (extracted_len == 0) {
        // Fallback: check if raw text starts at page 4 (first bytes ASCII "PA")
        if (user_memory[0] == 'P' && user_memory[1] == 'A') {
            size_t rlen = 0;
            while (rlen < sizeof(payload_text) - 1 && user_memory[rlen] >= 0x20 && user_memory[rlen] <= 0x7E) {
                payload_text[rlen] = (char)user_memory[rlen];
                rlen++;
            }
            payload_text[rlen] = '\0';
            extracted_len = rlen;
            Serial.printf("[SMARTTAG-NFC] Detected raw ASCII payload (bypassed TLV): %s\n", payload_text);
        }
    }

    if (extracted_len == 0) {
        Serial.println("[SMARTTAG-NFC] No valid NDEF Text or PA payload found in tag user memory.");
        delay(1000);
        return;
    }

    Serial.printf("[SMARTTAG-NFC] Extracted payload (%u bytes): %s\n",
                  (unsigned int)extracted_len, payload_text);

    // Parse and validate payload
    SmartTagRecord new_rec;
    SmartTagParseResult parse_res = smarttag_parse_payload(payload_text, extracted_len, &new_rec);

    if (parse_res != SMARTTAG_OK) {
        Serial.printf("[SMARTTAG-NFC] REJECTED: Payload invalid: %s (code %d)\n",
                      smarttag_error_string(parse_res), (int)parse_res);
        Serial.println("[SMARTTAG-EPD] Ignoring corrupt/invalid payload. Display preserved.");
        delay(1500);
        return;
    }

    // RF CRC-16 enforcement: PA2 records received over RF must carry valid CRC
    if (strncmp(payload_text, "PA2|", 4) == 0 && !new_rec.has_crc) {
        Serial.println("[SMARTTAG-NFC] REJECTED: Protocol PA2 requires 4-hex CRC-16 checksum over RF.");
        delay(1500);
        return;
    }

    // Check revision progression
    SmartTagProgression prog = smarttag_evaluate_progression(
        &new_rec, s_has_last_record ? &s_last_record : NULL
    );

    if (prog == PROG_IDENTICAL) {
        Serial.printf("[SMARTTAG-NFC] IGNORED: Duplicate payload already displayed (revision %lu). No refresh needed.\n",
                      (unsigned long)new_rec.revision);
        delay(1500);
        return;
    }

    if (prog == PROG_STALE) {
        Serial.printf("[SMARTTAG-NFC] REJECTED: Stale revision %lu <= displayed revision %lu. Ignoring.\n",
                      (unsigned long)new_rec.revision, (unsigned long)s_last_record.revision);
        delay(1500);
        return;
    }

    // New revision accepted!
    Serial.printf("[SMARTTAG-NFC] ACCEPTED: New baggage payload received! Revision %lu (was %lu)\n",
                  (unsigned long)new_rec.revision, (unsigned long)(s_has_last_record ? s_last_record.revision : 0));
    Serial.printf("[SMARTTAG-NFC] Tag: %s | Bag: %s | Flight: %s | %s -> %s | Status: %s\n",
                  new_rec.tag_id, new_rec.bag_id, new_rec.flight, new_rec.from, new_rec.to, new_rec.status);

    // Save to NVS
    nvs_save_record(payload_text, &new_rec);

    // Update memory state
    s_last_record = new_rec;
    s_has_last_record = true;

    // Render new tag to framebuffer
    Serial.println("[SMARTTAG-EPD] Rendering baggage tag layout to framebuffer...");
    epd_render_baggage_tag(&s_epd_fb, &s_last_record);

    // Refresh E-Paper
    epd_flush_to_screen();
    Serial.println("[SMARTTAG-EPD] E-Paper update cycle complete.");

    // Pause before next detection to avoid rapid re-triggers
    delay(2000);
}
