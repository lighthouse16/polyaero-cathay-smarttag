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

  const scanPhysicalTagMock = mockOverrides.scanPhysicalTag || (async () => ({
    tagUid: '04:E1:92:AA:BB:CC:DD',
    techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.Ndef'],
    ndefText: 'Cathay SmartTag Prototype ST-2048',
    isMockSimulation: false,
  }));

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
