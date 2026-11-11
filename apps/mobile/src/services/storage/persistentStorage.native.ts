import { File, Paths } from 'expo-file-system';
import type { KeyValueStorageAdapter } from '@polyaero/shared';

export interface PersistentStorageAdapter extends KeyValueStorageAdapter {
  isPersistedToDisk(key: string): boolean;
  getLastStorageError(): string | null;
}

const memoryFallback = new Map<string, string>();
const persistedKeys = new Set<string>();
let lastStorageError: string | null = null;

function hashKey(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeStorageKey(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `smarttag_${safe}_${hashKey(key)}.json`;
}

function getStorageFile(key: string): File {
  const safeName = normalizeStorageKey(key);
  return new File(Paths.document, safeName);
}

export const createPersistentStorageAdapter = (): PersistentStorageAdapter => {
  return {
    getItem(key: string): string | null {
      try {
        const file = getStorageFile(key);
        if (!file.exists) {
          return memoryFallback.get(key) ?? null;
        }
        const text = file.textSync();
        if (text.startsWith('{') || text.startsWith('[')) {
          try {
            JSON.parse(text);
          } catch {
            lastStorageError = 'NATIVE_STORAGE_FILE_CORRUPT';
            return null;
          }
        }
        persistedKeys.add(key);
        return text;
      } catch {
        lastStorageError = 'NATIVE_STORAGE_READ_ERROR';
        return memoryFallback.get(key) ?? null;
      }
    },

    setItem(key: string, value: string): void {
      lastStorageError = null;
      try {
        const file = getStorageFile(key);
        if (!file.exists) {
          file.create({ intermediates: true, overwrite: true });
        }
        file.writeSync(value);
        const readback = file.textSync();
        if (readback !== value) {
          throw new Error('Storage write verification mismatch');
        }
        persistedKeys.add(key);
        memoryFallback.set(key, value);
      } catch {
        persistedKeys.delete(key);
        lastStorageError = 'NATIVE_STORAGE_WRITE_VERIFICATION_FAILED';
        memoryFallback.set(key, value);
      }
    },

    removeItem(key: string): void {
      lastStorageError = null;
      memoryFallback.delete(key);
      persistedKeys.delete(key);
      try {
        const file = getStorageFile(key);
        if (file.exists) {
          file.delete();
        }
      } catch {
        lastStorageError = 'NATIVE_STORAGE_DELETE_ERROR';
      }
    },

    isPersistedToDisk(key: string): boolean {
      try {
        const file = getStorageFile(key);
        return file.exists && persistedKeys.has(key);
      } catch {
        return false;
      }
    },

    getLastStorageError(): string | null {
      return lastStorageError;
    },
  };
};
