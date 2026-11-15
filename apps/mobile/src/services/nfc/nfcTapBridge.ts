import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface DiscoveredNfcTap {
  tapSeq: number;
  uid: string;
  ndefText: string | null;
  techTypes: string[];
  detectedAt: number;
}

type RawTagRecord = {
  tnf?: number;
  type?: number[] | string;
  payload?: number[];
};

type RawTagEvent = {
  id?: string;
  techTypes?: string[];
  ndefMessage?: RawTagRecord[];
};

type NfcModuleLike = {
  default: {
    start: () => Promise<void>;
    getLaunchTagEvent?: () => Promise<RawTagEvent | null>;
    getBackgroundTag?: () => Promise<RawTagEvent | null>;
    clearBackgroundTag?: () => Promise<void>;
    setEventListener?: (event: string, cb: ((tag: RawTagEvent | null) => void) | null) => void;
  };
  NfcEvents?: {
    DiscoverBackgroundTag?: string;
  };
  Ndef?: {
    TNF_WELL_KNOWN?: number;
    text?: {
      decodePayload?: (bytes: Uint8Array) => string;
    };
  };
};

let tapCounter = 0;
let latestTap: DiscoveredNfcTap | null = null;
let started = false;
let launchIntentConsumed = false;
let isListenerPaused = false;
let cooldownUntil = 0;
let lastEmittedUid: string | null = null;
let lastEmittedAt = 0;
const DEFAULT_DEBOUNCE_MS = 2500;
const listeners = new Set<(tap: DiscoveredNfcTap | null) => void>();

export function pauseNfcTapListener(): void {
  isListenerPaused = true;
}

export function resumeNfcTapListener(): void {
  isListenerPaused = false;
}

export function setNfcTapCooldown(durationMs = 4000): void {
  cooldownUntil = Math.max(cooldownUntil, Date.now() + durationMs);
}

export function isNfcTapPausedOrCoolingDown(): boolean {
  return isListenerPaused || Date.now() < cooldownUntil;
}

/** Format raw Android/iOS tag hex ID into uppercase colon-separated octets. */
export function formatNfcHexUid(rawId: unknown): string | null {
  if (typeof rawId !== 'string') return null;
  const cleaned = rawId.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (!cleaned || cleaned.length < 4 || cleaned.length % 2 !== 0) return null;
  const pairs: string[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    pairs.push(cleaned.slice(i, i + 2));
  }
  return pairs.join(':');
}

function decodeFirstNdefText(
  tag: RawTagEvent,
  ndefLib?: NfcModuleLike['Ndef'],
): string | null {
  const records = Array.isArray(tag.ndefMessage) ? tag.ndefMessage : [];
  for (const record of records) {
    if (!Array.isArray(record.payload) || record.payload.length < 2) continue;
    const isTextType =
      record.type === 'T' ||
      (Array.isArray(record.type) &&
        record.type.length === 1 &&
        record.type[0] === 0x54);
    if (!isTextType && record.tnf !== (ndefLib?.TNF_WELL_KNOWN ?? 1)) continue;
    try {
      const decode = ndefLib?.text?.decodePayload;
      if (typeof decode === 'function') {
        const text = decode(new Uint8Array(record.payload));
        if (text) return text.trim();
      }
    } catch {
      // Ignore malformed NDEF payload; UID still identifies the tag tap.
    }
  }
  return null;
}

function emitTap(tap: DiscoveredNfcTap | null): void {
  latestTap = tap;
  listeners.forEach((listener) => listener(tap));
}

function ingestTagEvent(
  tag: RawTagEvent | null | undefined,
  ndefLib?: NfcModuleLike['Ndef'],
): void {
  if (!tag || typeof tag !== 'object') return;
  if (isListenerPaused) return;

  const now = Date.now();
  if (now < cooldownUntil) return;

  const uid = formatNfcHexUid(tag.id) ?? 'PN532-TYPE4A';
  if (uid === lastEmittedUid && now - lastEmittedAt < DEFAULT_DEBOUNCE_MS) {
    return;
  }

  const ndefText = decodeFirstNdefText(tag, ndefLib);
  const techTypes = Array.isArray(tag.techTypes)
    ? tag.techTypes.filter((t): t is string => typeof t === 'string')
    : [];
  tapCounter += 1;
  lastEmittedUid = uid;
  lastEmittedAt = now;
  emitTap({
    tapSeq: tapCounter,
    uid,
    ndefText,
    techTypes,
    detectedAt: now,
  });
}

function loadNfcModule(): NfcModuleLike | null {
  if (Platform.OS === 'web') return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports -- Native NFC manager cannot load in web static exports. */
    return require('react-native-nfc-manager') as NfcModuleLike;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    return null;
  }
}

/**
 * Listens for Android NFC launch & background intents (`DiscoverBackgroundTag`)
 * without calling `registerTagEvent()`, preserving Reader Mode flags for active writes.
 */
export async function startNfcTapListener(moduleOverride?: NfcModuleLike): Promise<void> {
  if (started && !moduleOverride) return;
  const mod = moduleOverride ?? loadNfcModule();
  if (!mod?.default) return;
  started = true;

  try {
    await mod.default.start();
  } catch {
    started = false;
    return;
  }

  const bgEventName =
    mod.NfcEvents?.DiscoverBackgroundTag ?? 'NfcManagerDiscoverBackgroundTag';
  mod.default.setEventListener?.(bgEventName, (tag) => {
    ingestTagEvent(tag, mod.Ndef);
    void mod.default.clearBackgroundTag?.().catch(() => {});
  });

  if (!launchIntentConsumed) {
    launchIntentConsumed = true;
    const launchTag =
      (await mod.default.getLaunchTagEvent?.().catch(() => null)) ??
      (await mod.default.getBackgroundTag?.().catch(() => null));
    if (launchTag) {
      ingestTagEvent(launchTag, mod.Ndef);
      await mod.default.clearBackgroundTag?.().catch(() => {});
    }
  }
}

export function getLastNfcTap(): DiscoveredNfcTap | null {
  return latestTap;
}

export function clearLastNfcTap(): void {
  if (latestTap !== null) emitTap(null);
}

export function subscribeNfcTaps(
  listener: (tap: DiscoveredNfcTap | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset for isolated unit tests. */
export function resetNfcTapBridgeForTests(): void {
  started = false;
  launchIntentConsumed = false;
  tapCounter = 0;
  latestTap = null;
  listeners.clear();
  isListenerPaused = false;
  cooldownUntil = 0;
  lastEmittedUid = null;
  lastEmittedAt = 0;
}

export function useDiscoveredNfcTap(): DiscoveredNfcTap | null {
  const [tap, setTap] = useState<DiscoveredNfcTap | null>(() => latestTap);
  useEffect(() => subscribeNfcTaps(setTap), []);
  return tap;
}
