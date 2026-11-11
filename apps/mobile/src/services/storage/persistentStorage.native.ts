/**
 * PolyAero Cathay SmartTag — Native Persistent Storage Adapter
 *
 * Persists repository state across Android application restarts using
 * `expo-file-system` on `Paths.document`.
 *
 * Persistence characteristics:
 * - Writes synchronously and verifies committed state via immediate readback.
 *   Note: native `writeSync()` writes directly to the destination stream and is
 *   not guaranteed atomic across unhandled process crashes mid-write.
 * - Key normalization appends a 32-bit FNV-1a digest to reduce character
 *   replacement collision risk for app keys (though 32-bit digests are not
 *   mathematically collision-free across arbitrary key spaces).
 * - Read verification catches truncated or corrupted files safely without
 *   crashing the host application.
 */

import { File, Paths } from 'expo-file-system';
import type { KeyValueStorageAdapter } from '@polyaero/shared';

export interface PersistentStorageAdapter extends KeyValueStorageAdapter {
  isPersistedToDisk(key: string): boolean;
  getLastStorageError(): string | null;
}

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
          return null;
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
        return null;
      }
    },

    setItem(key: string, value: string): void {
      lastStorageError = null;
      let existedBefore = false;
      let file: File | null = null;
      try {
        file = getStorageFile(key);
        existedBefore = file.exists;
        if (!existedBefore) {
          file.create({ intermediates: true, overwrite: true });
        }
        file.writeSync(value);
        const readback = file.textSync();
        if (readback !== value) {
          throw new Error('Storage write verification mismatch');
        }
        persistedKeys.add(key);
      } catch {
        persistedKeys.delete(key);
        lastStorageError = 'NATIVE_STORAGE_WRITE_VERIFICATION_FAILED';
        // Clean up empty file remnant if create succeeded before write failed
        if (!existedBefore && file && file.exists) {
          try {
            file.delete();
          } catch {
            // Ignore delete error during cleanup
          }
        }
      }
    },

    removeItem(key: string): void {
      lastStorageError = null;
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
        return file.exists && persistedKeys.has(key) && lastStorageError === null;
      } catch {
        return false;
      }
    },

    getLastStorageError(): string | null {
      return lastStorageError;
    },
  };
};
