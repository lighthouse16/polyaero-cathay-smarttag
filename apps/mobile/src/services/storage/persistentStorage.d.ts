import type { KeyValueStorageAdapter } from '@polyaero/shared';

export interface PersistentStorageAdapter extends KeyValueStorageAdapter {
  isPersistedToDisk(key: string): boolean;
  getLastStorageError(): string | null;
}

export declare const createPersistentStorageAdapter: () => PersistentStorageAdapter;
