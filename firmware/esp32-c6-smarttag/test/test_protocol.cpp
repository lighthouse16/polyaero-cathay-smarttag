#include "../src/smarttag_protocol.h"
#include "../src/display_renderer.h"
#include "../src/smarttag_transaction.h"
#include <stdio.h>
#include <string.h>
#include <assert.h>

// =============================================================================
// EXISTING PROTOCOL & DISPLAY TESTS
// =============================================================================

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
    assert(fb.buffer[0] == 0x00);
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
    const uint8_t ndef_msg[59] = {
        209,   1,  55,  84,   2, 101, 110,  80,  65,  50, 124,  49,
        124,  83,  84,  45,  50,  48,  52,  56, 124,  48,  49,  54,
         48,  49,  50,  51,  52,  53,  54, 124,  67,  88,  53,  52,
         56, 124,  72,  75,  71, 124,  78,  82,  84, 124,  84,  65,
         71,  71,  69,  68, 124,  49, 124,  68,  48,  56,  50
    };

    uint8_t ntag_mem[64];
    ntag_mem[0] = 0x00;
    ntag_mem[1] = 0x03;
    ntag_mem[2] = 59;
    memcpy(ntag_mem + 3, ndef_msg, 59);
    ntag_mem[62] = 0xFE;

    char extracted[140];
    size_t len = smarttag_extract_text_from_type2_tlv(ntag_mem, sizeof(ntag_mem), extracted, sizeof(extracted));
    assert(len == 52);
    assert(strcmp(extracted, "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|D082") == 0);

    SmartTagRecord rec;
    assert(smarttag_parse_payload(extracted, len, &rec) == SMARTTAG_OK);
    assert(strcmp(rec.bag_id, "0160123456") == 0);
    assert(rec.crc16 == 0xD082);

    char tiny_buf[16];
    assert(smarttag_extract_text_from_type2_tlv(ntag_mem, sizeof(ntag_mem), tiny_buf, sizeof(tiny_buf)) == 0);

    printf("  -> PASS: Android NDEF byte stream parsed end-to-end cleanly!\n");
}

// =============================================================================
// GRANULAR MOCK HARDWARE & NVS STORAGE HARNESS
// =============================================================================

typedef struct {
    // Hardware display mock
    EpdRefreshResult next_refresh_result;
    int refresh_call_count;
    SmartTagRecord last_refreshed_record;

    // Granular NVS key-value backing store (models ESP32 Preferences namespace)
    bool nvs_has_payload;
    char nvs_payload[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    bool nvs_has_p_payload;
    char nvs_p_payload[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    bool nvs_has_tx_state;
    uint8_t nvs_tx_state;
    uint32_t nvs_revision;
    char nvs_tag_id[17];
    char nvs_bag_id[17];
    char nvs_flight[10];

    // Individual fault-injection flags per NVS write operation
    bool fail_nvs_open;
    bool fail_p_payload_write;
    bool fail_pending_tx_state_write;
    bool fail_committed_payload_write;
    bool fail_committed_metadata_write;
    bool fail_committed_tx_state_write;
    bool simulate_power_loss_after_committed_payload;

    // Audit counters (tracking actual flash writes to detect wear/retries)
    int persist_call_count;
    int p_payload_write_count;
    int payload_write_count;
    int tx_state_write_count;
} MockNvsContext;

static EpdRefreshResult mock_refresh_fn(const SmartTagRecord *rec, void *user_ctx) {
    MockNvsContext *hw = (MockNvsContext*)user_ctx;
    hw->refresh_call_count++;
    if (rec) hw->last_refreshed_record = *rec;
    return hw->next_refresh_result;
}

static bool mock_persist_fn(
    SmartTagTxState state,
    const SmartTagRecord *rec,
    const char *raw_payload,
    void *user_ctx
) {
    MockNvsContext *hw = (MockNvsContext*)user_ctx;
    hw->persist_call_count++;

    if (hw->fail_nvs_open) {
        return false;
    }

    if (state == TX_STATE_PENDING) {
        if (!raw_payload || raw_payload[0] == '\0') return false;
        if (hw->fail_p_payload_write) {
            return false;
        }
        strncpy(hw->nvs_p_payload, raw_payload, SMARTTAG_MAX_PAYLOAD_LEN);
        hw->nvs_p_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
        hw->nvs_has_p_payload = true;
        hw->p_payload_write_count++;

        if (hw->fail_pending_tx_state_write) {
            // Mirror main.cpp rollback: clean up orphaned p_payload if marker fails
            hw->nvs_has_p_payload = false;
            hw->nvs_p_payload[0] = '\0';
            return false;
        }
        hw->nvs_tx_state = (uint8_t)TX_STATE_PENDING;
        hw->nvs_has_tx_state = true;
        hw->tx_state_write_count++;
        return true;
    }

    if (state == TX_STATE_COMMITTED) {
        if (!raw_payload || raw_payload[0] == '\0' || !rec) return false;

        if (!hw->nvs_has_payload || strcmp(hw->nvs_payload, raw_payload) != 0) {
            if (hw->fail_committed_payload_write) {
                return false;
            }
            strncpy(hw->nvs_payload, raw_payload, SMARTTAG_MAX_PAYLOAD_LEN);
            hw->nvs_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
            hw->nvs_has_payload = true;
            hw->payload_write_count++;

            if (hw->simulate_power_loss_after_committed_payload) {
                // Simulate brownout right after overwriting "payload" but before "tx_state"
                return false;
            }

            if (hw->fail_committed_metadata_write) {
                return false;
            }
            hw->nvs_revision = rec->revision;
            strncpy(hw->nvs_tag_id, rec->tag_id, sizeof(hw->nvs_tag_id) - 1);
            hw->nvs_tag_id[sizeof(hw->nvs_tag_id) - 1] = '\0';
            strncpy(hw->nvs_bag_id, rec->bag_id, sizeof(hw->nvs_bag_id) - 1);
            hw->nvs_bag_id[sizeof(hw->nvs_bag_id) - 1] = '\0';
            strncpy(hw->nvs_flight, rec->flight, sizeof(hw->nvs_flight) - 1);
            hw->nvs_flight[sizeof(hw->nvs_flight) - 1] = '\0';
        }

        if (hw->fail_committed_tx_state_write) {
            return false;
        }
        if (!hw->nvs_has_tx_state || hw->nvs_tx_state != (uint8_t)TX_STATE_COMMITTED) {
            hw->nvs_tx_state = (uint8_t)TX_STATE_COMMITTED;
            hw->nvs_has_tx_state = true;
            hw->tx_state_write_count++;
        }

        hw->nvs_has_p_payload = false;
        hw->nvs_p_payload[0] = '\0';
        return true;
    }

    if (state == TX_STATE_IDLE) {
        if (hw->fail_pending_tx_state_write) {
            return false;
        }
        if (!hw->nvs_has_tx_state || hw->nvs_tx_state != (uint8_t)TX_STATE_IDLE) {
            hw->nvs_tx_state = (uint8_t)TX_STATE_IDLE;
            hw->nvs_has_tx_state = true;
            hw->tx_state_write_count++;
        }
        hw->nvs_has_p_payload = false;
        hw->nvs_p_payload[0] = '\0';
        return true;
    }

    return false;
}

static void make_pa2_payload(char *buf, size_t max_len, const char *status, uint32_t rev) {
    char prefix[SMARTTAG_MAX_PAYLOAD_LEN];
    snprintf(prefix, sizeof(prefix), "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|%s|%lu",
             status, (unsigned long)rev);
    uint16_t crc = smarttag_crc16_ccitt(prefix, strlen(prefix));
    snprintf(buf, max_len, "%s|%04X", prefix, crc);
}

// =============================================================================
// TRANSACTION INTEGRITY REGRESSION TESTS (P3 — 10 COMPREHENSIVE SCENARIOS)
// =============================================================================

// Scenario 1: Failure when writing p_payload during PENDING staging (Aborts before refresh)
void test_tx_scenario_1_failure_writing_p_payload() {
    printf("[TEST TX 1] Failure writing p_payload during staging -> Aborts before refresh\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    // Initial valid state: Rev 1 COMMITTED
    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    SmartTagTxResult r1 = smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(r1 == TX_RESULT_COMMITTED);
    assert(hw.refresh_call_count == 1);
    assert(coord.committed_record.revision == 1);

    // Attempt Rev 2 when p_payload write fails (e.g. NVS sector failure)
    hw.fail_p_payload_write = true;
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    EpdRefreshResult ref_res = EPD_REFRESH_NOT_INITIALIZED;
    SmartTagTxResult r2 = smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, &ref_res);

    assert(r2 == TX_RESULT_PERSISTENCE_FAILED);
    assert(hw.refresh_call_count == 1); // CRITICAL: refresh MUST NOT be attempted!
    assert(coord.committed_record.revision == 1); // Committed RAM state MUST stay Rev 1!
    assert(coord.has_pending_record == false);
    assert(coord.tx_state == TX_STATE_COMMITTED);
    assert(hw.nvs_has_p_payload == false);
    assert(strcmp(hw.nvs_payload, p1) == 0); // Authoritative committed payload untouched!
    printf("  -> PASS: Staging aborted cleanly; zero display refresh; Rev 1 preserved\n");
}

// Scenario 2: Failure when writing tx_state during PENDING staging (Rolls back partial staging)
void test_tx_scenario_2_failure_writing_tx_state() {
    printf("[TEST TX 2] Failure writing tx_state during staging -> Rollback cleans up p_payload\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(hw.refresh_call_count == 1);

    // Fail marker write during Rev 2 staging
    hw.fail_pending_tx_state_write = true;
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    SmartTagTxResult r2 = smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    assert(r2 == TX_RESULT_PERSISTENCE_FAILED);
    assert(hw.refresh_call_count == 1); // Refresh not called!
    assert(hw.nvs_has_p_payload == false); // Partial p_payload was rolled back!
    assert(coord.committed_record.revision == 1);
    printf("  -> PASS: Marker write failure cleaned up p_payload and aborted before display\n");
}

// Scenario 3: Partial PENDING persistence recovery on boot
void test_tx_scenario_3_partial_pending_persistence_recovery() {
    printf("[TEST TX 3] Partial PENDING persistence recovery on boot\n");

    // Case 3A: tx_state was COMMITTED (Rev 1), but an orphaned p_payload existed from interrupted staging
    {
        SmartTagTxCoordinator coord;
        smarttag_tx_init(&coord);
        MockNvsContext hw;
        memset(&hw, 0, sizeof(hw));

        char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
        char p2_partial[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p2_partial, sizeof(p2_partial), "LOADED", 2);

        bool did_refresh = true;
        bool rec = smarttag_tx_recover_on_boot(
            &coord, TX_STATE_COMMITTED, p1, p2_partial,
            mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
        );

        assert(rec == true);
        assert(did_refresh == false);
        assert(coord.committed_record.revision == 1); // Only authoritative committed record trusted!
        assert(strcmp(coord.committed_record.status, "TAGGED") == 0);
        printf("  -> PASS 3A: COMMITTED state loaded; incomplete staged payload ignored\n");
    }

    // Case 3B: tx_state was PENDING, but p_payload was missing/empty
    {
        SmartTagTxCoordinator coord;
        smarttag_tx_init(&coord);
        MockNvsContext hw;
        memset(&hw, 0, sizeof(hw));

        char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);

        bool did_refresh = true;
        bool rec = smarttag_tx_recover_on_boot(
            &coord, TX_STATE_PENDING, p1, "", // Empty pending payload
            mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
        );

        assert(rec == true);
        assert(did_refresh == false);
        assert(coord.committed_record.revision == 1); // Falls back safely to committed!
        assert(hw.nvs_tx_state == TX_STATE_COMMITTED);
        printf("  -> PASS 3B: Empty pending payload cleanly rolled back to committed Rev 1\n");
    }
}

// Scenario 4: Successful staging followed by BUSY timeout (Rollback, retry allowed)
void test_tx_scenario_4_successful_staging_busy_timeout() {
    printf("[TEST TX 4] Successful staging followed by BUSY timeout -> Rollback, retry allowed\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(coord.committed_record.revision == 1);
    int p1_writes = hw.payload_write_count;

    // Rev 2 stages successfully, but display refresh times out on BUSY pin
    hw.next_refresh_result = EPD_REFRESH_BUSY_TIMEOUT;
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    EpdRefreshResult ref_res;
    SmartTagTxResult r2 = smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, &ref_res);

    assert(r2 == TX_RESULT_REFRESH_FAILED);
    assert(ref_res == EPD_REFRESH_BUSY_TIMEOUT);
    assert(coord.committed_record.revision == 1); // RAM committed stays Rev 1!
    assert(coord.has_pending_record == false);
    assert(coord.tx_state == TX_STATE_COMMITTED);
    assert(hw.nvs_has_p_payload == false); // Staging key cleaned up!
    assert(hw.nvs_tx_state == TX_STATE_COMMITTED);
    assert(hw.payload_write_count == p1_writes); // Wear protection: did NOT rewrite payload on rollback!
    printf("  -> PASS: Staged candidate rolled back on BUSY timeout; committed record preserved\n");
}

// Scenario 5: Successful refresh followed by final NVS commit failure (RAM unchanged, retry allowed)
void test_tx_scenario_5_refresh_succeeds_final_commit_fails() {
    printf("[TEST TX 5] Successful refresh followed by final commit failure -> RAM unchanged\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(coord.committed_record.revision == 1);

    // Staging and refresh succeed, but final commit marker write fails
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.fail_committed_tx_state_write = true;

    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    SmartTagTxResult r2 = smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    assert(r2 == TX_RESULT_PERSISTENCE_FAILED);
    assert(coord.committed_record.revision == 1); // CRITICAL: RAM committed must NOT advance!
    assert(coord.has_pending_record == false);
    assert(hw.refresh_call_count == 2); // Refresh completed on hardware
    printf("  -> PASS: Final commit failure reported; RAM state remained un-advanced\n");
}

// Scenario 6: Reboot after partial COMMITTED persistence (Recovered from p_payload)
void test_tx_scenario_6_reboot_after_partial_committed_persistence() {
    printf("[TEST TX 6] Reboot after partial COMMITTED persistence -> Recovered from p_payload\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    // Simulate crash after payload write but before tx_state=COMMITTED
    hw.nvs_has_payload = true;
    strncpy(hw.nvs_payload, p2, sizeof(hw.nvs_payload) - 1);
    hw.nvs_has_p_payload = true;
    strncpy(hw.nvs_p_payload, p2, sizeof(hw.nvs_p_payload) - 1);
    hw.nvs_tx_state = (uint8_t)TX_STATE_PENDING;

    bool did_refresh = false;
    bool rec = smarttag_tx_recover_on_boot(
        &coord, TX_STATE_PENDING, hw.nvs_payload, hw.nvs_p_payload,
        mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
    );

    assert(rec == true);
    assert(did_refresh == true);
    assert(coord.committed_record.revision == 2);
    assert(strcmp(coord.committed_record.status, "LOADED") == 0);
    assert(hw.nvs_tx_state == TX_STATE_COMMITTED);
    assert(hw.nvs_has_p_payload == false);
    printf("  -> PASS: Interrupted commit finalized and committed upon boot\n");
}

// Scenario 7: Recovery from stale/failing PENDING marker (Safe fallback to committed)
void test_tx_scenario_7_recovery_from_stale_pending_marker() {
    printf("[TEST TX 7] Recovery from failing PENDING marker -> Safe fallback to committed\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    // Display refresh fails during boot recovery
    hw.next_refresh_result = EPD_REFRESH_BUSY_TIMEOUT;

    char p_committed[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p_committed, sizeof(p_committed), "CONFIRMED", 3);
    char p_pending[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p_pending, sizeof(p_pending), "INTERRUPTED", 4);

    bool did_refresh = true;
    bool rec = smarttag_tx_recover_on_boot(
        &coord, TX_STATE_PENDING, p_committed, p_pending,
        mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
    );

    assert(rec == true);
    assert(did_refresh == false);
    assert(coord.committed_record.revision == 3); // Must preserve Rev 3!
    assert(strcmp(coord.committed_record.status, "CONFIRMED") == 0);
    assert(hw.nvs_tx_state == TX_STATE_COMMITTED);
    printf("  -> PASS: Failed pending boot refresh safely rolled back to last committed revision\n");
}

// Scenario 8: Same-revision retry following failure (Immediate acceptance)
void test_tx_scenario_8_same_revision_retry_following_failure() {
    printf("[TEST TX 8] Same-revision retry following failure -> Immediate acceptance\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(coord.committed_record.revision == 1);

    // Rev 2 fails on staging first time
    hw.fail_p_payload_write = true;
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    SmartTagTxResult r2_fail = smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(r2_fail == TX_RESULT_PERSISTENCE_FAILED);
    assert(coord.committed_record.revision == 1);

    // Passenger retries EXACT SAME Rev 2 payload now that flash write succeeds
    hw.fail_p_payload_write = false;
    SmartTagTxResult r2_retry = smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    assert(r2_retry == TX_RESULT_COMMITTED);
    assert(coord.committed_record.revision == 2);
    assert(strcmp(coord.committed_record.status, "LOADED") == 0);
    printf("  -> PASS: Same revision accepted without stale/duplicate rejection after error\n");
}

// Scenario 9: Recovery from corrupted pending payload (CRC failure falls back to committed)
void test_tx_scenario_9_recovery_from_corrupted_pending_payload() {
    printf("[TEST TX 9] Recovery from corrupted pending payload -> CRC failure falls back to committed\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p_committed[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p_committed, sizeof(p_committed), "TAGGED", 1);

    // Corrupted pending payload (bad CRC checksum)
    const char *p_corrupt = "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|CORRUPT|2|DEAD";

    bool did_refresh = true;
    bool rec = smarttag_tx_recover_on_boot(
        &coord, TX_STATE_PENDING, p_committed, p_corrupt,
        mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
    );

    assert(rec == true);
    assert(did_refresh == false);
    assert(coord.committed_record.revision == 1);
    assert(strcmp(coord.committed_record.status, "TAGGED") == 0);
    assert(hw.refresh_call_count == 0); // Corrupted pending payload MUST NOT be displayed!
    assert(hw.nvs_tx_state == TX_STATE_COMMITTED);
    printf("  -> PASS: Corrupt pending CRC discarded without refresh; committed Rev 1 restored\n");
}

// Scenario 10: Duplicate suppression after fully committed success (0 SPI transfers)
void test_tx_scenario_10_duplicate_suppression_after_commit() {
    printf("[TEST TX 10] Duplicate suppression after commit -> 0 SPI transfers\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(hw.refresh_call_count == 1);
    int persist_count = hw.persist_call_count;

    // Rescan identical tag
    SmartTagTxResult res = smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    assert(res == TX_RESULT_IGNORED_IDENTICAL);
    assert(hw.refresh_call_count == 1); // No new display refresh!
    assert(hw.persist_call_count == persist_count); // No new flash write!
    assert(coord.committed_record.revision == 1);
    printf("  -> PASS: Duplicate tag tap ignored cleanly with zero SPI and zero NVS overhead\n");
}

// Scenario 11: Stale revisions, equal-revision conflicts, and legacy PA1 upgrade
void test_tx_scenario_11_stale_and_legacy_transitions() {
    printf("[TEST TX 11] Stale revisions, equal-revision conflicts, and legacy PA1 upgrade\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockNvsContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;

    // 1. Legacy boot recovery where tx_state == IDLE (v1 firmware upgrade)
    const char *legacy = "PA1|0160892012|HKG-NRT|RECOVERY_IN_PROGRESS|2026-11-10";
    bool did_refresh = false;
    bool rec_leg = smarttag_tx_recover_on_boot(
        &coord, TX_STATE_IDLE, legacy, "",
        mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
    );
    assert(rec_leg == true);
    assert(coord.committed_record.revision == 1);
    assert(strcmp(coord.committed_record.bag_id, "0160892012") == 0);
    assert(hw.nvs_tx_state == TX_STATE_COMMITTED);

    // 2. Advance to Rev 3
    char p3[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p3, sizeof(p3), "TAGGED", 3);
    assert(smarttag_tx_process_payload(&coord, p3, strlen(p3), mock_refresh_fn, mock_persist_fn, &hw, NULL) == TX_RESULT_COMMITTED);
    assert(coord.committed_record.revision == 3);

    // 3. Stale revision (< 3) rejected
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "TAGGED", 2);
    assert(smarttag_tx_process_payload(&coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL) == TX_RESULT_REJECTED_STALE);
    assert(coord.committed_record.revision == 3);

    // 4. Equal revision conflicting payload rejected
    char p3_conflict[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p3_conflict, sizeof(p3_conflict), "LOADED", 3);
    assert(smarttag_tx_process_payload(&coord, p3_conflict, strlen(p3_conflict), mock_refresh_fn, mock_persist_fn, &hw, NULL) == TX_RESULT_REJECTED_STALE);
    assert(coord.committed_record.revision == 3);
    assert(strcmp(coord.committed_record.status, "TAGGED") == 0);

    printf("  -> PASS: Stale revisions, equal-revision conflicts, and legacy migrations verified\n");
}

// =============================================================================
// MAIN RUNNER
// =============================================================================

int main() {
    printf("=============================================================\n");
    printf("  PolyAero Cathay SmartTag Host Test Suite\n");
    printf("  Protocol Parsing, TLV Extraction, Display & Transaction QA\n");
    printf("=============================================================\n\n");

    printf("--- PART 1: Protocol & Display Engine Tests ---\n");
    test_canonical_parsing_and_crc();
    test_corrupted_crc();
    test_version_validation();
    test_progression_evaluation();
    test_strict_iata_baggage_id();
    test_dynamic_tlv_estimation();
    test_legacy_pa1_support();
    test_display_rendering();
    test_android_ndef_bytes_compatibility();
    printf("-> PART 1 PASSED (9/9 tests)\n\n");

    printf("--- PART 2: E-Paper Transaction Integrity Tests (P3 — 10 Scenarios) ---\n");
    test_tx_scenario_1_failure_writing_p_payload();
    test_tx_scenario_2_failure_writing_tx_state();
    test_tx_scenario_3_partial_pending_persistence_recovery();
    test_tx_scenario_4_successful_staging_busy_timeout();
    test_tx_scenario_5_refresh_succeeds_final_commit_fails();
    test_tx_scenario_6_reboot_after_partial_committed_persistence();
    test_tx_scenario_7_recovery_from_stale_pending_marker();
    test_tx_scenario_8_same_revision_retry_following_failure();
    test_tx_scenario_9_recovery_from_corrupted_pending_payload();
    test_tx_scenario_10_duplicate_suppression_after_commit();
    test_tx_scenario_11_stale_and_legacy_transitions();
    printf("-> PART 2 PASSED (11/11 tests)\n\n");

    printf("=============================================================\n");
    printf("  ALL 20 C++ PROTOCOL, DISPLAY & TRANSACTION TESTS PASSED!\n");
    printf("=============================================================\n");
    return 0;
}
