import type { KeyValueStorageAdapter } from '@polyaero/shared';

export interface PersistentStorageAdapter extends KeyValueStorageAdapter {
  isPersistedToDisk(key: string): boolean;
  getLastStorageError(): string | null;
}

const memoryFallback = new Map<string, string>();
let lastStorageError: string | null = null;

export const createPersistentStorageAdapter = (): PersistentStorageAdapter => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (key: string): string | null => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          lastStorageError = 'WEB_STORAGE_READ_ERROR';
          return memoryFallback.get(key) ?? null;
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          window.localStorage.setItem(key, value);
          lastStorageError = null;
        } catch {
          lastStorageError = 'WEB_STORAGE_QUOTA_EXCEEDED';
          memoryFallback.set(key, value);
        }
      },
      removeItem: (key: string): void => {
        try {
          window.localStorage.removeItem(key);
          lastStorageError = null;
        } catch {
          lastStorageError = 'WEB_STORAGE_DELETE_ERROR';
          memoryFallback.delete(key);
        }
      },
      isPersistedToDisk: (key: string): boolean => {
        try {
          return window.localStorage.getItem(key) !== null;
        } catch {
          return false;
        }
      },
      getLastStorageError: () => lastStorageError,
    };
  }

  return {
    getItem: (key: string): string | null => memoryFallback.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      memoryFallback.set(key, value);
    },
    removeItem: (key: string): void => {
      memoryFallback.delete(key);
    },
    isPersistedToDisk: () => false,
    getLastStorageError: () => lastStorageError,
  };
};
