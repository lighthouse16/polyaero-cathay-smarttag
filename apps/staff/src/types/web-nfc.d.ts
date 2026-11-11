// Minimal Web NFC typings (not included in TypeScript's default DOM library).
interface NDEFRecordInit {
  recordType: 'text' | 'url' | 'mime' | 'unknown';
  data?: string | BufferSource;
  mediaType?: string;
  encoding?: string;
  lang?: string;
}

interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

declare class NDEFReader extends EventTarget {
  constructor();
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  write(
    message: string | NDEFMessageInit,
    options?: { signal?: AbortSignal; overwrite?: boolean }
  ): Promise<void>;
}
