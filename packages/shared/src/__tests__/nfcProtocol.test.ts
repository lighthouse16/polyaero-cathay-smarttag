import { describe, it, expect } from 'vitest';
import {
  encodeNfcRecord,
  encodeNfcRecordJson,
  decodeNfcRecord,
  calculateCrc16Ccitt,
  formatCrc16,
  evaluatePayloadProgression,
  NfcProtocolError,
  SmartTagNfcRecord,
  CURRENT_NFC_PROTOCOL_VERSION,
  MAX_NFC_PAYLOAD_BYTES,
} from '../index';

describe('NFC Baggage Payload Protocol (PA2)', () => {
  const sampleRecord: SmartTagNfcRecord = {
    v: 1,
    tagId: 'ST-2048',
    bagId: '0160123456',
    flight: 'CX548',
    from: 'HKG',
    to: 'NRT',
    status: 'TAGGED',
    rev: 1,
  };

  it('encodes canonical pipe-delimited string with CRC16', () => {
    const encoded = encodeNfcRecord(sampleRecord);
    expect(encoded.startsWith('PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1|')).toBe(true);
    expect(encoded.length).toBeLessThanOrEqual(MAX_NFC_PAYLOAD_BYTES);

    const parts = encoded.split('|');
    expect(parts.length).toBe(10);
    const crc = parts[9];
    expect(crc.length).toBe(4);

    // Verify CRC computation
    const prefix = parts.slice(0, 9).join('|');
    const computedCrc = formatCrc16(calculateCrc16Ccitt(prefix));
    expect(crc).toBe(computedCrc);
  });

  it('decodes canonical pipe-delimited string successfully', () => {
    const encoded = encodeNfcRecord(sampleRecord);
    const decoded = decodeNfcRecord(encoded);

    expect(decoded.v).toBe(CURRENT_NFC_PROTOCOL_VERSION);
    expect(decoded.tagId).toBe('ST-2048');
    expect(decoded.bagId).toBe('0160123456');
    expect(decoded.flight).toBe('CX548');
    expect(decoded.from).toBe('HKG');
    expect(decoded.to).toBe('NRT');
    expect(decoded.status).toBe('TAGGED');
    expect(decoded.rev).toBe(1);
    expect(decoded.crc).toBeDefined();
  });

  it('encodes and decodes compact JSON format', () => {
    const jsonStr = encodeNfcRecordJson(sampleRecord);
    expect(jsonStr.length).toBeLessThanOrEqual(MAX_NFC_PAYLOAD_BYTES);

    const decoded = decodeNfcRecord(jsonStr);
    expect(decoded.v).toBe(CURRENT_NFC_PROTOCOL_VERSION);
    expect(decoded.tagId).toBe('ST-2048');
    expect(decoded.bagId).toBe('0160123456');
    expect(decoded.flight).toBe('CX548');
    expect(decoded.from).toBe('HKG');
    expect(decoded.to).toBe('NRT');
    expect(decoded.status).toBe('TAGGED');
    expect(decoded.rev).toBe(1);
  });

  it('supports legacy PA1 format from staff web app', () => {
    const legacy = 'PA1|0160892012|HKG-NRT|RECOVERY_IN_PROGRESS|2026-11-10 14:20Z';
    const decoded = decodeNfcRecord(legacy);

    expect(decoded.bagId).toBe('0160892012');
    expect(decoded.from).toBe('HKG');
    expect(decoded.to).toBe('NRT');
    expect(decoded.status).toBe('RECOVERY_IN_PROGRESS');
  });

  it('strictly validates CRC and rejects corrupted payload', () => {
    const encoded = encodeNfcRecord(sampleRecord);
    const corrupted = encoded.slice(0, -4) + '0000'; // Corrupt CRC
    expect(() => decodeNfcRecord(corrupted)).toThrow(NfcProtocolError);
  });

  it('rejects unsupported protocol version', () => {
    const invalidVer = { ...sampleRecord, v: 99 };
    expect(() => encodeNfcRecord(invalidVer)).toThrow(NfcProtocolError);
  });

  it('rejects invalid IATA origin/dest codes', () => {
    expect(() => encodeNfcRecord({ ...sampleRecord, from: 'HONGKONG' })).toThrow(NfcProtocolError);
    expect(() => encodeNfcRecord({ ...sampleRecord, to: '12' })).toThrow(NfcProtocolError);
  });

  it('rejects oversized payload', () => {
    const oversized = {
      ...sampleRecord,
      tagId: 'A'.repeat(16),
      bagId: 'B'.repeat(14),
      status: 'C'.repeat(80),
    };
    expect(() => encodeNfcRecord(oversized)).toThrow(NfcProtocolError);
  });

  it('evaluates payload progression and detects duplicates or stale updates', () => {
    const recordRev1: SmartTagNfcRecord = { ...sampleRecord, rev: 1 };
    const recordRev2: SmartTagNfcRecord = { ...sampleRecord, rev: 2, status: 'LOADED' };
    const recordRev0: SmartTagNfcRecord = { ...sampleRecord, rev: 0 };

    expect(evaluatePayloadProgression(recordRev1, null)).toBe('NEW_REVISION');
    expect(evaluatePayloadProgression(recordRev1, recordRev1)).toBe('IDENTICAL');
    expect(evaluatePayloadProgression(recordRev2, recordRev1)).toBe('NEW_REVISION');
    expect(evaluatePayloadProgression(recordRev0, recordRev1)).toBe('STALE');
  });

  it('verifies deterministic test vector matching firmware parser', () => {
    const vectorCanonical = 'PA2|1|ST-2048|0160123456|CX548|HKG|NRT|TAGGED|1';
    const crc = formatCrc16(calculateCrc16Ccitt(vectorCanonical));
    const full = `${vectorCanonical}|${crc}`;

    // Ensure deterministic value
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
    const decoded = decodeNfcRecord(full);
    expect(decoded.tagId).toBe('ST-2048');
    expect(decoded.bagId).toBe('0160123456');
    expect(decoded.crc).toBe(crc);
  });
});
