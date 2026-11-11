const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function createStorageTestModule() {
  const virtualDisk = new Map();
  let diskWriteFails = false;
  let diskReadFails = false;

  class MockFile {
    constructor(dir, name) {
      this.path = `${dir}/${name}`;
    }
    get exists() {
      return virtualDisk.has(this.path);
    }
    create() {
      if (diskWriteFails) throw new Error('Simulated IO create failure');
      if (!virtualDisk.has(this.path)) virtualDisk.set(this.path, '');
    }
    writeSync(val) {
      if (diskWriteFails) throw new Error('Simulated IO write failure');
      virtualDisk.set(this.path, val);
    }
    textSync() {
      if (diskReadFails) throw new Error('Simulated IO read failure');
      return virtualDisk.get(this.path) ?? '';
    }
    delete() {
      virtualDisk.delete(this.path);
    }
  }

  const code = ts.transpileModule(
    fs.readFileSync(path.resolve('apps/mobile/src/services/storage/persistentStorage.native.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }
  ).outputText;

  const instantiate = () => {
    const mod = { exports: {} };
    vm.runInNewContext(code, {
      exports: mod.exports,
      require(id) {
        if (id === 'expo-file-system') return { File: MockFile, Paths: { document: 'file:///data/doc' } };
        return {};
      },
    });
    return mod.exports.createPersistentStorageAdapter();
  };

  return {
    instantiate,
    virtualDisk,
    setDiskWriteFails(fails) { diskWriteFails = fails; },
    setDiskReadFails(fails) { diskReadFails = fails; },
  };
}

test('PersistentStorageAdapter writes and reads back successfully with isPersistedToDisk true', () => {
  const harness = createStorageTestModule();
  const adapter = harness.instantiate();
  const key = 'polyaero.test.key';
  const val = JSON.stringify({ uid: '04:11:22:33:44:55:66', bag: 'CX880123456' });

  adapter.setItem(key, val);
  assert.equal(adapter.isPersistedToDisk(key), true);
  assert.equal(adapter.getItem(key), val);
  assert.equal(adapter.getLastStorageError(), null);
});

test('PersistentStorageAdapter survives restart / re-instantiation from disk', () => {
  const harness = createStorageTestModule();
  const adapter1 = harness.instantiate();
  adapter1.setItem('flight_state', JSON.stringify({ flight: 'CX548', paired: true }));

  // Re-instantiate on new context (simulated app restart)
  const adapter2 = harness.instantiate();
  const restored = JSON.parse(adapter2.getItem('flight_state'));
  assert.equal(restored.flight, 'CX548');
  assert.equal(restored.paired, true);
  assert.equal(adapter2.isPersistedToDisk('flight_state'), true);
});

test('PersistentStorageAdapter does NOT claim isPersistedToDisk when disk write fails', () => {
  const harness = createStorageTestModule();
  const adapter = harness.instantiate();
  harness.setDiskWriteFails(true);

  // setItem will not throw uncaught error (app safe), but isPersistedToDisk must be false
  assert.doesNotThrow(() => {
    adapter.setItem('failing_key', 'some_value');
  });

  assert.equal(adapter.isPersistedToDisk('failing_key'), false, 'Must not claim disk persistence on write failure');
  assert.equal(adapter.getLastStorageError(), 'NATIVE_STORAGE_WRITE_VERIFICATION_FAILED');
  assert.equal(adapter.getItem('failing_key'), 'some_value', 'Memory fallback serves current session');

  // Restarting app should NOT have the data because disk write failed
  harness.setDiskWriteFails(false);
  const adapter2 = harness.instantiate();
  assert.equal(adapter2.getItem('failing_key'), null, 'Failed disk write must not survive restart');
});

test('PersistentStorageAdapter handles corrupted JSON gracefully without crashing', () => {
  const harness = createStorageTestModule();
  const adapter = harness.instantiate();
  adapter.setItem('corrupt_key', '{"valid": true}');

  // Corrupt the underlying file on disk
  for (const [filePath] of harness.virtualDisk) {
    if (filePath.includes('corrupt_key')) {
      harness.virtualDisk.set(filePath, '{{CORRUPT_JSON_DATA{{');
    }
  }

  const adapter2 = harness.instantiate();
  assert.doesNotThrow(() => {
    const res = adapter2.getItem('corrupt_key');
    assert.equal(res, null, 'Corrupt file must return null instead of throwing');
  });
  assert.equal(adapter2.getLastStorageError(), 'NATIVE_STORAGE_FILE_CORRUPT');
});

test('PersistentStorageAdapter normalizes special characters in keys without collision', () => {
  const harness = createStorageTestModule();
  const adapter = harness.instantiate();
  const key1 = 'user/profile:flight@hkg';
  const key2 = 'user_profile_flight_hkg';

  adapter.setItem(key1, 'val1');
  adapter.setItem(key2, 'val2');

  assert.equal(adapter.getItem(key1), 'val1');
  assert.equal(adapter.getItem(key2), 'val2');
});

test('PersistentStorageAdapter removes items cleanly from disk and memory', () => {
  const harness = createStorageTestModule();
  const adapter = harness.instantiate();
  adapter.setItem('temp_key', 'temp_val');
  assert.equal(adapter.getItem('temp_key'), 'temp_val');

  adapter.removeItem('temp_key');
  assert.equal(adapter.getItem('temp_key'), null);
  assert.equal(adapter.isPersistedToDisk('temp_key'), false);
});
