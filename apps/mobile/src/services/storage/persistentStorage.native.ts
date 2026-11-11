import { File, Paths } from 'expo-file-system';
import type { KeyValueStorageAdapter } from '@polyaero/shared';

const memoryFallback = new Map<string, string>();

function getStorageFile(key: string): File {
  const safeName = key.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.json';
  return new File(Paths.document, safeName);
}

export const createPersistentStorageAdapter = (): KeyValueStorageAdapter => {
  return {
    getItem(key: string): string | null {
      try {
        const file = getStorageFile(key);
        if (!file.exists) {
          return memoryFallback.get(key) ?? null;
        }
        return file.textSync();
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    },

    setItem(key: string, value: string): void {
      memoryFallback.set(key, value);
      try {
        const file = getStorageFile(key);
        if (!file.exists) {
          file.create({ intermediates: true, overwrite: true });
        }
        file.writeSync(value);
      } catch {
        // In-memory fallback holds the current value if disk write fails
      }
    },

    removeItem(key: string): void {
      memoryFallback.delete(key);
      try {
        const file = getStorageFile(key);
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Ignored
      }
    },
  };
};
