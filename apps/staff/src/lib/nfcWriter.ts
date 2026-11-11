import type { TagPayload } from './tagWriter';
import { simulateTapWrite } from './tagWriter';

/**
 * NFC_DATA: the text record was written to the chip with Web NFC.
 *           The e-ink screen is NOT refreshed by this.
 * MOCK:     No NFC reader available (laptop, iPhone). Nothing was written.
 */
export type WriteMode = 'NFC_DATA' | 'MOCK';

export interface TagWriteOutcome {
  mode: WriteMode;
  record: string;
}

const WRITE_TIMEOUT_MS = 15000;

/** True only where Web NFC exists (Android Chrome over HTTPS). */
export function webNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/**
 * Compact ASCII record, e.g. "PA1|0160892012|HKG-NRT|RECOVERY_IN_PROGRESS|2026-11-10 14:20Z".
 * Contains no names, PNR, or tokens: anyone with an NFC phone can read this.
 */
export function encodeTagRecord(p: TagPayload): string {
  return [
    'PA1',
    p.bagId,
    p.route.replace('→', '-').replace(/\s+/g, ''),
    p.statusCode,
    p.lastUpdated.replace(' UTC', 'Z'),
  ].join('|');
}

async function writeNdef(record: string): Promise<void> {
  const reader = new NDEFReader();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);

  try {
    await reader.write(record, { signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('No tag detected. Hold the tag against the back of the phone and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Must be called directly from a click handler (no await before it). */
export async function writeToTag(p: TagPayload): Promise<TagWriteOutcome> {
  const record = encodeTagRecord(p);

  if (webNfcSupported()) {
    await writeNdef(record);
    return { mode: 'NFC_DATA', record };
  }

  await simulateTapWrite();
  return { mode: 'MOCK', record };
}
