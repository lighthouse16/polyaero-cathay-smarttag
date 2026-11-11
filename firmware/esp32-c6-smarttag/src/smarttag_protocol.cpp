#include "smarttag_protocol.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <ctype.h>

uint16_t smarttag_crc16_ccitt(const char *data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= (uint8_t)data[i] << 8;
        for (int j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = (crc << 1);
            }
        }
    }
    return crc;
}

static void trim_and_copy(char *dest, const char *src, size_t max_len) {
    while (*src && isspace((unsigned char)*src)) src++;
    size_t i = 0;
    while (*src && i < max_len - 1) {
        dest[i++] = (char)*src++;
    }
    while (i > 0 && isspace((unsigned char)dest[i - 1])) {
        i--;
    }
    dest[i] = '\0';
}

static uint16_t parse_hex4(const char *str) {
    uint16_t val = 0;
    for (int i = 0; i < 4; i++) {
        char c = str[i];
        val <<= 4;
        if (c >= '0' && c <= '9') val |= (c - '0');
        else if (c >= 'A' && c <= 'F') val |= (c - 'A' + 10);
        else if (c >= 'a' && c <= 'f') val |= (c - 'a' + 10);
        else return 0;
    }
    return val;
}

SmartTagParseResult smarttag_parse_payload(const char *raw, size_t len, SmartTagRecord *out_record) {
    if (!raw || len == 0) return SMARTTAG_ERR_EMPTY;
    if (len > SMARTTAG_MAX_PAYLOAD_LEN) return SMARTTAG_ERR_OVERSIZE;
    if (!out_record) return SMARTTAG_ERR_FIELD_INVALID;

    memset(out_record, 0, sizeof(SmartTagRecord));

    // 1. Check for canonical PA2 pipe-delimited format
    if (len >= 4 && strncmp(raw, "PA2|", 4) == 0) {
        char buffer[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        memcpy(buffer, raw, len);
        buffer[len] = '\0';

        char *fields[12];
        int field_count = 0;
        char *ptr = buffer;

        while (ptr && *ptr && field_count < 12) {
            fields[field_count++] = ptr;
            char *next = strchr(ptr, '|');
            if (next) {
                *next = '\0';
                ptr = next + 1;
            } else {
                break;
            }
        }

        if (field_count < 9) {
            return SMARTTAG_ERR_FORMAT;
        }

        // fields[0] = "PA2"
        // fields[1] = version
        // fields[2] = tagId
        // fields[3] = bagId
        // fields[4] = flight
        // fields[5] = from
        // fields[6] = to
        // fields[7] = status
        // fields[8] = rev
        // fields[9] = crc16 (optional)

        int version = atoi(fields[1]);
        if (version != SMARTTAG_PROTOCOL_VERSION) {
            return SMARTTAG_ERR_VERSION;
        }
        out_record->version = (uint8_t)version;

        trim_and_copy(out_record->tag_id, fields[2], sizeof(out_record->tag_id));
        trim_and_copy(out_record->bag_id, fields[3], sizeof(out_record->bag_id));
        trim_and_copy(out_record->flight, fields[4], sizeof(out_record->flight));
        trim_and_copy(out_record->from, fields[5], sizeof(out_record->from));
        trim_and_copy(out_record->to, fields[6], sizeof(out_record->to));
        trim_and_copy(out_record->status, fields[7], sizeof(out_record->status));

        out_record->revision = (uint32_t)strtoul(fields[8], NULL, 10);

        if (strlen(out_record->tag_id) == 0 || strlen(out_record->bag_id) == 0 ||
            strlen(out_record->flight) == 0 || strlen(out_record->from) != 3 ||
            strlen(out_record->to) != 3 || strlen(out_record->status) == 0) {
            return SMARTTAG_ERR_FIELD_INVALID;
        }

        if (field_count >= 10 && strlen(fields[9]) >= 4) {
            out_record->crc16 = parse_hex4(fields[9]);
            out_record->has_crc = true;

            // Reconstruct canonical prefix up to rev to compute expected CRC
            // Find last pipe '|' in raw string
            const char *last_pipe = strrchr(raw, '|');
            if (last_pipe) {
                size_t prefix_len = (size_t)(last_pipe - raw);
                uint16_t expected_crc = smarttag_crc16_ccitt(raw, prefix_len);
                if (out_record->crc16 != expected_crc) {
                    return SMARTTAG_ERR_CRC_MISMATCH;
                }
            }
        }

        return SMARTTAG_OK;
    }

    // 2. Check for legacy PA1 format: PA1|0160892012|HKG-NRT|RECOVERY_IN_PROGRESS|...
    if (len >= 4 && strncmp(raw, "PA1|", 4) == 0) {
        char buffer[SMARTTAG_MAX_PAYLOAD_LEN + 1];
        memcpy(buffer, raw, len);
        buffer[len] = '\0';

        char *fields[6];
        int field_count = 0;
        char *ptr = buffer;

        while (ptr && *ptr && field_count < 6) {
            fields[field_count++] = ptr;
            char *next = strchr(ptr, '|');
            if (next) {
                *next = '\0';
                ptr = next + 1;
            } else {
                break;
            }
        }

        if (field_count >= 4) {
            out_record->version = 1;
            strcpy(out_record->tag_id, "ST-LEGACY");
            trim_and_copy(out_record->bag_id, fields[1], sizeof(out_record->bag_id));
            strcpy(out_record->flight, "CX548");

            // Split route e.g. "HKG-NRT"
            char *dash = strchr(fields[2], '-');
            if (dash) {
                *dash = '\0';
                trim_and_copy(out_record->from, fields[2], sizeof(out_record->from));
                trim_and_copy(out_record->to, dash + 1, sizeof(out_record->to));
            } else {
                strcpy(out_record->from, "HKG");
                strcpy(out_record->to, "NRT");
            }

            trim_and_copy(out_record->status, fields[3], sizeof(out_record->status));
            out_record->revision = 1;
            out_record->has_crc = false;
            return SMARTTAG_OK;
        }
    }

    return SMARTTAG_ERR_FORMAT;
}

SmartTagProgression smarttag_evaluate_progression(const SmartTagRecord *incoming, const SmartTagRecord *last_valid) {
    if (!last_valid) return PROG_NEW_REVISION;

    if (incoming->revision < last_valid->revision) {
        return PROG_STALE;
    }

    if (incoming->revision == last_valid->revision &&
        strcmp(incoming->tag_id, last_valid->tag_id) == 0 &&
        strcmp(incoming->bag_id, last_valid->bag_id) == 0 &&
        strcmp(incoming->flight, last_valid->flight) == 0 &&
        strcmp(incoming->from, last_valid->from) == 0 &&
        strcmp(incoming->to, last_valid->to) == 0 &&
        strcmp(incoming->status, last_valid->status) == 0) {
        return PROG_IDENTICAL;
    }

    return PROG_NEW_REVISION;
}

const char* smarttag_error_string(SmartTagParseResult res) {
    switch (res) {
        case SMARTTAG_OK: return "OK";
        case SMARTTAG_ERR_EMPTY: return "Payload is empty";
        case SMARTTAG_ERR_FORMAT: return "Invalid payload format";
        case SMARTTAG_ERR_VERSION: return "Unsupported protocol version";
        case SMARTTAG_ERR_FIELD_INVALID: return "Invalid field value";
        case SMARTTAG_ERR_CRC_MISMATCH: return "CRC16 checksum mismatch";
        case SMARTTAG_ERR_OVERSIZE: return "Payload exceeds size limit";
        case SMARTTAG_ERR_STALE_REVISION: return "Stale revision rejected";
        default: return "Unknown error";
    }
}

size_t smarttag_extract_text_from_ndef_message(
    const uint8_t *ndef_bytes,
    size_t ndef_len,
    char *out_text,
    size_t out_max
) {
    if (!ndef_bytes || ndef_len < 3 || !out_text || out_max < 2) return 0;

    size_t offset = 0;
    while (offset < ndef_len) {
        uint8_t header = ndef_bytes[offset++];
        bool me = (header & 0x40) != 0; // Message End
        bool sr = (header & 0x10) != 0; // Short Record
        bool il = (header & 0x08) != 0; // ID Length present
        uint8_t tnf = header & 0x07;

        if (offset >= ndef_len) break;
        uint8_t type_len = ndef_bytes[offset++];

        uint32_t payload_len = 0;
        if (sr) {
            if (offset >= ndef_len) break;
            payload_len = ndef_bytes[offset++];
        } else {
            if (offset + 4 > ndef_len) break;
            payload_len = ((uint32_t)ndef_bytes[offset] << 24) |
                          ((uint32_t)ndef_bytes[offset + 1] << 16) |
                          ((uint32_t)ndef_bytes[offset + 2] << 8) |
                          (uint32_t)ndef_bytes[offset + 3];
            offset += 4;
        }

        uint8_t id_len = 0;
        if (il) {
            if (offset >= ndef_len) break;
            id_len = ndef_bytes[offset++];
        }

        if (offset + type_len + id_len + payload_len > ndef_len) {
            break; // Truncated or malformed record
        }

        const uint8_t *type_ptr = ndef_bytes + offset;
        offset += type_len;
        offset += id_len;
        const uint8_t *payload_ptr = ndef_bytes + offset;
        offset += payload_len;

        // Check for Well-Known Type (TNF=0x01) + RTD_TEXT ('T' = 0x54)
        if (tnf == 0x01 && type_len == 1 && type_ptr[0] == 'T' && payload_len >= 1) {
            uint8_t status_byte = payload_ptr[0];
            uint8_t lang_len = status_byte & 0x3F;
            if ((size_t)(1 + lang_len) <= payload_len) {
                size_t text_len = payload_len - 1 - lang_len;
                size_t copy_len = (text_len < out_max - 1) ? text_len : (out_max - 1);
                memcpy(out_text, payload_ptr + 1 + lang_len, copy_len);
                out_text[copy_len] = '\0';
                return copy_len;
            }
        }

        if (me) break;
    }

    return 0;
}

size_t smarttag_extract_text_from_type2_tlv(
    const uint8_t *user_mem,
    size_t mem_len,
    char *out_text,
    size_t out_max
) {
    if (!user_mem || mem_len < 3 || !out_text || out_max < 2) return 0;

    size_t idx = 0;
    while (idx < mem_len) {
        uint8_t tag = user_mem[idx++];
        if (tag == 0x00) {
            continue; // NULL TLV
        }
        if (tag == 0xFE) {
            break; // Terminator TLV
        }
        if (idx >= mem_len) break;

        size_t len = user_mem[idx++];
        if (len == 0xFF) {
            if (idx + 2 > mem_len) break;
            len = ((size_t)user_mem[idx] << 8) | (size_t)user_mem[idx + 1];
            idx += 2;
        }

        if (idx + len > mem_len) {
            break; // Truncated TLV
        }

        if (tag == 0x03) {
            // NDEF Message TLV found
            size_t extracted = smarttag_extract_text_from_ndef_message(
                user_mem + idx,
                len,
                out_text,
                out_max
            );
            if (extracted > 0) return extracted;
        }

        idx += len;
    }

    return 0;
}
