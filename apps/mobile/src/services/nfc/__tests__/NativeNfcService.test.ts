import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSmartTagSync, SmartTagPayload } from '@polyaero/shared';
import { NativeNfcService } from '../NativeNfcService';
import {
  formatNfcHexUid,
  getLastNfcTap,
  pauseNfcTapListener,
  resetNfcTapBridgeForTests,
  resumeNfcTapListener,
  setNfcTapCooldown,
  startNfcTapListener,
} from '../nfcTapBridge';
import { postSmartTagTap } from '../../copilotBridge';

const mock = vi.hoisted(() => ({
  start: vi.fn(),
  isSupported: vi.fn(),
  isEnabled: vi.fn(),
  requestTechnology: vi.fn(),
  cancelTechnologyRequest: vi.fn(),
  setTimeout: vi.fn(),
  getTag: vi.fn(),
  exchange: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('react-native-nfc-manager', async () => {
  const { createRequire } = await import('node:module');
  return {
    default: { ...mock, isoDepHandler: { transceive: mock.exchange } },
    NfcTech: { IsoDep: 'IsoDep' },
    NfcAdapter: { FLAG_READER_NFC_A: 1, FLAG_READER_SKIP_NDEF_CHECK: 128 },
    NfcError: {
      UserCancel: class extends Error {},
      Timeout: class extends Error {},
      RadioDisabled: class extends Error {},
    },
    Ndef: createRequire(import.meta.url)(
      'react-native-nfc-manager/dist/ndef-lib',
    ),
  };
});

const payload: SmartTagPayload = {
  tagUid: '04:A2:3B:4C:5D:6E:70',
  baggageTagNumber: '0160123456',
  flightNumber: 'CX548',
  originAirport: 'HKG',
  destinationAirport: 'NRT',
  passengerInitials: 'H.T.',
  departureDate: '2026-11-21',
  barcodeSymbology: 'INTERLEAVED_2_OF_5',
};

let buffer: number[];
let receiptMode: 'ready' | 'stale' | 'failed';
let corruptReadback: boolean;
let identity: string;

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.resetAllMocks();
  buffer = Array(512).fill(0);
  receiptMode = 'ready';
  corruptReadback = false;
  identity = payload.tagUid;
  mock.start.mockResolvedValue(undefined);
  mock.isSupported.mockResolvedValue(true);
  mock.isEnabled.mockResolvedValue(true);
  mock.requestTechnology.mockResolvedValue('IsoDep');
  mock.cancelTechnologyRequest.mockResolvedValue(undefined);
  mock.setTimeout.mockResolvedValue(undefined);
  mock.exchange.mockImplementation(async (command: number[]) => {
    const [cla, ins, p1, p2, length] = command;
    if (cla === 0x80 && ins === 0x10)
      return [...Buffer.from(`PA1|${identity}`), 0x90, 0];
    if (cla === 0x80 && ins === 0x11) {
      if (receiptMode === 'failed') return [0x65, 0x81];
      const text = Buffer.from(
        buffer.slice(2, 2 + ((buffer[0] << 8) | buffer[1])),
      ).toString();
      const syncId = JSON.parse(text.slice(text.indexOf('{'))).sync_id;
      return [
        ...Buffer.from(`PA1|${receiptMode === 'stale' ? 'old-write' : syncId}`),
        0x90,
        0,
      ];
    }
    const offset = (p1 << 8) | p2;
    if (ins === 0xd6) buffer.splice(offset, length, ...command.slice(5));
    if (ins === 0xb0) {
      const bytes = buffer.slice(offset, offset + length);
      if (corruptReadback) bytes[0] ^= 1;
      return [...bytes, 0x90, 0];
    }
    return [0x90, 0];
  });
});

const sync = (service = new NativeNfcService()) =>
  runSmartTagSync({
    mode: 'PHYSICAL_HARDWARE',
    service,
    payload,
    expectedTagUid: payload.tagUid,
    stepDelayMs: 0,
  });

describe('MicroPython bridge physical NFC sync', () => {
  it('keeps one ISO-DEP session through write, refresh receipt, and exact readback', async () => {
    const outcome = await sync();
    expect(outcome.setupState).toBe('PHYSICALLY_WRITTEN_AND_VERIFIED');
    expect(outcome.writeRecord?.verifiedHardwareReadback).toBe(true);
    expect(mock.requestTechnology).toHaveBeenCalledTimes(1);
    expect(mock.requestTechnology).toHaveBeenCalledWith(
      'IsoDep',
      expect.objectContaining({
        isReaderModeEnabled: true,
        readerModeFlags: 129,
        readerModeDelay: 750,
      }),
    );
    expect(mock.setTimeout).toHaveBeenCalledWith(10000);
    expect(mock.cancelTechnologyRequest).toHaveBeenCalled();
    const commands = mock.exchange.mock.calls.map(
      ([command]) => command as number[],
    );
    expect(
      commands.some((command) => command[0] === 0x80 && command[1] === 0x11),
    ).toBe(true);
    expect(
      commands
        .filter((command) => command[1] === 0xd6)
        .every((command) => command[4] <= 48),
    ).toBe(true);
  });

  it.each(['stale', 'failed'] as const)(
    'never confirms a %s display receipt',
    async (mode) => {
      receiptMode = mode;
      const outcome = await sync();
      expect(outcome.finalState).toBe('FAILED');
      expect(outcome.writeRecord).toBeNull();
      expect(mock.cancelTechnologyRequest).toHaveBeenCalled();
    },
  );

  it('rejects corrupted payload readback even with a refresh receipt', async () => {
    corruptReadback = true;
    expect((await sync()).finalState).toBe('FAILED');
  });

  it('shows a connected bridge rejection instead of blaming RF coupling', async () => {
    mock.exchange.mockResolvedValueOnce([0x6a, 0x82]);
    const outcome = await sync();
    expect(outcome.failure?.message).toContain(
      'Selecting SmartTag application',
    );
    expect(outcome.failure?.message).toContain('6A82');
    expect(mock.cancelTechnologyRequest).toHaveBeenCalled();
    expect(mock.exchange).toHaveBeenCalledTimes(1);
  });

  it('identifies an unconfirmed display refresh in the app error', async () => {
    receiptMode = 'failed';
    const outcome = await sync();
    expect(outcome.failure?.message).toContain('Confirming display refresh');
    expect(outcome.failure?.message).toContain('6581');
    expect(outcome.failure?.message).toContain('not confirmed');
    expect(outcome.writeRecord).toBeNull();
  });

  it('rejects a malformed response and allows a fresh reader session afterwards', async () => {
    mock.exchange.mockResolvedValueOnce([0x90]);
    const service = new NativeNfcService();
    const failed = await sync(service);
    expect(failed.failure?.message).toContain('incomplete NFC response');
    expect((await sync(service)).finalState).toBe('SUCCESS');
    expect(mock.requestTechnology).toHaveBeenCalledTimes(2);
  });

  it('does not write to a different bridge', async () => {
    identity = '04:B3:7C:1D:9E:2F:81';
    const outcome = await sync();
    expect(outcome.failure?.code).toBe('NFC_WRONG_TAG');
    expect(
      mock.exchange.mock.calls.some(([command]) => command[1] === 0xd6),
    ).toBe(false);
    expect(mock.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('cancels discovery without letting a late connection write anything', async () => {
    let connect!: () => void;
    mock.requestTechnology.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          connect = resolve;
        }),
    );
    const service = new NativeNfcService();
    const scan = service.readTagUid();
    const rejected = expect(scan).rejects.toMatchObject({
      code: 'NFC_CANCELLED',
    });
    await vi.waitFor(() => expect(mock.requestTechnology).toHaveBeenCalled());
    await service.cancelScan();
    await rejected;
    connect();
    await Promise.resolve();
    expect(mock.exchange).not.toHaveBeenCalled();
    expect(mock.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('times out and releases a stalled write', async () => {
    const service = new NativeNfcService();
    await service.readTagUid();
    mock.exchange.mockImplementation(() => new Promise(() => {}));
    await expect(service.writeEinkDisplay(payload, 10)).rejects.toMatchObject({
      code: 'NFC_TIMEOUT',
    });
    expect(mock.cancelTechnologyRequest).toHaveBeenCalled();
  });

  it('reports a physical tap without putting a baggage number in the API UUID field', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ acknowledged: true, display: { status: 'TAGGED' } }),
    } as Response);
    const result = await postSmartTagTap(payload.tagUid, {
      ...payload,
      status: 'TAGGED',
      timestamp: 123,
    });
    expect(result.success).toBe(true);
    const request = JSON.parse(fetch.mock.calls[0][1]?.body as string);
    const ndef = JSON.parse(request.ndef_payload);
    expect(ndef.barcode).toBe(payload.baggageTagNumber);
    expect(ndef.tag_code).toBe(payload.tagUid);
    expect(ndef.tag).toBeUndefined();
  });
});

describe('Standard Type-4A compatibility and NFC launch tap bridge', () => {
  const ccFile = [
    0x00, 0x0f, 0x20, 0x00, 0x3b, 0x00, 0x34, 0x04, 0x06, 0xe1, 0x04, 0x00,
    0xff, 0x00, 0x00,
  ];

  function setupType4Emulator(options?: { corruptPreCommitRead?: boolean }) {
    let selectedFile = 0xe103;
    const ndefMem = Array(255).fill(0);
    const apduLog: number[][] = [];
    mock.getTag.mockResolvedValue({ id: '123456' });
    mock.exchange.mockImplementation(async (command: number[]) => {
      apduLog.push(command);
      const [cla, ins, p1, p2, length] = command;
      if (cla === 0x80 && ins === 0x10) return [0x6e, 0x00];
      if (cla === 0x00 && ins === 0xa4 && p1 === 0x04) {
        selectedFile = 0xe103;
        return [0x90, 0x00];
      }
      if (cla === 0x00 && ins === 0xa4 && p1 === 0x00 && command.length === 7) {
        selectedFile = (command[5] << 8) | command[6];
        return selectedFile === 0xe103 || selectedFile === 0xe104
          ? [0x90, 0x00]
          : [0x6a, 0x82];
      }
      if (cla === 0x00 && ins === 0xb0) {
        const offset = (p1 << 8) | p2;
        if (selectedFile === 0xe103) {
          return [...ccFile.slice(offset, offset + length), 0x90, 0x00];
        }
        const slice = ndefMem.slice(offset, offset + length);
        if (options?.corruptPreCommitRead && offset >= 2 && slice.length > 0) {
          slice[0] ^= 0xff;
        }
        return [...slice, 0x90, 0x00];
      }
      if (cla === 0x00 && ins === 0xd6) {
        const offset = (p1 << 8) | p2;
        if (selectedFile !== 0xe104) return [0x69, 0x85];
        ndefMem.splice(offset, length, ...command.slice(5));
        return [0x90, 0x00];
      }
      return [0x6d, 0x00];
    });
    return { ndefMem, apduLog };
  }

  it('writes pipe-delimited NDEF with pre-commit readback when PA1 is unsupported (6E00)', async () => {
    const { ndefMem, apduLog } = setupType4Emulator();
    const outcome = await runSmartTagSync({
      mode: 'PHYSICAL_HARDWARE',
      service: new NativeNfcService(),
      payload,
      expectedTagUid: '',
      stepDelayMs: 0,
    });

    expect(outcome.finalState).toBe('SUCCESS');
    expect(outcome.setupState).toBe('PHYSICALLY_WRITTEN_AND_VERIFIED');
    expect(outcome.writeRecord?.verifiedHardwareReadback).toBe(true);
    expect(outcome.writeRecord?.tagUid).toBe('12:34:56');

    const nlen = (ndefMem[0] << 8) | ndefMem[1];
    expect(nlen).toBeGreaterThan(0);
    const { Ndef } = await import('react-native-nfc-manager');
    const records = Ndef.decodeMessage(ndefMem.slice(2, 2 + nlen));
    const decoded = Ndef.text.decodePayload(new Uint8Array(records[0].payload));
    expect(decoded).toBe('0160123456|NRT|TOKYO|CX548|21NOV|0840|H.T.');

    const lastCommitIdx = apduLog.findLastIndex(
      (cmd) =>
        cmd[1] === 0xd6 &&
        cmd[2] === 0x00 &&
        cmd[3] === 0x00 &&
        cmd[4] === 0x02 &&
        (cmd[5] !== 0 || cmd[6] !== 0),
    );
    const preCommitReadIdx = apduLog.findLastIndex(
      (cmd) => cmd[1] === 0xb0 && ((cmd[2] << 8) | cmd[3]) >= 2,
    );
    expect(preCommitReadIdx).toBeGreaterThan(-1);
    expect(lastCommitIdx).toBeGreaterThan(preCommitReadIdx);
  });

  it('aborts before committing NLEN if pre-commit Type-4A readback differs', async () => {
    const { ndefMem } = setupType4Emulator({ corruptPreCommitRead: true });
    const outcome = await runSmartTagSync({
      mode: 'PHYSICAL_HARDWARE',
      service: new NativeNfcService(),
      payload,
      expectedTagUid: '',
      stepDelayMs: 0,
    });

    expect(outcome.finalState).toBe('FAILED');
    expect(outcome.writeRecord).toBeNull();
    expect(ndefMem[0]).toBe(0);
    expect(ndefMem[1]).toBe(0);
  });

  it('retries 12-byte SELECT_APPLICATION when a Type-4A target rejects Le=00 with 6700', async () => {
    mock.exchange.mockImplementationOnce(async () => [0x67, 0x00]);
    const outcome = await sync();
    expect(outcome.finalState).toBe('SUCCESS');
    expect(mock.exchange.mock.calls[0][0]).toHaveLength(13);
    expect(mock.exchange.mock.calls[1][0]).toHaveLength(12);
  });

  it('captures launch and background NFC intents without calling registerTagEvent', async () => {
    resetNfcTapBridgeForTests();
    const { Ndef } = await import('react-native-nfc-manager');
    const clearBg = vi.fn(async () => undefined);
    const registerTagEvent = vi.fn();
    const setEventListener = vi.fn((_event: string, _cb: (tag: any) => void) => {});

    expect(formatNfcHexUid('123456')).toBe('12:34:56');
    const initRecord = {
      tnf: Ndef.TNF_WELL_KNOWN,
      type: [0x54],
      payload: [0x02, 0x65, 0x6e, 0x49, 0x4e, 0x49, 0x54],
    };

    await startNfcTapListener({
      default: {
        start: vi.fn(async () => undefined),
        getLaunchTagEvent: vi.fn(async () => ({
          id: '04A23B4C5D6E70',
          techTypes: ['android.nfc.tech.IsoDep'],
          ndefMessage: [initRecord],
        })),
        clearBackgroundTag: clearBg,
        setEventListener,
        registerTagEvent,
      } as any,
      Ndef,
    });

    expect(registerTagEvent).not.toHaveBeenCalled();
    expect(clearBg).toHaveBeenCalledTimes(1);
    expect(getLastNfcTap()).toMatchObject({
      tapSeq: 1,
      uid: '04:A2:3B:4C:5D:6E:70',
      ndefText: 'INIT',
    });

    const registeredCb = setEventListener.mock.calls[0]?.[1];
    registeredCb?.({ id: '123456', ndefMessage: [] });
    expect(getLastNfcTap()).toMatchObject({
      tapSeq: 2,
      uid: '12:34:56',
      ndefText: null,
    });
  });

  it('debounces rapid repeated scans of same tag and suppresses taps during pause or cooldown', async () => {
    resetNfcTapBridgeForTests();
    const setEventListener = vi.fn((_event: string, _cb: (tag: any) => void) => {});

    await startNfcTapListener({
      default: {
        start: vi.fn(async () => undefined),
        setEventListener,
      } as any,
    });

    const cb = setEventListener.mock.calls[0]?.[1];
    expect(cb).toBeDefined();

    // First tap of tag A
    cb?.({ id: 'AABBCC' });
    expect(getLastNfcTap()?.tapSeq).toBe(1);
    expect(getLastNfcTap()?.uid).toBe('AA:BB:CC');

    // Duplicate tap of tag A within 2.5s window -> debounced, no new tap emitted
    cb?.({ id: 'AABBCC' });
    expect(getLastNfcTap()?.tapSeq).toBe(1);

    // Cooldown active -> tag B also suppressed
    setNfcTapCooldown(5000);
    cb?.({ id: 'DDEEFF' });
    expect(getLastNfcTap()?.tapSeq).toBe(1);

    // Reset bridge for pause test
    resetNfcTapBridgeForTests();
    pauseNfcTapListener();
    cb?.({ id: '112233' });
    expect(getLastNfcTap()).toBeNull();

    resumeNfcTapListener();
    cb?.({ id: '112233' });
    expect(getLastNfcTap()?.tapSeq).toBe(1);
    expect(getLastNfcTap()?.uid).toBe('11:22:33');
  });
});
