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
// MOCK HARDWARE & NVS STORAGE HARNESS
// =============================================================================

typedef struct {
    EpdRefreshResult next_refresh_result;
    int refresh_call_count;
    bool persist_success;
    int persist_call_count;
    SmartTagTxState last_persisted_state;
    char last_persisted_payload[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    SmartTagRecord last_refreshed_record;
} MockHardwareContext;

static EpdRefreshResult mock_refresh_fn(const SmartTagRecord *rec, void *user_ctx) {
    MockHardwareContext *hw = (MockHardwareContext*)user_ctx;
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
    (void)rec;
    MockHardwareContext *hw = (MockHardwareContext*)user_ctx;
    hw->persist_call_count++;
    hw->last_persisted_state = state;
    if (raw_payload) {
        strncpy(hw->last_persisted_payload, raw_payload, SMARTTAG_MAX_PAYLOAD_LEN);
        hw->last_persisted_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
    }
    return hw->persist_success;
}

static void make_pa2_payload(char *buf, size_t max_len, const char *status, uint32_t rev) {
    char prefix[SMARTTAG_MAX_PAYLOAD_LEN];
    snprintf(prefix, sizeof(prefix), "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|%s|%lu",
             status, (unsigned long)rev);
    uint16_t crc = smarttag_crc16_ccitt(prefix, strlen(prefix));
    snprintf(buf, max_len, "%s|%04X", prefix, crc);
}

// =============================================================================
// TRANSACTION INTEGRITY REGRESSION TESTS (P3 — 8 SCENARIOS)
// =============================================================================

// Scenario 1: Successful refresh followed by successful persistence
void test_tx_scenario_1_successful_refresh_and_commit() {
    printf("[TEST TX 1] Successful refresh followed by successful persistence -> COMMITTED\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;

    char payload[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(payload, sizeof(payload), "TAGGED", 1);

    EpdRefreshResult ref_res;
    SmartTagTxResult tx_res = smarttag_tx_process_payload(
        &coord, payload, strlen(payload),
        mock_refresh_fn, mock_persist_fn, &hw, &ref_res
    );

    assert(tx_res == TX_RESULT_COMMITTED);
    assert(ref_res == EPD_REFRESH_SUCCESS);
    assert(coord.has_committed_record == true);
    assert(coord.committed_record.revision == 1);
    assert(coord.tx_state == TX_STATE_COMMITTED);
    assert(coord.has_pending_record == false);
    assert(hw.refresh_call_count == 1);
    assert(hw.last_persisted_state == TX_STATE_COMMITTED);
    printf("  -> PASS: Candidate successfully displayed and durably committed to NVS\n");
}

// Scenario 2: BUSY timeout with no state commit (state preserved)
void test_tx_scenario_2_busy_timeout_rollback() {
    printf("[TEST TX 2] BUSY timeout before/during refresh -> State preserved, no commit\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    // Initial valid state: Rev 1 COMMITTED
    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;
    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(coord.committed_record.revision == 1);

    // Attempt Rev 2 when panel BUSY line times out
    hw.next_refresh_result = EPD_REFRESH_BUSY_TIMEOUT;
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);

    EpdRefreshResult ref_res;
    SmartTagTxResult tx_res = smarttag_tx_process_payload(
        &coord, p2, strlen(p2),
        mock_refresh_fn, mock_persist_fn, &hw, &ref_res
    );

    assert(tx_res == TX_RESULT_REFRESH_FAILED);
    assert(ref_res == EPD_REFRESH_BUSY_TIMEOUT);
    // Crucial: Committed record MUST remain Rev 1!
    assert(coord.has_committed_record == true);
    assert(coord.committed_record.revision == 1);
    assert(strcmp(coord.committed_record.status, "TAGGED") == 0);
    assert(coord.has_pending_record == false);
    assert(coord.tx_state == TX_STATE_COMMITTED);
    printf("  -> PASS: Refresh failed cleanly rolled back; committed Rev 1 preserved\n");
}

// Scenario 3: Retry of the same revision after a failed refresh succeeds
void test_tx_scenario_3_retry_same_revision_after_failure() {
    printf("[TEST TX 3] Retry of same revision after failed refresh -> Accepted and commits\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;
    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    // Rev 2 fails first time (BUSY timeout)
    hw.next_refresh_result = EPD_REFRESH_BUSY_TIMEOUT;
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);
    SmartTagTxResult res1 = smarttag_tx_process_payload(
        &coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL
    );
    assert(res1 == TX_RESULT_REFRESH_FAILED);
    assert(coord.committed_record.revision == 1);

    // Passenger retries EXACT SAME Rev 2 payload now that BUSY released
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    SmartTagTxResult res2 = smarttag_tx_process_payload(
        &coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL
    );

    assert(res2 == TX_RESULT_COMMITTED);
    assert(coord.committed_record.revision == 2);
    assert(strcmp(coord.committed_record.status, "LOADED") == 0);
    printf("  -> PASS: Same revision 2 successfully accepted on retry (NOT blocked as duplicate)\n");
}

// Scenario 4: Duplicate suppression after success
void test_tx_scenario_4_duplicate_suppression_after_success() {
    printf("[TEST TX 4] Duplicate payload already displayed -> Suppressed with zero SPI transfer\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;
    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(hw.refresh_call_count == 1);

    // Tap identical payload again
    SmartTagTxResult res = smarttag_tx_process_payload(
        &coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL
    );

    assert(res == TX_RESULT_IGNORED_IDENTICAL);
    assert(hw.refresh_call_count == 1); // Refresh call count MUST NOT increment!
    assert(coord.committed_record.revision == 1);
    printf("  -> PASS: Duplicate tap suppressed without re-refreshing E-paper\n");
}

// Scenario 5: Rejection of an older revision
void test_tx_scenario_5_rejection_of_older_revision() {
    printf("[TEST TX 5] Rejection of older revision (Stale)\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;

    // Advance to Rev 3
    char p3[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p3, sizeof(p3), "TAGGED", 3);
    smarttag_tx_process_payload(&coord, p3, strlen(p3), mock_refresh_fn, mock_persist_fn, &hw, NULL);
    assert(coord.committed_record.revision == 3);

    // Tap stale Rev 2
    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "TAGGED", 2);
    SmartTagTxResult res = smarttag_tx_process_payload(
        &coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL
    );

    assert(res == TX_RESULT_REJECTED_STALE);
    assert(coord.committed_record.revision == 3);
    printf("  -> PASS: Older revision cleanly rejected as stale\n");
}

// Scenario 6: Rejection of equal-revision conflicting payloads
void test_tx_scenario_6_rejection_of_equal_revision_conflict() {
    printf("[TEST TX 6] Rejection of equal-revision conflicting payload\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;

    // Committed: Rev 2, status "TAGGED"
    char p2_a[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2_a, sizeof(p2_a), "TAGGED", 2);
    smarttag_tx_process_payload(&coord, p2_a, strlen(p2_a), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    // Incoming: Rev 2, but status "LOADED" (conflict!)
    char p2_b[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2_b, sizeof(p2_b), "LOADED", 2);
    SmartTagTxResult res = smarttag_tx_process_payload(
        &coord, p2_b, strlen(p2_b), mock_refresh_fn, mock_persist_fn, &hw, NULL
    );

    assert(res == TX_RESULT_REJECTED_STALE);
    assert(coord.committed_record.revision == 2);
    assert(strcmp(coord.committed_record.status, "TAGGED") == 0);
    printf("  -> PASS: Conflicting payload with equal revision rejected\n");
}

// Scenario 7: Failure during NVS persistence
void test_tx_scenario_7_nvs_persistence_failure() {
    printf("[TEST TX 7] Failure during NVS persistence -> Non-durable error reported\n");
    SmartTagTxCoordinator coord;
    smarttag_tx_init(&coord);

    // Start with committed Rev 1
    MockHardwareContext hw;
    memset(&hw, 0, sizeof(hw));
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = true;
    char p1[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p1, sizeof(p1), "TAGGED", 1);
    smarttag_tx_process_payload(&coord, p1, strlen(p1), mock_refresh_fn, mock_persist_fn, &hw, NULL);

    // Refresh succeeds, but flash write fails
    hw.next_refresh_result = EPD_REFRESH_SUCCESS;
    hw.persist_success = false; // Simulated flash wear / NVS open failure

    char p2[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    make_pa2_payload(p2, sizeof(p2), "LOADED", 2);
    SmartTagTxResult res = smarttag_tx_process_payload(
        &coord, p2, strlen(p2), mock_refresh_fn, mock_persist_fn, &hw, NULL
    );

    assert(res == TX_RESULT_PERSISTENCE_FAILED);
    // Crucial: Committed RAM record must NOT advance if durable write failed!
    assert(coord.committed_record.revision == 1);
    assert(coord.has_pending_record == false);
    printf("  -> PASS: Flash error prevented invalid state progression; error reported\n");
}

// Scenario 8: Simulated reboot between display refresh and NVS commit
void test_tx_scenario_8_reboot_crash_recovery() {
    printf("[TEST TX 8] Simulated reboot / crash recovery across power-cycle states\n");

    // Case 8A: Staged PENDING state restored on cold-boot (interrupted refresh completes)
    {
        SmartTagTxCoordinator coord;
        smarttag_tx_init(&coord);

        MockHardwareContext hw;
        memset(&hw, 0, sizeof(hw));
        hw.next_refresh_result = EPD_REFRESH_SUCCESS;
        hw.persist_success = true;

        char p_committed[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p_committed, sizeof(p_committed), "TAGGED", 4);
        char p_pending[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p_pending, sizeof(p_pending), "RECOVERED", 5);

        bool did_refresh = false;
        bool rec = smarttag_tx_recover_on_boot(
            &coord, TX_STATE_PENDING, p_committed, p_pending,
            mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
        );

        assert(rec == true);
        assert(did_refresh == true);
        assert(coord.has_committed_record == true);
        assert(coord.committed_record.revision == 5);
        assert(strcmp(coord.committed_record.status, "RECOVERED") == 0);
        assert(hw.refresh_call_count == 1); // Display cycle completed on boot!
        assert(hw.last_persisted_state == TX_STATE_COMMITTED); // Finalized to COMMITTED!
        printf("  -> PASS 8A: Mid-flight interrupted refresh completed and finalized on cold boot\n");
    }

    // Case 8B: Staged PENDING where boot refresh STILL fails -> safely falls back to prior committed payload!
    {
        SmartTagTxCoordinator coord;
        smarttag_tx_init(&coord);

        MockHardwareContext hw;
        memset(&hw, 0, sizeof(hw));
        hw.next_refresh_result = EPD_REFRESH_BUSY_TIMEOUT;
        hw.persist_success = true;

        char p_committed[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p_committed, sizeof(p_committed), "TAGGED", 4);
        char p_pending[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p_pending, sizeof(p_pending), "LOADED", 5);

        bool did_refresh = true;
        bool rec = smarttag_tx_recover_on_boot(
            &coord, TX_STATE_PENDING, p_committed, p_pending,
            mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
        );

        assert(rec == true);
        assert(did_refresh == false);
        assert(coord.has_committed_record == true);
        assert(coord.committed_record.revision == 4); // Rolled back cleanly to Rev 4!
        assert(strcmp(coord.committed_record.status, "TAGGED") == 0);
        assert(hw.last_persisted_state == TX_STATE_COMMITTED);
        printf("  -> PASS 8B: Failed PENDING boot recovery safely preserved prior committed Rev 4\n");
    }

    // Case 8C: Clean committed state restored on boot (no re-refresh inside recover_on_boot)
    {
        SmartTagTxCoordinator coord;
        smarttag_tx_init(&coord);

        MockHardwareContext hw;
        memset(&hw, 0, sizeof(hw));
        char p_committed[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        make_pa2_payload(p_committed, sizeof(p_committed), "TAGGED", 5);

        bool did_refresh = false;
        bool rec = smarttag_tx_recover_on_boot(
            &coord, TX_STATE_COMMITTED, p_committed, "",
            mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
        );

        assert(rec == true);
        assert(did_refresh == false);
        assert(coord.has_committed_record == true);
        assert(coord.committed_record.revision == 5);
        assert(hw.refresh_call_count == 0); // No extra refresh in recover_on_boot for committed
        printf("  -> PASS 8C: Valid COMMITTED state loaded from NVS on cold boot\n");
    }

    // Case 8D: First boot with no state (standby prompt)
    {
        SmartTagTxCoordinator coord;
        smarttag_tx_init(&coord);
        MockHardwareContext hw;
        memset(&hw, 0, sizeof(hw));

        bool did_refresh = false;
        bool rec = smarttag_tx_recover_on_boot(
            &coord, TX_STATE_IDLE, "", "",
            mock_refresh_fn, mock_persist_fn, &hw, &did_refresh
        );
        assert(rec == false);
        assert(did_refresh == false);
        assert(coord.has_committed_record == false);
        printf("  -> PASS 8D: Uninitialized NVS correctly triggers standby mode\n");
    }
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

    printf("--- PART 2: E-Paper Transaction Integrity Tests (P3) ---\n");
    test_tx_scenario_1_successful_refresh_and_commit();
    test_tx_scenario_2_busy_timeout_rollback();
    test_tx_scenario_3_retry_same_revision_after_failure();
    test_tx_scenario_4_duplicate_suppression_after_success();
    test_tx_scenario_5_rejection_of_older_revision();
    test_tx_scenario_6_rejection_of_equal_revision_conflict();
    test_tx_scenario_7_nvs_persistence_failure();
    test_tx_scenario_8_reboot_crash_recovery();
    printf("-> PART 2 PASSED (8/8 tests)\n\n");

    printf("=============================================================\n");
    printf("  ALL 17 C++ PROTOCOL, DISPLAY & TRANSACTION TESTS PASSED!\n");
    printf("=============================================================\n");
    return 0;
}
