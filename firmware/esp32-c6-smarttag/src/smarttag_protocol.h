#ifndef SMARTTAG_PROTOCOL_H
#define SMARTTAG_PROTOCOL_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SMARTTAG_PROTOCOL_VERSION 1
#define SMARTTAG_MAX_PAYLOAD_LEN 130
#define SMARTTAG_MAX_FIELD_LEN 32

typedef enum {
    SMARTTAG_OK = 0,
    SMARTTAG_ERR_EMPTY = 1,
    SMARTTAG_ERR_FORMAT = 2,
    SMARTTAG_ERR_VERSION = 3,
    SMARTTAG_ERR_FIELD_INVALID = 4,
    SMARTTAG_ERR_CRC_MISMATCH = 5,
    SMARTTAG_ERR_OVERSIZE = 6,
    SMARTTAG_ERR_STALE_REVISION = 7
} SmartTagParseResult;

typedef enum {
    PROG_NEW_REVISION = 0,
    PROG_IDENTICAL = 1,
    PROG_STALE = 2
} SmartTagProgression;

typedef struct {
    uint8_t version;
    char tag_id[17];     // e.g. "ST-2048"
    char bag_id[17];     // e.g. "0160123456"
    char flight[10];     // e.g. "CX548"
    char from[4];        // e.g. "HKG"
    char to[4];          // e.g. "NRT"
    char status[32];     // e.g. "TAGGED", "PRIORITY_TRANSFER"
    uint32_t revision;   // Monotonic revision counter
    uint16_t crc16;      // CCITT CRC-16
    bool has_crc;
} SmartTagRecord;

/**
 * Calculates CRC-16-CCITT (poly 0x1021, init 0xFFFF, no reflection).
 */
uint16_t smarttag_crc16_ccitt(const char *data, size_t len);

/**
 * Parses canonical pipe-delimited payload (PA2|...) or compact JSON.
 */
SmartTagParseResult smarttag_parse_payload(const char *raw, size_t len, SmartTagRecord *out_record);

/**
 * Evaluates whether incoming payload is fresh, duplicate, or stale.
 */
SmartTagProgression smarttag_evaluate_progression(const SmartTagRecord *incoming, const SmartTagRecord *last_valid);

/**
 * Returns human-readable error description.
 */
const char* smarttag_error_string(SmartTagParseResult res);

/**
 * Extracts UTF-8 text payload from raw NDEF Message bytes (e.g. RTD_TEXT record).
 * Returns extracted length (>0) on success, or 0 if no text record is found.
 */
size_t smarttag_extract_text_from_ndef_message(
    const uint8_t *ndef_bytes,
    size_t ndef_len,
    char *out_text,
    size_t out_max
);

/**
 * Extracts UTF-8 text payload from raw NTAG213/215/216 Type 2 Tag user memory
 * starting at Page 4 (skips NULL/Lock TLVs, locates 0x03 NDEF TLV, decodes NDEF).
 */
size_t smarttag_extract_text_from_type2_tlv(
    const uint8_t *user_mem,
    size_t mem_len,
    char *out_text,
    size_t out_max
);

#ifdef __cplusplus
}
#endif

#endif // SMARTTAG_PROTOCOL_H
