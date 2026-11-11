import type { KeyValueStorageAdapter } from '@polyaero/shared';

const memoryFallback = new Map<string, string>();

export const createPersistentStorageAdapter = (): KeyValueStorageAdapter | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (key: string): string | null => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return memoryFallback.get(key) ?? null;
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          memoryFallback.set(key, value);
        }
      },
      removeItem: (key: string): void => {
        try {
          window.localStorage.removeItem(key);
        } catch {
          memoryFallback.delete(key);
        }
      },
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
  };
};
