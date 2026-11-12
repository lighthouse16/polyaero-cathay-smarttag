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

export function encodeInterleaved2Of5(digitsRaw: string): BarcodeBarModule[] {
  const digits = digitsRaw.replace(/\D/g, '');
  const normalized = digits.length === 0 ? '0160123456' : digits.length % 2 === 1 ? `0${digits}` : digits;

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
