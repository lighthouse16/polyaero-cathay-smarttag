import NfcManager, {
  NfcTech,
  Ndef,
  NfcAdapter,
  NfcError as NativeNfcError,
} from 'react-native-nfc-manager';
import { Platform } from 'react-native';
import {
  INfcService,
  SmartTagPayload,
  SmartTagScanResult,
  SmartTagWriteResult,
  NfcError,
  NfcDisabledError,
  NfcUnavailableError,
  NfcTimeoutError,
  NfcCancelledError,
  NfcWriteError,
  NfcWrongTagError,
  NfcOperationInProgressError,
} from '@polyaero/shared';

import { formatNfcHexUid } from './nfcTapBridge';

type SessionProtocol = 'PA1' | 'TYPE4A_NDEF';
type Session = {
  cancelled: boolean;
  protocol?: SessionProtocol;
  tagUid?: string;
  maxNdefBytes?: number;
  maxWriteChunk?: number;
};

const SELECT_APPLICATION = [
  0x00, 0xa4, 0x04, 0x00, 0x07, 0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00,
];
const SELECT_APPLICATION_NO_LE = SELECT_APPLICATION.slice(0, -1);
const SELECT_CC = [0x00, 0xa4, 0x00, 0x0c, 0x02, 0xe1, 0x03];
const READ_CC = [0x00, 0xb0, 0x00, 0x00, 0x0f];
const SELECT_NDEF = [0x00, 0xa4, 0x00, 0x0c, 0x02, 0xe1, 0x04];
const UNSUPPORTED_PA1_STATUSES = new Set([
  '6D00',
  '6E00',
  '6A81',
  '6A82',
  '6A86',
  '6881',
  '6F00',
]);
const IATA_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;
const AIRPORT_CITY_MAP: Record<string, string> = {
  HKG: 'HONG KONG',
  NRT: 'TOKYO',
  HND: 'TOKYO',
  KIX: 'OSAKA',
  SGN: 'HO CHI MINH',
  HAN: 'HANOI',
  SIN: 'SINGAPORE',
  TPE: 'TAIPEI',
  ICN: 'SEOUL',
  BKK: 'BANGKOK',
  LHR: 'LONDON',
  LAX: 'LOS ANGELES',
  JFK: 'NEW YORK',
  YVR: 'VANCOUVER',
  SYD: 'SYDNEY',
  PVG: 'SHANGHAI',
  PEK: 'BEIJING',
};

function formatIataDate(isoOrShort: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoOrShort.trim());
  if (match) {
    const monthIdx = Number(match[2]) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${match[3]}${IATA_MONTHS[monthIdx]}`;
    }
  }
  return isoOrShort.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 7) || 'TODAY';
}

function buildPipeDelimitedPayload(payload: SmartTagPayload): string {
  const dest = payload.destinationAirport.trim().toUpperCase();
  const city = AIRPORT_CITY_MAP[dest] ?? dest;
  const flight = payload.flightNumber.replace(/\|/g, ' ').trim().toUpperCase();
  const date = formatIataDate(payload.departureDate);
  const passenger = payload.passengerInitials.replace(/\|/g, ' ').trim().toUpperCase() || 'PAX';
  return `${payload.baggageTagNumber}|${dest}|${city}|${flight}|${date}|0840|${passenger}`;
}

export class NativeNfcService implements INfcService {
  private initialized = false;
  private session: Session | null = null;
  private busy = false;
  private cancelOperation: (() => void) | null = null;

  isSessionBusy(): boolean {
    return this.busy || this.session !== null;
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    try {
      await NfcManager.start();
      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!(await this.initialize())) return false;
    try {
      return await NfcManager.isSupported(NfcTech.IsoDep);
    } catch {
      return false;
    }
  }

  async isEnabled(): Promise<boolean> {
    if (!(await this.initialize())) return false;
    return Platform.OS === 'ios' || NfcManager.isEnabled();
  }

  private formatStatusError(operation: string, status: string): string {
    const detail =
      status === '6581'
        ? 'The display refresh was not confirmed.'
        : 'The bridge rejected the command; check the firmware and app protocol match.';
    return `${operation}: SmartTag returned ${status}. ${detail}`;
  }

  private async exchangeRaw(
    session: Session,
    command: number[],
    operation: string,
  ): Promise<{ data: number[]; status: string }> {
    if (session.cancelled) throw new NfcCancelledError();
    const response = await NfcManager.isoDepHandler.transceive(command);
    if (session.cancelled) throw new NfcCancelledError();
    if (response.length < 2) {
      throw new NfcWriteError(
        `${operation}: the bridge returned an incomplete NFC response.`,
      );
    }
    const status = response
      .slice(-2)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    return { data: response.slice(0, -2), status };
  }

  private async exchange(
    session: Session,
    command: number[],
    operation: string,
  ): Promise<number[]> {
    const { data, status } = await this.exchangeRaw(session, command, operation);
    if (status !== '9000') {
      throw new NfcWriteError(this.formatStatusError(operation, status));
    }
    return data;
  }

  private async selectNdefApplication(session: Session): Promise<void> {
    const first = await this.exchangeRaw(
      session,
      SELECT_APPLICATION,
      'Selecting SmartTag application',
    );
    if (first.status === '9000') return;
    if (first.status === '6700') {
      await this.exchange(
        session,
        SELECT_APPLICATION_NO_LE,
        'Selecting SmartTag application',
      );
      return;
    }
    throw new NfcWriteError(
      this.formatStatusError('Selecting SmartTag application', first.status),
    );
  }

  private async writeBinary(
    session: Session,
    offset: number,
    bytes: number[],
  ): Promise<void> {
    await this.exchange(
      session,
      [0x00, 0xd6, offset >> 8, offset & 0xff, bytes.length, ...bytes],
      'Writing baggage data',
    );
  }

  private async writeBinaryChunks(
    session: Session,
    startOffset: number,
    bytes: number[],
    chunkSize = 48,
  ): Promise<void> {
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      await this.writeBinary(
        session,
        startOffset + offset,
        bytes.slice(offset, offset + chunkSize),
      );
    }
  }

  private async readBinaryChunks(
    session: Session,
    startOffset: number,
    totalLength: number,
    chunkSize: number,
    operation: string,
  ): Promise<number[]> {
    const readback: number[] = [];
    for (let offset = 0; offset < totalLength; offset += chunkSize) {
      const addr = startOffset + offset;
      readback.push(
        ...(await this.exchange(
          session,
          [
            0x00,
            0xb0,
            addr >> 8,
            addr & 0xff,
            Math.min(chunkSize, totalLength - offset),
          ],
          operation,
        )),
      );
    }
    return readback;
  }

  private assertBytesMatch(actual: number[], expected: number[]): void {
    if (
      actual.length !== expected.length ||
      actual.some((byte, index) => byte !== expected[index])
    ) {
      throw new NfcWriteError(
        'The SmartTag payload readback did not match the written baggage details.',
      );
    }
  }

  private async configureType4FallbackSession(
    session: Session,
  ): Promise<SmartTagScanResult> {
    await this.exchange(session, SELECT_CC, 'Selecting Capability Container');
    const cc = await this.exchange(session, READ_CC, 'Reading Capability Container');

    let maxWriteChunk = 48;
    if (cc.length >= 7) {
      const mlc = (cc[5] << 8) | cc[6];
      if (mlc >= 16) maxWriteChunk = Math.min(48, mlc);
    }
    const ndefMarkerIdx = cc.findIndex(
      (byte, idx) => byte === 0xe1 && cc[idx + 1] === 0x04,
    );
    if (ndefMarkerIdx === -1) {
      throw new NfcWriteError(
        'This tag is not a compatible SmartTag NDEF target.',
      );
    }
    let maxNdefBytes = 255;
    if (ndefMarkerIdx + 3 < cc.length) {
      const advertised = (cc[ndefMarkerIdx + 2] << 8) | cc[ndefMarkerIdx + 3];
      if (advertised >= 64) maxNdefBytes = Math.min(512, advertised);
    }

    await this.exchange(session, SELECT_NDEF, 'Selecting baggage data file');
    const tagInfo =
      typeof NfcManager.getTag === 'function'
        ? await NfcManager.getTag().catch(() => null)
        : null;
    const detectedUid = formatNfcHexUid(tagInfo?.id) ?? 'PN532-TYPE4A';

    session.protocol = 'TYPE4A_NDEF';
    session.tagUid = detectedUid;
    session.maxNdefBytes = maxNdefBytes;
    session.maxWriteChunk = maxWriteChunk;
    return { tagUid: detectedUid, isMockSimulation: false };
  }

  private async operate<T>(
    task: (session: Session) => Promise<T>,
    timeoutMs: number,
    keepSession = false,
  ): Promise<T> {
    if (this.busy) throw new NfcOperationInProgressError();
    const session = this.session ?? { cancelled: false };
    this.session = session;
    this.busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const interrupted = new Promise<never>((_, reject) => {
        this.cancelOperation = () => {
          session.cancelled = true;
          reject(new NfcCancelledError());
        };
        timer = setTimeout(() => {
          session.cancelled = true;
          reject(new NfcTimeoutError());
        }, timeoutMs);
      });
      return await Promise.race([task(session), interrupted]);
    } catch (error) {
      session.cancelled = true;
      if (error instanceof NfcError) throw error;
      if (error instanceof NativeNfcError.UserCancel)
        throw new NfcCancelledError();
      if (error instanceof NativeNfcError.Timeout) throw new NfcTimeoutError();
      if (error instanceof NativeNfcError.RadioDisabled)
        throw new NfcDisabledError();
      throw new NfcWriteError(
        error instanceof Error ? error.message : 'NFC communication failed.',
      );
    } finally {
      clearTimeout(timer);
      this.cancelOperation = null;
      if (!keepSession || session.cancelled) {
        await NfcManager.cancelTechnologyRequest().catch(() => {});
        if (this.session === session) this.session = null;
      }
      this.busy = false;
    }
  }

  async readTagUid(timeoutMs = 20000): Promise<SmartTagScanResult> {
    if (this.busy || this.session) throw new NfcOperationInProgressError();
    if (!(await this.isAvailable())) throw new NfcUnavailableError();
    if (!(await this.isEnabled())) throw new NfcDisabledError();

    return this.operate(
      async (session) => {
        await NfcManager.requestTechnology(NfcTech.IsoDep, {
          alertMessage:
            'Hold your phone against the SmartTag until its display is verified.',
          isReaderModeEnabled: true,
          readerModeFlags:
            NfcAdapter.FLAG_READER_NFC_A |
            NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
          // Match NFCGate's default Android presence-check interval.
          readerModeDelay: 750,
        });
        if (session.cancelled) throw new NfcCancelledError();
        if (Platform.OS === 'android') await NfcManager.setTimeout(10000);
        await this.selectNdefApplication(session);

        const probe = await this.exchangeRaw(
          session,
          [0x80, 0x10, 0x00, 0x00, 0x00],
          'Reading SmartTag identity',
        );
        if (probe.status === '9000') {
          const identity = String.fromCharCode(...probe.data);
          if (!/^PA1\|(?:[0-9A-F]{2}:){6}[0-9A-F]{2}$/.test(identity)) {
            throw new NfcWriteError(
              'This tag is not a compatible MicroPython SmartTag bridge.',
            );
          }
          const uid = identity.slice(4);
          session.protocol = 'PA1';
          session.tagUid = uid;
          // PN532 emulates a short RF UID; the bridge supplies its configured SmartTag identity.
          return { tagUid: uid, isMockSimulation: false };
        }

        if (UNSUPPORTED_PA1_STATUSES.has(probe.status)) {
          return this.configureType4FallbackSession(session);
        }

        throw new NfcWriteError(
          this.formatStatusError('Reading SmartTag identity', probe.status),
        );
      },
      timeoutMs,
      true,
    );
  }

  private async writePa1Display(
    session: Session,
    payload: SmartTagPayload,
  ): Promise<SmartTagWriteResult> {
    const identity = String.fromCharCode(
      ...(await this.exchange(
        session,
        [0x80, 0x10, 0x00, 0x00, 0x00],
        'Checking SmartTag identity',
      )),
    ).slice(4);
    if (identity !== payload.tagUid.toUpperCase())
      throw new NfcWrongTagError(payload.tagUid, identity);
    const syncId = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
    const text = JSON.stringify({
      v: 1,
      tag: payload.baggageTagNumber,
      tag_code: identity,
      flight: payload.flightNumber,
      route: `${payload.originAirport}-${payload.destinationAirport}`,
      passenger: payload.passengerInitials,
      date: payload.departureDate,
      status: 'TAGGED',
      sync_id: syncId,
    });
    const message = Ndef.encodeMessage([Ndef.textRecord(text)]);
    if (!message || message.length > 510)
      throw new NfcWriteError('Baggage payload exceeds the bridge capacity.');

    await this.exchange(session, SELECT_NDEF, 'Selecting baggage data file');
    await this.writeBinary(session, 0, [0, 0]);
    await this.writeBinaryChunks(session, 2, message, 48);
    await this.writeBinary(session, 0, [message.length >> 8, message.length & 0xff]);

    // Firmware emits this receipt only after rendering and waiting for the panel BUSY pin.
    const receipt = String.fromCharCode(
      ...(await this.exchange(
        session,
        [0x80, 0x11, 0x00, 0x00, 0x00],
        'Confirming display refresh',
      )),
    );
    if (receipt !== `PA1|${syncId}`)
      throw new NfcWriteError(
        'The display returned a stale or missing refresh receipt.',
      );
    const expected = [message.length >> 8, message.length & 0xff, ...message];
    const readback = await this.readBinaryChunks(
      session,
      0,
      expected.length,
      48,
      'Verifying baggage readback',
    );
    this.assertBytesMatch(readback, expected);
    return {
      success: true,
      tagUid: identity,
      bytesWritten: message.length,
      timestamp: new Date().toISOString(),
      isMockSimulation: false,
      verifiedReadback: true,
    };
  }

  private async writeType4FallbackDisplay(
    session: Session,
    payload: SmartTagPayload,
  ): Promise<SmartTagWriteResult> {
    const activeUid = (session.tagUid ?? '').toUpperCase();
    if (activeUid !== payload.tagUid.toUpperCase()) {
      throw new NfcWrongTagError(payload.tagUid, activeUid);
    }
    const pipeText = buildPipeDelimitedPayload(payload);
    const message = Ndef.encodeMessage([Ndef.textRecord(pipeText)]);
    const capacity = (session.maxNdefBytes ?? 255) - 2;
    if (!message || message.length > capacity) {
      throw new NfcWriteError('Baggage payload exceeds the bridge capacity.');
    }

    const chunkSize = session.maxWriteChunk ?? 48;
    await this.exchange(session, SELECT_NDEF, 'Selecting baggage data file');
    await this.writeBinary(session, 0, [0, 0]);
    await this.writeBinaryChunks(session, 2, message, chunkSize);

    // Pre-commit readback runs before writing NLEN because Type-4A targets exit listen() upon NLEN commit.
    const readback = await this.readBinaryChunks(
      session,
      2,
      message.length,
      chunkSize,
      'Verifying baggage readback',
    );
    this.assertBytesMatch(readback, message);
    await this.writeBinary(session, 0, [message.length >> 8, message.length & 0xff]);

    return {
      success: true,
      tagUid: activeUid,
      bytesWritten: message.length,
      timestamp: new Date().toISOString(),
      isMockSimulation: false,
      verifiedReadback: true,
    };
  }

  async writeEinkDisplay(
    payload: SmartTagPayload,
    timeoutMs = 20000,
  ): Promise<SmartTagWriteResult> {
    if (this.busy) throw new NfcOperationInProgressError();
    if (
      !/^\d{10}$/.test(payload.baggageTagNumber) ||
      !/^[A-Z]{3}$/.test(payload.destinationAirport) ||
      !payload.flightNumber ||
      !payload.tagUid
    ) {
      throw new NfcError(
        'Invalid SmartTag baggage details.',
        'INVALID_PAYLOAD',
      );
    }
    if (!this.session) await this.readTagUid(timeoutMs);

    return this.operate(async (session) => {
      if (session.protocol === 'TYPE4A_NDEF') {
        return this.writeType4FallbackDisplay(session, payload);
      }
      return this.writePa1Display(session, payload);
    }, timeoutMs);
  }

  async cancelScan(): Promise<void> {
    if (!this.session) return;
    this.session.cancelled = true;
    if (this.cancelOperation) {
      this.cancelOperation();
      return;
    }
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    this.session = null;
  }
}

export const nativeNfcService = new NativeNfcService();
