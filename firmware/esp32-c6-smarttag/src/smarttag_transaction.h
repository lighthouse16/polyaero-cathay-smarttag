#ifndef SMARTTAG_TRANSACTION_H
#define SMARTTAG_TRANSACTION_H

#include "smarttag_protocol.h"
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Explicit display refresh completion status from EPD driver.
 * Note: Success indicates driver-reported refresh completion, not optical verification.
 */
typedef enum {
    EPD_REFRESH_SUCCESS = 0,
    EPD_REFRESH_NOT_INITIALIZED = 1,
    EPD_REFRESH_BUSY_TIMEOUT = 2,
    EPD_REFRESH_TRANSFER_FAILED = 3
} EpdRefreshResult;

/**
 * Durable transaction marker stored in NVS.
 */
typedef enum {
    TX_STATE_IDLE = 0,
    TX_STATE_PENDING = 1,
    TX_STATE_COMMITTED = 2
} SmartTagTxState;

/**
 * High-level outcome of an incoming NFC payload transaction.
 */
typedef enum {
    TX_RESULT_COMMITTED = 0,
    TX_RESULT_IGNORED_IDENTICAL = 1,
    TX_RESULT_REJECTED_STALE = 2,
    TX_RESULT_REJECTED_INVALID = 3,
    TX_RESULT_REFRESH_FAILED = 4,
    TX_RESULT_PERSISTENCE_FAILED = 5
} SmartTagTxResult;

/**
 * Transaction coordinator state tracking.
 */
typedef struct {
    SmartTagTxState tx_state;
    SmartTagRecord committed_record;
    bool has_committed_record;
    SmartTagRecord pending_record;
    bool has_pending_record;
    char committed_raw_payload[SMARTTAG_MAX_PAYLOAD_LEN + 1];
    char pending_raw_payload[SMARTTAG_MAX_PAYLOAD_LEN + 1];
} SmartTagTxCoordinator;

/**
 * Driver-reported refresh callback signature.
 */
typedef EpdRefreshResult (*SmartTagRefreshFn)(const SmartTagRecord *rec, void *user_ctx);

/**
 * Durable storage persistence callback signature.
 * - state: TX_STATE_PENDING or TX_STATE_COMMITTED or TX_STATE_IDLE (cleanup).
 * - returns true on durable write success, false on flash/nvs error.
 */
typedef bool (*SmartTagPersistFn)(
    SmartTagTxState state,
    const SmartTagRecord *rec,
    const char *raw_payload,
    void *user_ctx
);

/**
 * Initializes coordinator to idle state.
 */
void smarttag_tx_init(SmartTagTxCoordinator *coord);

/**
 * Processes incoming raw NFC payload through transactional pipeline:
 * VALIDATE -> CHECK PROGRESSION -> STAGE PENDING -> REFRESH DISPLAY -> COMMIT NVS -> UPDATE COMMITTED.
 *
 * If refresh fails (e.g. BUSY timeout), committed state is untouched and same revision
 * can be retried immediately.
 */
SmartTagTxResult smarttag_tx_process_payload(
    SmartTagTxCoordinator *coord,
    const char *raw_payload,
    size_t payload_len,
    SmartTagRefreshFn refresh_cb,
    SmartTagPersistFn persist_cb,
    void *user_ctx,
    EpdRefreshResult *out_refresh_res
);

/**
 * Cold-boot crash/power-loss recovery:
 * Inspects stored NVS tx_state, committed payload, and staged pending payload.
 * - If TX_STATE_COMMITTED: restores committed record (does not trigger refresh itself).
 * - If TX_STATE_PENDING: attempts to finish interrupted refresh of pending payload and commit;
 *   if pending refresh fails, rolls back safely to stored_committed_payload (if valid).
 * Sets *out_did_refresh (if non-NULL) to true iff a display refresh succeeded during recovery.
 * Returns true if a valid baggage record is active in coord->committed_record.
 */
bool smarttag_tx_recover_on_boot(
    SmartTagTxCoordinator *coord,
    SmartTagTxState stored_tx_state,
    const char *stored_committed_payload,
    const char *stored_pending_payload,
    SmartTagRefreshFn refresh_cb,
    SmartTagPersistFn persist_cb,
    void *user_ctx,
    bool *out_did_refresh
);

/**
 * Helper strings for logging and diagnostics.
 */
const char* smarttag_tx_result_string(SmartTagTxResult res);
const char* epd_refresh_result_string(EpdRefreshResult res);
const char* smarttag_tx_state_string(SmartTagTxState state);

#ifdef __cplusplus
}
#endif

#endif // SMARTTAG_TRANSACTION_H
