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

type Session = { cancelled: boolean };
const SELECT_APPLICATION = [
  0x00, 0xa4, 0x04, 0x00, 0x07, 0xd2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00,
];
const SELECT_NDEF = [0x00, 0xa4, 0x00, 0x0c, 0x02, 0xe1, 0x04];

export class NativeNfcService implements INfcService {
  private initialized = false;
  private session: Session | null = null;
  private busy = false;
  private cancelOperation: (() => void) | null = null;

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

  private async exchange(
    session: Session,
    command: number[],
  ): Promise<number[]> {
    if (session.cancelled) throw new NfcCancelledError();
    const response = await NfcManager.isoDepHandler.transceive(command);
    if (session.cancelled) throw new NfcCancelledError();
    if (
      response.length < 2 ||
      response[response.length - 2] !== 0x90 ||
      response[response.length - 1] !== 0x00
    ) {
      throw new NfcWriteError(
        'The SmartTag bridge rejected the command or could not refresh its display.',
      );
    }
    return response.slice(0, -2);
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
        });
        if (session.cancelled) throw new NfcCancelledError();
        if (Platform.OS === 'android') await NfcManager.setTimeout(10000);
        await this.exchange(session, SELECT_APPLICATION);
        const identity = String.fromCharCode(
          ...(await this.exchange(session, [0x80, 0x10, 0x00, 0x00, 0x00])),
        );
        if (!/^PA1\|(?:[0-9A-F]{2}:){6}[0-9A-F]{2}$/.test(identity)) {
          throw new NfcWriteError(
            'This tag is not a compatible MicroPython SmartTag bridge.',
          );
        }
        // PN532 emulates a short RF UID; the bridge supplies its configured SmartTag identity.
        return { tagUid: identity.slice(4), isMockSimulation: false };
      },
      timeoutMs,
      true,
    );
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
      const identity = String.fromCharCode(
        ...(await this.exchange(session, [0x80, 0x10, 0x00, 0x00, 0x00])),
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

      await this.exchange(session, SELECT_NDEF);
      const write = (offset: number, bytes: number[]) =>
        this.exchange(session, [
          0x00,
          0xd6,
          offset >> 8,
          offset & 0xff,
          bytes.length,
          ...bytes,
        ]);
      await write(0, [0, 0]);
      for (let offset = 0; offset < message.length; offset += 48) {
        await write(offset + 2, message.slice(offset, offset + 48));
      }
      await write(0, [message.length >> 8, message.length & 0xff]);

      // Firmware emits this receipt only after rendering and waiting for the panel BUSY pin.
      const receipt = String.fromCharCode(
        ...(await this.exchange(session, [0x80, 0x11, 0x00, 0x00, 0x00])),
      );
      if (receipt !== `PA1|${syncId}`)
        throw new NfcWriteError(
          'The display returned a stale or missing refresh receipt.',
        );
      const readback: number[] = [];
      for (let offset = 0; offset < message.length + 2; offset += 48) {
        readback.push(
          ...(await this.exchange(session, [
            0x00,
            0xb0,
            offset >> 8,
            offset & 0xff,
            Math.min(48, message.length + 2 - offset),
          ])),
        );
      }
      const expected = [message.length >> 8, message.length & 0xff, ...message];
      if (
        readback.length !== expected.length ||
        readback.some((byte, index) => byte !== expected[index])
      ) {
        throw new NfcWriteError(
          'The SmartTag payload readback did not match the written baggage details.',
        );
      }
      return {
        success: true,
        tagUid: identity,
        bytesWritten: message.length,
        timestamp: new Date().toISOString(),
        isMockSimulation: false,
        verifiedReadback: true,
      };
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
