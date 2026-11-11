/**
 * PolyAero Cathay SmartTag — NFC Baggage Payload Protocol (PA2)
 *
 * Compact, versioned, PII-free payload representation shared between
 * the mobile Android application and the ESP32-C6 firmware parser.
 *
 * Design constraints:
 * 1. Must fit within NTAG213 usable NDEF capacity (<= 137 bytes).
 * 2. Strict PII boundary: No passenger names, phone numbers, passport info,
 *    full booking records, or authentication tokens.
 * 3. Fast deterministic parsing in embedded C++ (Arduino / ESP-IDF) and TypeScript.
 * 4. Error detection via CRC-16-CCITT checksum over canonical payload fields.
 * 5. Monotonic revision counter to prevent stale or duplicate display refreshes.
 */

export interface SmartTagNfcRecord {
  /** Protocol version (currently 1) */
  v: number;
  /** Permanent reusable SmartTag device ID, e.g. "ST-2048" */
  tagId: string;
  /** 10-digit IATA baggage license plate or display bag code, e.g. "0160123456" */
  bagId: string;
  /** Flight number, e.g. "CX548" */
  flight: string;
  /** 3-letter IATA departure airport, e.g. "HKG" */
  from: string;
  /** 3-letter IATA destination airport, e.g. "NRT" */
  to: string;
  /** Baggage operational status code, e.g. "TAGGED", "LOADED", "RECOVERY_IN_PROGRESS" */
  status: string;
  /** Monotonic payload revision counter */
  rev: number;
  /** 4-character hex CRC-16 checksum */
  crc?: string;
}

export const CURRENT_NFC_PROTOCOL_VERSION = 1;
export const MAX_NFC_PAYLOAD_BYTES = 130;

/**
 * Calculates CRC-16-CCITT (poly 0x1021, init 0xFFFF, no reflect, no xorout).
 */
export function calculateCrc16Ccitt(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= (data.charCodeAt(i) & 0xff) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc & 0xffff;
}

export function formatCrc16(crc: number): string {
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export class NfcProtocolError extends Error {
  public readonly code:
    | 'UNSUPPORTED_VERSION'
    | 'MALFORMED_PAYLOAD'
    | 'PAYLOAD_OVERSIZE'
    | 'INVALID_FIELD'
    | 'CRC_MISMATCH'
    | 'STALE_REVISION';

  constructor(
    message: string,
    code:
      | 'UNSUPPORTED_VERSION'
      | 'MALFORMED_PAYLOAD'
      | 'PAYLOAD_OVERSIZE'
      | 'INVALID_FIELD'
      | 'CRC_MISMATCH'
      | 'STALE_REVISION'
  ) {
    super(message);
    this.name = 'NfcProtocolError';
    this.code = code;
  }
}

/**
 * Builds canonical text before CRC attachment:
 * `PA2|<v>|<tagId>|<bagId>|<flight>|<from>|<to>|<status>|<rev>`
 */
export function buildCanonicalPayloadString(record: Omit<SmartTagNfcRecord, 'crc'>): string {
  const cleanTagId = record.tagId.trim().toUpperCase();
  const cleanBagId = record.bagId.trim().toUpperCase();
  const cleanFlight = record.flight.trim().toUpperCase();
  const cleanFrom = record.from.trim().toUpperCase();
  const cleanTo = record.to.trim().toUpperCase();
  const cleanStatus = record.status.trim().toUpperCase().replace(/\s+/g, '_');

  return [
    'PA2',
    record.v,
    cleanTagId,
    cleanBagId,
    cleanFlight,
    cleanFrom,
    cleanTo,
    cleanStatus,
    record.rev,
  ].join('|');
}

/**
 * Encodes a SmartTagNfcRecord into canonical delimited string with CRC.
 * e.g. "PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|7B3A"
 */
export function encodeNfcRecord(record: SmartTagNfcRecord): string {
  validateNfcRecordFields(record);
  const canonical = buildCanonicalPayloadString(record);
  const crc = calculateCrc16Ccitt(canonical);
  const full = `${canonical}|${formatCrc16(crc)}`;

  if (full.length > MAX_NFC_PAYLOAD_BYTES) {
    throw new NfcProtocolError(
      `Encoded NFC payload (${full.length} bytes) exceeds maximum tag limit (${MAX_NFC_PAYLOAD_BYTES} bytes).`,
      'PAYLOAD_OVERSIZE'
    );
  }

  return full;
}

/**
 * Encodes record into compact JSON format with CRC.
 */
export function encodeNfcRecordJson(record: SmartTagNfcRecord): string {
  validateNfcRecordFields(record);
  const canonical = buildCanonicalPayloadString(record);
  const crc = formatCrc16(calculateCrc16Ccitt(canonical));
  const obj: SmartTagNfcRecord = {
    v: record.v,
    tagId: record.tagId.trim().toUpperCase(),
    bagId: record.bagId.trim().toUpperCase(),
    flight: record.flight.trim().toUpperCase(),
    from: record.from.trim().toUpperCase(),
    to: record.to.trim().toUpperCase(),
    status: record.status.trim().toUpperCase().replace(/\s+/g, '_'),
    rev: record.rev,
    crc,
  };
  const jsonStr = JSON.stringify(obj);
  if (jsonStr.length > MAX_NFC_PAYLOAD_BYTES) {
    throw new NfcProtocolError(
      `Encoded JSON payload (${jsonStr.length} bytes) exceeds tag limit (${MAX_NFC_PAYLOAD_BYTES} bytes).`,
      'PAYLOAD_OVERSIZE'
    );
  }
  return jsonStr;
}

/**
 * Validates whether a string is a standard 10-digit IATA baggage license plate
 * compliant with IATA Resolution 740/753 and Interleaved 2 of 5 barcode symbology.
 */
export function isValidIataBaggageLicensePlate(bagId: string): boolean {
  if (!bagId) return false;
  return /^\d{10}$/.test(bagId.trim());
}

/**
 * Resolves a canonical 10-digit IATA baggage license plate from available baggage fields.
 * Throws NfcProtocolError if no valid 10-digit numeric identifier is available.
 */
export function canonicalizeBaggageLicensePlate(
  candidateId: string,
  baggageTagNumber?: string
): string {
  if (baggageTagNumber && isValidIataBaggageLicensePlate(baggageTagNumber)) {
    return baggageTagNumber.trim();
  }
  if (candidateId && isValidIataBaggageLicensePlate(candidateId)) {
    return candidateId.trim();
  }
  throw new NfcProtocolError(
    `Baggage identifier "${candidateId || baggageTagNumber}" is invalid. ` +
      'Must be exactly 10 numeric digits compliant with IATA Resolution 740/753 for E-paper barcode rendering.',
    'INVALID_FIELD'
  );
}

/**
 * Validates individual fields strictly.
 */
export function validateNfcRecordFields(record: Partial<SmartTagNfcRecord>): void {
  if (record.v === undefined || record.v !== CURRENT_NFC_PROTOCOL_VERSION) {
    throw new NfcProtocolError(
      `Unsupported protocol version ${record.v}; expected ${CURRENT_NFC_PROTOCOL_VERSION}.`,
      'UNSUPPORTED_VERSION'
    );
  }

  if (!record.tagId || !/^[A-Z0-9_-]{3,16}$/i.test(record.tagId.trim())) {
    throw new NfcProtocolError(
      `Invalid tagId "${record.tagId}"; must be 3-16 alphanumeric characters.`,
      'INVALID_FIELD'
    );
  }

  if (!record.bagId || !isValidIataBaggageLicensePlate(record.bagId)) {
    throw new NfcProtocolError(
      `Invalid bagId "${record.bagId}"; must be exactly 10 numeric digits for IATA Interleaved 2 of 5 barcode compliance.`,
      'INVALID_FIELD'
    );
  }

  if (!record.flight || !/^[A-Z0-9]{2,7}$/i.test(record.flight.trim())) {
    throw new NfcProtocolError(
      `Invalid flight "${record.flight}"; must be 2-7 characters.`,
      'INVALID_FIELD'
    );
  }

  if (!record.from || !/^[A-Z]{3}$/i.test(record.from.trim())) {
    throw new NfcProtocolError(
      `Invalid origin airport "${record.from}"; must be 3-letter IATA code.`,
      'INVALID_FIELD'
    );
  }

  if (!record.to || !/^[A-Z]{3}$/i.test(record.to.trim())) {
    throw new NfcProtocolError(
      `Invalid destination airport "${record.to}"; must be 3-letter IATA code.`,
      'INVALID_FIELD'
    );
  }

  if (!record.status || record.status.trim().length === 0) {
    throw new NfcProtocolError('Status field cannot be empty.', 'INVALID_FIELD');
  }

  if (
    record.rev === undefined ||
    typeof record.rev !== 'number' ||
    record.rev < 0 ||
    record.rev > 4294967295 ||
    !Number.isInteger(record.rev)
  ) {
    throw new NfcProtocolError(
      `Invalid revision ${record.rev}; must be a non-negative 32-bit integer.`,
      'INVALID_FIELD'
    );
  }
}

/**
 * Decodes any supported NFC tag payload string (PA2 delimited, JSON, or legacy PA1).
 */
export function decodeNfcRecord(raw: string): SmartTagNfcRecord {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new NfcProtocolError('Empty payload string received.', 'MALFORMED_PAYLOAD');
  }

  // 1. JSON Format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new NfcProtocolError('Malformed JSON payload.', 'MALFORMED_PAYLOAD');
    }

    const candidate: SmartTagNfcRecord = {
      v: Number(parsed.v),
      tagId: String(parsed.tagId ?? ''),
      bagId: String(parsed.bagId ?? ''),
      flight: String(parsed.flight ?? ''),
      from: String(parsed.from ?? ''),
      to: String(parsed.to ?? ''),
      status: String(parsed.status ?? ''),
      rev: Number(parsed.rev ?? 0),
      crc: parsed.crc ? String(parsed.crc) : undefined,
    };
    validateNfcRecordFields(candidate);

    if (candidate.crc) {
      const canonical = buildCanonicalPayloadString(candidate);
      const expectedCrc = formatCrc16(calculateCrc16Ccitt(canonical));
      if (candidate.crc.toUpperCase() !== expectedCrc) {
        throw new NfcProtocolError(
          `Payload CRC mismatch: got ${candidate.crc}, expected ${expectedCrc}.`,
          'CRC_MISMATCH'
        );
      }
    }

    return candidate;
  }

  // 2. Canonical PA2 Pipe-Delimited Format
  if (trimmed.startsWith('PA2|')) {
    const parts = trimmed.split('|');
    if (parts.length < 9 || parts.length > 10) {
      throw new NfcProtocolError(
        `Malformed PA2 payload: expected 9 or 10 pipe-delimited fields, got ${parts.length}.`,
        'MALFORMED_PAYLOAD'
      );
    }

    const [header, vStr, tagId, bagId, flight, from, to, status, revStr, crcHex] = parts;
    if (header !== 'PA2') {
      throw new NfcProtocolError(`Invalid header "${header}".`, 'MALFORMED_PAYLOAD');
    }

    if (!/^\d+$/.test(vStr.trim())) {
      throw new NfcProtocolError(`Invalid protocol version "${vStr}".`, 'UNSUPPORTED_VERSION');
    }

    if (!/^\d+$/.test(revStr.trim())) {
      throw new NfcProtocolError(`Invalid revision "${revStr}"; must be a non-negative integer.`, 'INVALID_FIELD');
    }

    const crcClean = crcHex !== undefined ? crcHex.trim().toUpperCase() : undefined;
    if (crcClean !== undefined && !/^[0-9A-F]{4}$/.test(crcClean)) {
      throw new NfcProtocolError(
        `Malformed CRC checksum "${crcHex}"; expected 4 uppercase hex characters.`,
        'CRC_MISMATCH'
      );
    }

    const candidate: SmartTagNfcRecord = {
      v: Number(vStr.trim()),
      tagId,
      bagId,
      flight,
      from,
      to,
      status,
      rev: Number(revStr.trim()),
      crc: crcClean,
    };
    validateNfcRecordFields(candidate);

    if (candidate.crc) {
      const canonical = parts.slice(0, 9).join('|');
      const expectedCrc = formatCrc16(calculateCrc16Ccitt(canonical));
      if (candidate.crc !== expectedCrc) {
        throw new NfcProtocolError(
          `Payload CRC mismatch: got ${candidate.crc}, expected ${expectedCrc}.`,
          'CRC_MISMATCH'
        );
      }
    }

    return candidate;
  }

  // 3. Backward Compatibility: PA1 Staff Web NFC Format
  // e.g. "PA1|0160892012|HKG-NRT|RECOVERY_IN_PROGRESS|2026-11-10 14:20Z"
  if (trimmed.startsWith('PA1|')) {
    const parts = trimmed.split('|');
    if (parts.length >= 4) {
      const [, bagId, route, status] = parts;
      const [from = 'HKG', to = 'NRT'] = (route || 'HKG-NRT').split(/[-→]/);
      const legacyCandidate: SmartTagNfcRecord = {
        v: 1,
        tagId: 'ST-LEGACY',
        bagId: bagId.trim(),
        flight: 'CX548',
        from: from.trim().toUpperCase().slice(0, 3) || 'HKG',
        to: to.trim().toUpperCase().slice(0, 3) || 'NRT',
        status: status.trim().toUpperCase() || 'TAGGED',
        rev: 1,
      };
      validateNfcRecordFields(legacyCandidate);
      return legacyCandidate;
    }
  }

  throw new NfcProtocolError(
    `Unsupported NFC payload format: "${trimmed.slice(0, 20)}...".`,
    'MALFORMED_PAYLOAD'
  );
}

/**
 * Checks whether an incoming payload is a duplicate or stale revision.
 * Returns:
 * - 'IDENTICAL': Same revision and same content (suppress E-paper refresh).
 * - 'NEW_REVISION': Greater revision or fresh tag (refresh E-paper).
 * - 'STALE': Lower revision than last verified payload (reject/ignore).
 */
export function evaluatePayloadProgression(
  incoming: SmartTagNfcRecord,
  lastValid: SmartTagNfcRecord | null
): 'IDENTICAL' | 'NEW_REVISION' | 'STALE' {
  if (!lastValid) return 'NEW_REVISION';

  if (incoming.rev < lastValid.rev) {
    return 'STALE';
  }

  if (
    incoming.rev === lastValid.rev &&
    incoming.tagId === lastValid.tagId &&
    incoming.bagId === lastValid.bagId &&
    incoming.flight === lastValid.flight &&
    incoming.from === lastValid.from &&
    incoming.to === lastValid.to &&
    incoming.status === lastValid.status
  ) {
    return 'IDENTICAL';
  }

  // Same revision with mismatched content is a stale/conflicting reuse; reject!
  if (incoming.rev <= lastValid.rev) {
    return 'STALE';
  }

  return 'NEW_REVISION';
}
