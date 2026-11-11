const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function createAndroidHarness(mockOverrides = {}) {
  const state = [];
  const refs = [];
  let cursor = 0;
  let cancelScanCalls = 0;
  let pairedUid = null;
  let openSettingsCalls = 0;

  const bag = {
    id: 'bag_1',
    itineraryId: 'trip_1',
    smartTagCode: 'ST-2048',
    displayBagCode: 'CX880123456',
    setupState: 'PENDING_PHYSICAL_WRITE',
    smartTag: { tagUid: '04:A2:3B:4C:5D:6E:70' },
  };

  const itinerary = {
    id: 'trip_1',
    booking: { bookingReference: '8K3F7D' },
    flight: { flightNumber: 'CX548' },
  };

  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children: children.flat(Infinity),
    }),
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }];
    },
    useRef(initial) {
      const i = cursor++;
      return refs[i] ||= { current: initial };
    },
    useEffect() {},
  };

  let tagDetectedCallCount = 0;
  const scanPhysicalTagMock = mockOverrides.scanPhysicalTag || (async (timeoutMs, callbacks) => {
    if (callbacks && typeof callbacks.onTagDetected === 'function') {
      tagDetectedCallCount++;
      callbacks.onTagDetected();
    }
    return {
      tagUid: '04:E1:92:AA:BB:CC:DD',
      techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.Ndef'],
      ndefText: 'Cathay SmartTag Prototype ST-2048',
      isMockSimulation: false,
    };
  });

  const code = ts.transpileModule(
    fs.readFileSync(path.resolve('apps/mobile/src/features/smarttag/screens/SyncSmartTagScreen.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }
  ).outputText;

  const mod = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod.exports,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react-native') {
        return {
          StyleSheet: { create: (v) => v },
          Platform: { OS: 'android' },
          ...Object.fromEntries(
            ['View', 'Text', 'Image', 'ScrollView', 'TouchableOpacity', 'Modal'].map((n) => [n, n])
          ),
        };
      }
      if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
      if (id === '@polyaero/shared') {
        return {
          NfcCancelledError: class extends Error {},
          NFC_STATE_MESSAGES: { IDLE: 'Ready', CANCELLED: 'Cancelled' },
          buildNfcPayloadForBag: () => ({}),
          runSmartTagSync: async () => ({ finalState: 'SUCCESS' }),
        };
      }
      if (id.includes('services/nfc/hardwareScan')) {
        return {
          scanPhysicalTag: scanPhysicalTagMock,
          cancelPhysicalTagScan: async () => { cancelScanCalls++; },
          openNfcSettings: async () => { openSettingsCalls++; return true; },
          formatTagUid: (s) => s.toUpperCase(),
        };
      }
      if (id.includes('services/nfc')) {
        return { demoNfcService: {}, getPhysicalNfcService: () => null };
      }
      if (id === '../store') {
        return {
          useSmartTagStore: () => ({
            repo: {
              itineraries: [itinerary],
              activeItineraryId: itinerary.id,
              activeBagSetupId: bag.id,
              bagSetupsByItinerary: { [itinerary.id]: [bag] },
            },
          }),
          smartTagRepository: {
            pairPhysicalTagToBag: (_id, uid) => { pairedUid = uid; bag.smartTag.tagUid = uid; return bag; },
            recordSyncOutcome: () => {},
          },
          smartTagController: { navigateTo() {}, goBack() {} },
        };
      }
      return new Proxy({}, { get: (_, n) => n });
    },
  });

  const render = () => { cursor = 0; return mod.exports.SyncSmartTagScreen({}); };
  const nodes = (t) => (!t || typeof t !== 'object' ? [] : [t, ...t.children.flatMap(nodes)]);
  const find = (id) => nodes(render()).find((n) => n.props.testID === id);

  return {
    render,
    find,
    nodes: () => nodes(render()),
    get cancelScanCalls() { return cancelScanCalls; },
    get pairedUid() { return pairedUid; },
    get openSettingsCalls() { return openSettingsCalls; },
    get tagDetectedCallCount() { return tagDetectedCallCount; },
  };
}

test('Physical NFC scan succeeds, displays chip UID/NDEF, and pairs physical UID to baggage setup', async () => {
  const h = createAndroidHarness();
  const btn = h.find('btn-read-physical-nfc');
  assert.ok(btn, 'Read NFC chip button must be rendered on Android');
  await btn.props.onPress();

  const renderedJson = JSON.stringify(h.render());
  assert.match(renderedJson, /NFC_CHIP_READ_SUCCESS/);
  assert.match(renderedJson, /04:E1:92:AA:BB:CC:DD/);
  assert.match(renderedJson, /SMARTTAG_PAIRED/);
  assert.match(renderedJson, /ST-2048/);
  assert.match(renderedJson, /Cathay SmartTag Prototype ST-2048/);
  assert.equal(h.pairedUid, '04:E1:92:AA:BB:CC:DD');
});

test('Physical NFC scan displays disabled state and allows opening device wireless settings', async () => {
  const disabledError = new Error('NFC is disabled');
  disabledError.code = 'NFC_DISABLED';

  const h = createAndroidHarness({
    scanPhysicalTag: async () => { throw disabledError; },
  });

  const btn = h.find('btn-read-physical-nfc');
  await btn.props.onPress();

  const renderedJson = JSON.stringify(h.render());
  assert.match(renderedJson, /NFC is disabled on this device/);

  const settingsBtn = h.find('btn-open-nfc-settings-chip');
  assert.ok(settingsBtn, 'Open settings button must be available when NFC is disabled');
  await settingsBtn.props.onPress();
  assert.equal(h.openSettingsCalls, 1);
});

test('Physical NFC scan displays timeout state when no tag is presented', async () => {
  const timeoutError = new Error('Timed out');
  timeoutError.code = 'NFC_TIMEOUT';

  const h = createAndroidHarness({
    scanPhysicalTag: async () => { throw timeoutError; },
  });

  const btn = h.find('btn-read-physical-nfc');
  await btn.props.onPress();

  const renderedJson = JSON.stringify(h.render());
  assert.match(renderedJson, /Scan timed out/);
});

test('Physical NFC scan invokes onTagDetected callback during scanning', async () => {
  const h = createAndroidHarness();
  const btn = h.find('btn-read-physical-nfc');
  await btn.props.onPress();
  assert.equal(h.tagDetectedCallCount, 1, 'onTagDetected callback must be fired on physical tag discovery');
});

test('Physical NFC scan handles hardware unavailable (NFC_UNAVAILABLE)', async () => {
  const unavailError = new Error('No NFC hardware');
  unavailError.code = 'NFC_UNAVAILABLE';

  const h = createAndroidHarness({
    scanPhysicalTag: async () => { throw unavailError; },
  });

  const btn = h.find('btn-read-physical-nfc');
  await btn.props.onPress();

  const renderedJson = JSON.stringify(h.render());
  assert.match(renderedJson, /No NFC hardware/);
});

test('Physical NFC scan handles user cancellation (NFC_CANCELLED)', async () => {
  const cancelError = new Error('Cancelled');
  cancelError.code = 'NFC_CANCELLED';

  const h = createAndroidHarness({
    scanPhysicalTag: async () => { throw cancelError; },
  });

  const btn = h.find('btn-read-physical-nfc');
  await btn.props.onPress();

  const renderedJson = JSON.stringify(h.render());
  assert.match(renderedJson, /Scan cancelled/);
});

test('Mandatory honesty rule: NFC_CHIP_READ_SUCCESS without pairing does not display SMARTTAG_PAIRED', async () => {
  const h = createAndroidHarness();
  // Override pairPhysicalTagToBag to return false (unpaired)
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve('apps/mobile/src/features/smarttag/screens/SyncSmartTagScreen.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }
  ).outputText;

  const state = [];
  const refs = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children: children.flat(Infinity),
    }),
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }];
    },
    useRef(initial) {
      const i = cursor++;
      return refs[i] ||= { current: initial };
    },
    useEffect() {},
  };

  const mod = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod.exports,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react-native') {
        return {
          StyleSheet: { create: (v) => v },
          Platform: { OS: 'android' },
          ...Object.fromEntries(
            ['View', 'Text', 'Image', 'ScrollView', 'TouchableOpacity', 'Modal'].map((n) => [n, n])
          ),
        };
      }
      if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
      if (id === '@polyaero/shared') {
        return {
          NfcCancelledError: class extends Error {},
          NFC_STATE_MESSAGES: { IDLE: 'Ready', CANCELLED: 'Cancelled' },
          buildNfcPayloadForBag: () => ({}),
          runSmartTagSync: async () => ({ finalState: 'SUCCESS' }),
        };
      }
      if (id.includes('services/nfc/hardwareScan')) {
        return {
          scanPhysicalTag: async () => ({
            tagUid: '04:99:88:77:66:55:44',
            techTypes: ['android.nfc.tech.NfcA'],
            isMockSimulation: false,
          }),
          cancelPhysicalTagScan: async () => {},
          openNfcSettings: async () => true,
          formatTagUid: (s) => s.toUpperCase(),
        };
      }
      if (id.includes('services/nfc')) {
        return { demoNfcService: {}, getPhysicalNfcService: () => null };
      }
      if (id === '../store') {
        return {
          useSmartTagStore: () => ({
            repo: {
              itineraries: [{ id: 'trip_1', booking: { bookingReference: '8K3F7D' }, flight: { flightNumber: 'CX548' } }],
              activeItineraryId: 'trip_1',
              activeBagSetupId: 'bag_1',
              bagSetupsByItinerary: { trip_1: [{ id: 'bag_1', smartTagCode: 'ST-2048', displayBagCode: 'CX880123456', setupState: 'PENDING_PHYSICAL_WRITE', smartTag: { tagUid: '' } }] },
            },
          }),
          smartTagRepository: {
            pairPhysicalTagToBag: () => false, // Pairing rejected
            recordSyncOutcome: () => {},
          },
          smartTagController: { navigateTo() {}, goBack() {} },
        };
      }
      return new Proxy({}, { get: (_, n) => n });
    },
  });

  const render = () => { cursor = 0; return mod.exports.SyncSmartTagScreen({}); };
  const nodes = (t) => (!t || typeof t !== 'object' ? [] : [t, ...t.children.flatMap(nodes)]);
  const btn = nodes(render()).find((n) => n.props.testID === 'btn-read-physical-nfc');
  await btn.props.onPress();

  const renderedJson = JSON.stringify(render());
  assert.match(renderedJson, /NFC_CHIP_READ_SUCCESS/);
  assert.doesNotMatch(renderedJson, /SMARTTAG_PAIRED/, 'Must not claim SMARTTAG_PAIRED when pairing was rejected');
});

test('SyncSmartTagScreen initializes in PAIRED state when persisted pairedPhysicalUid exists on restart', async () => {
  const code = ts.transpileModule(
    fs.readFileSync(path.resolve('apps/mobile/src/features/smarttag/screens/SyncSmartTagScreen.tsx'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }
  ).outputText;

  const state = [];
  const refs = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (v) => { state[i] = typeof v === 'function' ? v(state[i]) : v; }];
    },
    useRef(initial) {
      const i = cursor++;
      return refs[i] ||= { current: initial };
    },
    useEffect() {},
  };

  const mod = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod.exports,
    require(id) {
      if (id === 'react') return react;
      if (id === 'react-native') {
        return {
          StyleSheet: { create: (v) => v },
          Platform: { OS: 'android' },
          ...Object.fromEntries(['View', 'Text', 'Image', 'ScrollView', 'TouchableOpacity', 'Modal'].map((n) => [n, n])),
        };
      }
      if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
      if (id === '@polyaero/shared') {
        return {
          NfcCancelledError: class extends Error {},
          NFC_STATE_MESSAGES: { IDLE: 'Ready', CANCELLED: 'Cancelled' },
          buildNfcPayloadForBag: () => ({}),
          runSmartTagSync: async () => ({ finalState: 'SUCCESS' }),
        };
      }
      if (id.includes('services/nfc/hardwareScan')) {
        return {
          scanPhysicalTag: async () => ({ tagUid: '04:AA:BB:CC:DD:EE:FF', isMockSimulation: false }),
          cancelPhysicalTagScan: async () => {},
          openNfcSettings: async () => true,
          formatTagUid: (s) => s.toUpperCase(),
        };
      }
      if (id.includes('services/nfc')) {
        return { demoNfcService: {}, getPhysicalNfcService: () => null };
      }
      if (id === '../store') {
        return {
          useSmartTagStore: () => ({
            repo: {
              itineraries: [{ id: 'trip_1', booking: { bookingReference: '8K3F7D' }, flight: { flightNumber: 'CX548' } }],
              activeItineraryId: 'trip_1',
              activeBagSetupId: 'bag_1',
              bagSetupsByItinerary: {
                trip_1: [{
                  id: 'bag_1',
                  smartTagCode: 'ST-2048',
                  displayBagCode: 'CX880123456',
                  setupState: 'PENDING_PHYSICAL_WRITE',
                  smartTag: { tagUid: '04:AA:BB:CC:DD:EE:FF' },
                  pairedPhysicalUid: '04:AA:BB:CC:DD:EE:FF',
                }],
              },
            },
          }),
          smartTagRepository: {
            pairPhysicalTagToBag: () => {},
            recordSyncOutcome: () => {},
          },
          smartTagController: { navigateTo() {}, goBack() {} },
        };
      }
      return new Proxy({}, { get: (_, n) => n });
    },
  });

  const screenNodes = mod.exports.SyncSmartTagScreen({});
  const renderedJson = JSON.stringify(screenNodes);
  assert.match(renderedJson, /NFC_CHIP_READ_SUCCESS/);
  assert.match(renderedJson, /04:AA:BB:CC:DD:EE:FF/);
  assert.match(renderedJson, /SMARTTAG_PAIRED/);
  assert.match(renderedJson, /Rescan \/ pair another NFC chip/);
});

test('Native persistent storage adapter reads, writes, and survives adapter re-instantiation via file backend', () => {
  const virtualDisk = new Map();
  class MockFile {
    constructor(dir, name) { this.path = `${dir}/${name}`; }
    get exists() { return virtualDisk.has(this.path); }
    create() { if (!virtualDisk.has(this.path)) virtualDisk.set(this.path, ''); }
    writeSync(val) { virtualDisk.set(this.path, val); }
    textSync() { return virtualDisk.get(this.path) ?? ''; }
    delete() { virtualDisk.delete(this.path); }
  }

  const code = ts.transpileModule(
    fs.readFileSync(path.resolve('apps/mobile/src/services/storage/persistentStorage.native.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }
  ).outputText;

  const mod1 = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod1.exports,
    require(id) {
      if (id === 'expo-file-system') return { File: MockFile, Paths: { document: 'file:///data/doc' } };
      return {};
    },
  });
  const adapter1 = mod1.exports.createPersistentStorageAdapter();
  adapter1.setItem('polyaero.smarttag.passenger.v2', JSON.stringify({ uid: '04:11:22:33:44:55:66' }));

  // Re-instantiate native storage module on fresh memory map (app restart)
  const mod2 = { exports: {} };
  vm.runInNewContext(code, {
    exports: mod2.exports,
    require(id) {
      if (id === 'expo-file-system') return { File: MockFile, Paths: { document: 'file:///data/doc' } };
      return {};
    },
  });
  const adapter2 = mod2.exports.createPersistentStorageAdapter();
  const loaded = JSON.parse(adapter2.getItem('polyaero.smarttag.passenger.v2'));
  assert.equal(loaded.uid, '04:11:22:33:44:55:66');

  adapter2.removeItem('polyaero.smarttag.passenger.v2');
  assert.equal(adapter2.getItem('polyaero.smarttag.passenger.v2'), null);
});
