/**
 * Interleaved 2 of 5 (ITF) Barcode Encoder for 10-digit IATA Baggage License Plates.
 *
 * Used by the monochrome 296×128 E-ink display preview on Sync SmartTag.
 * Produces deterministic bar/space module widths (`1` = narrow, `3` = wide)
 * for any even-length numeric string. Does not claim physical airport scanner
 * validation.
 */

const DIGIT_PATTERNS: Record<string, readonly [number, number, number, number, number]> = {
  '0': [1, 1, 3, 3, 1],
  '1': [3, 1, 1, 1, 3],
  '2': [1, 3, 1, 1, 3],
  '3': [3, 3, 1, 1, 1],
  '4': [1, 1, 3, 1, 3],
  '5': [3, 1, 3, 1, 1],
  '6': [1, 3, 3, 1, 1],
  '7': [1, 1, 1, 3, 3],
  '8': [3, 1, 1, 3, 1],
  '9': [1, 3, 1, 3, 1],
};

export interface BarcodeBarModule {
  isBar: boolean;
  widthUnits: 1 | 3;
}

/**
 * Validates whether the given string is valid for Interleaved 2 of 5 encoding.
 * Must be non-empty, composed solely of ASCII digits (0-9), and have an even length.
 */
export function isValidItfBarcodeDigits(digits: string): boolean {
  if (!digits) return false;
  const trimmed = digits.trim();
  return /^\d+$/.test(trimmed) && trimmed.length % 2 === 0;
}

export function encodeInterleaved2Of5(digitsRaw: string): BarcodeBarModule[] {
  if (!digitsRaw) {
    throw new Error('Interleaved 2 of 5 barcode encoding requires a non-empty numeric string.');
  }

  const trimmed = digitsRaw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid barcode input "${digitsRaw}": contains non-numeric characters. ` +
        'Interleaved 2 of 5 only accepts numeric digits (0-9).'
    );
  }

  if (trimmed.length % 2 !== 0) {
    throw new Error(
      `Invalid barcode length (${trimmed.length} digits): Interleaved 2 of 5 requires an even number of digits.`
    );
  }

  const normalized = trimmed;

  const modules: BarcodeBarModule[] = [
    // Start pattern: narrow bar, narrow space, narrow bar, narrow space
    { isBar: true, widthUnits: 1 },
    { isBar: false, widthUnits: 1 },
    { isBar: true, widthUnits: 1 },
    { isBar: false, widthUnits: 1 },
  ];

  for (let i = 0; i < normalized.length; i += 2) {
    const barPattern = DIGIT_PATTERNS[normalized[i]] ?? DIGIT_PATTERNS['0'];
    const spacePattern = DIGIT_PATTERNS[normalized[i + 1]] ?? DIGIT_PATTERNS['0'];
    for (let j = 0; j < 5; j++) {
      modules.push({ isBar: true, widthUnits: barPattern[j] as 1 | 3 });
      modules.push({ isBar: false, widthUnits: spacePattern[j] as 1 | 3 });
    }
  }

  // Stop pattern: wide bar, narrow space, narrow bar
  modules.push({ isBar: true, widthUnits: 3 });
  modules.push({ isBar: false, widthUnits: 1 });
  modules.push({ isBar: true, widthUnits: 1 });

  return modules;
}
