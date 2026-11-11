#include "../src/smarttag_protocol.h"
#include "../src/display_renderer.h"
#include <stdio.h>
#include <string.h>
#include <assert.h>

void test_canonical_parsing_and_crc() {
    printf("[TEST] Canonical PA2 parsing and CRC16 CCITT\n");
    const char *vector = "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|D082";
    SmartTagRecord rec;
    SmartTagParseResult res = smarttag_parse_payload(vector, strlen(vector), &rec);

    assert(res == SMARTTAG_OK);
    assert(rec.version == 1);
    assert(strcmp(rec.tag_id, "ST-2048") == 0);
    assert(strcmp(rec.bag_id, "0160123456") == 0);
    assert(strcmp(rec.flight, "CX548") == 0);
    assert(strcmp(rec.from, "HKG") == 0);
    assert(strcmp(rec.to, "NRT") == 0);
    assert(strcmp(rec.status, "TAGGED") == 0);
    assert(rec.revision == 1);
    assert(rec.has_crc == true);
    assert(rec.crc16 == 0xD082);
    printf("  -> PASS: Matched TypeScript vector D082\n");
}

void test_corrupted_crc() {
    printf("[TEST] Corrupted CRC rejection\n");
    const char *corrupted = "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|FFFF";
    SmartTagRecord rec;
    SmartTagParseResult res = smarttag_parse_payload(corrupted, strlen(corrupted), &rec);
    assert(res == SMARTTAG_ERR_CRC_MISMATCH);
    printf("  -> PASS: CRC mismatch cleanly caught\n");
}

void test_version_validation() {
    printf("[TEST] Version validation\n");
    const char *bad_ver = "PA2|2|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1";
    SmartTagRecord rec;
    SmartTagParseResult res = smarttag_parse_payload(bad_ver, strlen(bad_ver), &rec);
    assert(res == SMARTTAG_ERR_VERSION);
    printf("  -> PASS: Unsupported version rejected\n");
}

void test_progression_evaluation() {
    printf("[TEST] Monotonic revision, duplicate suppression, and conflict handling\n");
    SmartTagRecord r1 = {1, "ST-2048", "0160123456", "CX548", "HKG", "NRT", "TAGGED", 1, 0, false};
    SmartTagRecord r1_conflict = {1, "ST-2048", "0160123456", "CX548", "HKG", "NRT", "LOADED", 1, 0, false};
    SmartTagRecord r2 = {1, "ST-2048", "0160123456", "CX548", "HKG", "NRT", "LOADED", 2, 0, false};
    SmartTagRecord r0 = {1, "ST-2048", "0160123456", "CX548", "HKG", "NRT", "TAGGED", 0, 0, false};

    assert(smarttag_evaluate_progression(&r1, NULL) == PROG_NEW_REVISION);
    assert(smarttag_evaluate_progression(&r1, &r1) == PROG_IDENTICAL);
    assert(smarttag_evaluate_progression(&r1_conflict, &r1) == PROG_STALE); // Equal rev conflicting payload is stale
    assert(smarttag_evaluate_progression(&r2, &r1) == PROG_NEW_REVISION);
    assert(smarttag_evaluate_progression(&r0, &r1) == PROG_STALE);
    printf("  -> PASS: Progression evaluation accurate\n");
}

void test_strict_iata_baggage_id() {
    printf("[TEST] Strict 10-digit IATA baggage ID enforcement\n");
    SmartTagRecord rec;

    // Leading zeros valid: 0000123456
    const char *v_zeros = "PA2|1|ST-2048|0000123456|CX548|HKG|NRT|TAGGED|1";
    assert(smarttag_parse_payload(v_zeros, strlen(v_zeros), &rec) == SMARTTAG_OK);
    assert(strcmp(rec.bag_id, "0000123456") == 0);

    // 9 digits: invalid
    const char *v_9 = "PA2|1|ST-2048|016012345|CX548|HKG|NRT|TAGGED|1";
    assert(smarttag_parse_payload(v_9, strlen(v_9), &rec) == SMARTTAG_ERR_FIELD_INVALID);

    // 11 digits: invalid
    const char *v_11 = "PA2|1|ST-2048|01601234567|CX548|HKG|NRT|TAGGED|1";
    assert(smarttag_parse_payload(v_11, strlen(v_11), &rec) == SMARTTAG_ERR_FIELD_INVALID);

    // Alphanumeric: invalid
    const char *v_alpha = "PA2|1|ST-2048|016012345A|CX548|HKG|NRT|TAGGED|1";
    assert(smarttag_parse_payload(v_alpha, strlen(v_alpha), &rec) == SMARTTAG_ERR_FIELD_INVALID);

    // Revision overflow: > 4294967295
    const char *v_overflow = "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|4294967296";
    assert(smarttag_parse_payload(v_overflow, strlen(v_overflow), &rec) == SMARTTAG_ERR_FIELD_INVALID);

    printf("  -> PASS: Strict IATA ID and revision overflow rejected\n");
}

void test_dynamic_tlv_estimation() {
    printf("[TEST] Dynamic TLV estimation helper\n");

    // Short TLV with leading 0x00: tag 0x03, length 59
    uint8_t header_short[16] = {0x00, 0x03, 59, 0x00};
    size_t est1 = smarttag_estimate_type2_total_bytes(header_short, sizeof(header_short));
    assert(est1 == 63); // 3 header bytes + 59 payload + 1 terminator

    // 3-byte extended TLV: tag 0x03, 0xFF, len 0x01, 0x00 (256 bytes)
    uint8_t header_ext[16] = {0x03, 0xFF, 0x01, 0x00};
    size_t est2 = smarttag_estimate_type2_total_bytes(header_ext, sizeof(header_ext));
    assert(est2 == 261); // 4 header bytes + 256 payload + 1 terminator

    // Empty or truncated header
    assert(smarttag_estimate_type2_total_bytes(NULL, 0) == 0);
    assert(smarttag_estimate_type2_total_bytes(header_short, 1) == 0);

    printf("  -> PASS: Dynamic TLV estimation accurate\n");
}

void test_legacy_pa1_support() {
    printf("[TEST] Legacy PA1 support\n");
    const char *legacy = "PA1|0160892012|HKG-NRT|RECOVERY_IN_PROGRESS|2026-11-10";
    SmartTagRecord rec;
    SmartTagParseResult res = smarttag_parse_payload(legacy, strlen(legacy), &rec);
    assert(res == SMARTTAG_OK);
    assert(strcmp(rec.bag_id, "0160892012") == 0);
    assert(strcmp(rec.from, "HKG") == 0);
    assert(strcmp(rec.to, "NRT") == 0);
    assert(strcmp(rec.status, "RECOVERY_IN_PROGRESS") == 0);
    printf("  -> PASS: Legacy PA1 parsed\n");
}

void test_display_rendering() {
    printf("[TEST] Display Renderer: 400x300 E-paper buffer and IATA barcode\n");
    EpdFrameBuffer fb;
    epd_buffer_init(&fb);

    SmartTagRecord rec = {1, "ST-2048", "0160123456", "CX548", "HKG", "NRT", "TAGGED", 1, 0xD082, true};
    epd_render_baggage_tag(&fb, &rec);

    // Verify buffer has black pixels in header (first row must be black)
    // 0 = Black, 1 = White
    assert(fb.buffer[0] == 0x00); // First byte in header is black
    assert(fb.width == 400);
    assert(fb.height == 300);

    // Test barcode generator for invalid length (odd number of digits)
    assert(epd_draw_barcode_itf(&fb, 10, 10, 20, "123", 1, 3) == false);
    // Valid 10-digit barcode
    assert(epd_draw_barcode_itf(&fb, 10, 10, 20, "0160123456", 1, 3) == true);
    printf("  -> PASS: 400x300 baggage tag and ITF barcode rendered into frame buffer\n");
}

void test_android_ndef_bytes_compatibility() {
    printf("[TEST] Android react-native-nfc-manager NDEF bytes -> ESP32 Type 2 TLV + NDEF Extractor\n");
    // Exact 59-byte NDEF message produced by Ndef.encodeMessage([Ndef.textRecord('PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|D082')])
    const uint8_t ndef_msg[59] = {
        209,   1,  55,  84,   2, 101, 110,  80,  65,  50, 124,  49,
        124,  83,  84,  45,  50,  48,  52,  56, 124,  48,  49,  54,
         48,  49,  50,  51,  52,  53,  54, 124,  67,  88,  53,  52,
         56, 124,  72,  75,  71, 124,  78,  82,  84, 124,  84,  65,
         71,  71,  69,  68, 124,  49, 124,  68,  48,  56,  50
    };

    // Simulate NTAG213 User Memory starting at Page 4 (with a dummy 0x00 NULL TLV + 0x03 NDEF TLV + 0xFE Terminator)
    uint8_t ntag_mem[64];
    ntag_mem[0] = 0x00; // NULL padding TLV
    ntag_mem[1] = 0x03; // NDEF Message TLV tag
    ntag_mem[2] = 59;   // Length
    memcpy(ntag_mem + 3, ndef_msg, 59);
    ntag_mem[62] = 0xFE; // Terminator TLV

    char extracted[140];
    size_t len = smarttag_extract_text_from_type2_tlv(ntag_mem, sizeof(ntag_mem), extracted, sizeof(extracted));
    assert(len == 52);
    assert(strcmp(extracted, "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|D082") == 0);

    SmartTagRecord rec;
    assert(smarttag_parse_payload(extracted, len, &rec) == SMARTTAG_OK);
    assert(strcmp(rec.bag_id, "0160123456") == 0);
    assert(rec.crc16 == 0xD082);

    // Oversized buffer check: small output buffer must return 0 (no silent truncation)
    char tiny_buf[16];
    assert(smarttag_extract_text_from_type2_tlv(ntag_mem, sizeof(ntag_mem), tiny_buf, sizeof(tiny_buf)) == 0);

    printf("  -> PASS: Android NDEF byte stream parsed end-to-end cleanly!\n");
}

int main() {
    printf("=== PolyAero SmartTag C++ Protocol Host Tests ===\n");
    test_canonical_parsing_and_crc();
    test_corrupted_crc();
    test_version_validation();
    test_progression_evaluation();
    test_strict_iata_baggage_id();
    test_dynamic_tlv_estimation();
    test_legacy_pa1_support();
    test_display_rendering();
    test_android_ndef_bytes_compatibility();
    printf("ALL 9 C++ PROTOCOL & DISPLAY TESTS PASSED!\n");
    return 0;
}
