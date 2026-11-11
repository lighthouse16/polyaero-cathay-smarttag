#include "smarttag_transaction.h"
#include <string.h>

void smarttag_tx_init(SmartTagTxCoordinator *coord) {
    if (!coord) return;
    memset(coord, 0, sizeof(SmartTagTxCoordinator));
    coord->tx_state = TX_STATE_IDLE;
    coord->has_committed_record = false;
    coord->has_pending_record = false;
}

SmartTagTxResult smarttag_tx_process_payload(
    SmartTagTxCoordinator *coord,
    const char *raw_payload,
    size_t payload_len,
    SmartTagRefreshFn refresh_cb,
    SmartTagPersistFn persist_cb,
    void *user_ctx,
    EpdRefreshResult *out_refresh_res
) {
    if (out_refresh_res) {
        *out_refresh_res = EPD_REFRESH_NOT_INITIALIZED;
    }

    if (!coord || !raw_payload || payload_len == 0) {
        return TX_RESULT_REJECTED_INVALID;
    }

    // 1. Parse and validate candidate payload structure
    SmartTagRecord candidate;
    SmartTagParseResult parse_res = smarttag_parse_payload(raw_payload, payload_len, &candidate);
    if (parse_res != SMARTTAG_OK) {
        return TX_RESULT_REJECTED_INVALID;
    }

    // 2. Strict CRC-16 check for PA2 over RF
    if (strncmp(raw_payload, "PA2|", 4) == 0 && !candidate.has_crc) {
        return TX_RESULT_REJECTED_INVALID;
    }

    // 3. Evaluate revision progression against last COMMITTED record only
    const SmartTagRecord *last_committed = coord->has_committed_record ? &coord->committed_record : NULL;
    SmartTagProgression prog = smarttag_evaluate_progression(&candidate, last_committed);

    if (prog == PROG_IDENTICAL) {
        return TX_RESULT_IGNORED_IDENTICAL;
    }

    if (prog == PROG_STALE) {
        return TX_RESULT_REJECTED_STALE;
    }

    // 4. Progression is fresh! Stage candidate as pending without touching committed record
    coord->pending_record = candidate;
    coord->has_pending_record = true;
    coord->tx_state = TX_STATE_PENDING;
    size_t copy_len = payload_len < SMARTTAG_MAX_PAYLOAD_LEN ? payload_len : SMARTTAG_MAX_PAYLOAD_LEN;
    memcpy(coord->pending_raw_payload, raw_payload, copy_len);
    coord->pending_raw_payload[copy_len] = '\0';

    // Store pending transaction marker in NVS to guard against mid-refresh crash
    if (persist_cb) {
        bool staged = persist_cb(TX_STATE_PENDING, &candidate, coord->pending_raw_payload, user_ctx);
        if (!staged) {
            // Staging failed! Abort transaction before touching display hardware
            coord->has_pending_record = false;
            coord->tx_state = coord->has_committed_record ? TX_STATE_COMMITTED : TX_STATE_IDLE;
            return TX_RESULT_PERSISTENCE_FAILED;
        }
    }

    // 5. Attempt display refresh via callback
    EpdRefreshResult refresh_res = EPD_REFRESH_NOT_INITIALIZED;
    if (refresh_cb) {
        refresh_res = refresh_cb(&candidate, user_ctx);
    }
    if (out_refresh_res) {
        *out_refresh_res = refresh_res;
    }

    // 6. Handle refresh failure: rollback pending state, preserve committed record
    if (refresh_res != EPD_REFRESH_SUCCESS) {
        coord->has_pending_record = false;
        coord->tx_state = coord->has_committed_record ? TX_STATE_COMMITTED : TX_STATE_IDLE;

        // Clean up pending transaction marker in NVS
        if (persist_cb) {
            if (coord->has_committed_record) {
                persist_cb(TX_STATE_COMMITTED, &coord->committed_record, coord->committed_raw_payload, user_ctx);
            } else {
                persist_cb(TX_STATE_IDLE, NULL, "", user_ctx);
            }
        }
        return TX_RESULT_REFRESH_FAILED;
    }

    // 7. Driver confirmed refresh completion! Durably commit new revision to NVS
    bool persisted = true;
    if (persist_cb) {
        persisted = persist_cb(TX_STATE_COMMITTED, &candidate, coord->pending_raw_payload, user_ctx);
    }

    if (!persisted) {
        // NVS write failed: do NOT update committed RAM state
        coord->has_pending_record = false;
        coord->tx_state = coord->has_committed_record ? TX_STATE_COMMITTED : TX_STATE_IDLE;
        return TX_RESULT_PERSISTENCE_FAILED;
    }

    // 8. Commit succeeded: update in-memory committed record
    coord->committed_record = candidate;
    coord->has_committed_record = true;
    coord->tx_state = TX_STATE_COMMITTED;
    coord->has_pending_record = false;
    memcpy(coord->committed_raw_payload, coord->pending_raw_payload, sizeof(coord->committed_raw_payload));

    return TX_RESULT_COMMITTED;
}

bool smarttag_tx_recover_on_boot(
    SmartTagTxCoordinator *coord,
    SmartTagTxState stored_tx_state,
    const char *stored_committed_payload,
    const char *stored_pending_payload,
    SmartTagRefreshFn refresh_cb,
    SmartTagPersistFn persist_cb,
    void *user_ctx,
    bool *out_did_refresh
) {
    if (out_did_refresh) {
        *out_did_refresh = false;
    }
    if (!coord) {
        return false;
    }

    if (stored_tx_state == TX_STATE_COMMITTED) {
        if (!stored_committed_payload || stored_committed_payload[0] == '\0') {
            if (persist_cb) {
                persist_cb(TX_STATE_IDLE, NULL, "", user_ctx);
            }
            return false;
        }
        SmartTagRecord rec;
        SmartTagParseResult res = smarttag_parse_payload(stored_committed_payload, strlen(stored_committed_payload), &rec);
        if (res == SMARTTAG_OK) {
            coord->committed_record = rec;
            coord->has_committed_record = true;
            coord->tx_state = TX_STATE_COMMITTED;
            coord->has_pending_record = false;
            strncpy(coord->committed_raw_payload, stored_committed_payload, SMARTTAG_MAX_PAYLOAD_LEN);
            coord->committed_raw_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
            return true;
        }
        // Corrupted committed payload: safe fallback to IDLE
        if (persist_cb) {
            persist_cb(TX_STATE_IDLE, NULL, "", user_ctx);
        }
        return false;
    }

    if (stored_tx_state == TX_STATE_PENDING) {
        // Power was interrupted while refresh was in progress.
        // Try finishing the interrupted refresh cycle on stored_pending_payload.
        if (stored_pending_payload && stored_pending_payload[0] != '\0') {
            SmartTagRecord pending_rec;
            SmartTagParseResult res = smarttag_parse_payload(stored_pending_payload, strlen(stored_pending_payload), &pending_rec);
            if (res == SMARTTAG_OK) {
                EpdRefreshResult refresh_res = EPD_REFRESH_NOT_INITIALIZED;
                if (refresh_cb) {
                    refresh_res = refresh_cb(&pending_rec, user_ctx);
                }
                if (refresh_res == EPD_REFRESH_SUCCESS) {
                    if (out_did_refresh) {
                        *out_did_refresh = true;
                    }
                    bool persisted = true;
                    if (persist_cb) {
                        persisted = persist_cb(TX_STATE_COMMITTED, &pending_rec, stored_pending_payload, user_ctx);
                    }
                    if (persisted) {
                        coord->committed_record = pending_rec;
                        coord->has_committed_record = true;
                        coord->tx_state = TX_STATE_COMMITTED;
                        coord->has_pending_record = false;
                        strncpy(coord->committed_raw_payload, stored_pending_payload, SMARTTAG_MAX_PAYLOAD_LEN);
                        coord->committed_raw_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
                        return true;
                    }
                }
            }
        }

        // Pending recovery failed or pending payload was invalid:
        // Roll back safely to previously committed payload if present.
        if (stored_committed_payload && stored_committed_payload[0] != '\0') {
            SmartTagRecord committed_rec;
            if (smarttag_parse_payload(stored_committed_payload, strlen(stored_committed_payload), &committed_rec) == SMARTTAG_OK) {
                coord->committed_record = committed_rec;
                coord->has_committed_record = true;
                coord->tx_state = TX_STATE_COMMITTED;
                coord->has_pending_record = false;
                strncpy(coord->committed_raw_payload, stored_committed_payload, SMARTTAG_MAX_PAYLOAD_LEN);
                coord->committed_raw_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
                if (persist_cb) {
                    persist_cb(TX_STATE_COMMITTED, &committed_rec, stored_committed_payload, user_ctx);
                }
                return true;
            }
        }

        // No valid committed payload to fall back to: clear NVS to IDLE
        if (persist_cb) {
            persist_cb(TX_STATE_IDLE, NULL, "", user_ctx);
        }
        return false;
    }

    if (stored_tx_state == TX_STATE_IDLE && stored_committed_payload && stored_committed_payload[0] != '\0') {
        // Legacy backward compatibility: unversioned NVS with valid payload
        SmartTagRecord legacy_rec;
        SmartTagParseResult res = smarttag_parse_payload(stored_committed_payload, strlen(stored_committed_payload), &legacy_rec);
        if (res == SMARTTAG_OK) {
            coord->committed_record = legacy_rec;
            coord->has_committed_record = true;
            coord->tx_state = TX_STATE_COMMITTED;
            coord->has_pending_record = false;
            strncpy(coord->committed_raw_payload, stored_committed_payload, SMARTTAG_MAX_PAYLOAD_LEN);
            coord->committed_raw_payload[SMARTTAG_MAX_PAYLOAD_LEN] = '\0';
            if (persist_cb) {
                persist_cb(TX_STATE_COMMITTED, &legacy_rec, stored_committed_payload, user_ctx);
            }
            return true;
        }
    }

    return false;
}

const char* smarttag_tx_result_string(SmartTagTxResult res) {
    switch (res) {
        case TX_RESULT_COMMITTED: return "COMMITTED";
        case TX_RESULT_IGNORED_IDENTICAL: return "IGNORED_IDENTICAL";
        case TX_RESULT_REJECTED_STALE: return "REJECTED_STALE";
        case TX_RESULT_REJECTED_INVALID: return "REJECTED_INVALID";
        case TX_RESULT_REFRESH_FAILED: return "REFRESH_FAILED";
        case TX_RESULT_PERSISTENCE_FAILED: return "PERSISTENCE_FAILED";
        default: return "UNKNOWN";
    }
}

const char* epd_refresh_result_string(EpdRefreshResult res) {
    switch (res) {
        case EPD_REFRESH_SUCCESS: return "Success (driver-reported completion)";
        case EPD_REFRESH_NOT_INITIALIZED: return "NotInitialized";
        case EPD_REFRESH_BUSY_TIMEOUT: return "BusyTimeout";
        case EPD_REFRESH_TRANSFER_FAILED: return "TransferFailed";
        default: return "Unknown";
    }
}

const char* smarttag_tx_state_string(SmartTagTxState state) {
    switch (state) {
        case TX_STATE_IDLE: return "IDLE";
        case TX_STATE_PENDING: return "PENDING";
        case TX_STATE_COMMITTED: return "COMMITTED";
        default: return "UNKNOWN";
    }
}
