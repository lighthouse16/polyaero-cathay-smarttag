import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSmartTagSync, SmartTagPayload } from '@polyaero/shared';
import { NativeNfcService } from '../NativeNfcService';
import { postSmartTagTap } from '../../copilotBridge';

const mock = vi.hoisted(() => ({
  start: vi.fn(),
  isSupported: vi.fn(),
  isEnabled: vi.fn(),
  requestTechnology: vi.fn(),
  cancelTechnologyRequest: vi.fn(),
  setTimeout: vi.fn(),
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
