const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const screenRoot = resolve(__dirname, '../apps/mobile/src/features/smarttag/screens');
const declarations = {
  checkInConfirmed: true,
  dangerousGoodsDeclared: true,
  tagSecuredToLuggage: true,
  airportAcceptanceUnderstood: true,
};
const itinerary = {
  id: 'flight', checkInReadiness: 'DEMO_CHECK_IN_COMPLETED', checkedBagAllowance: 2,
  flight: { flightNumber: 'CX548', origin: 'HKG', destination: 'NRT' },
};
function harness(screen, bagOverrides = {}, itineraryOverrides = {}) {
  const bag = { id: 'bag', smartTagCode: 'ST-2048', setupState: 'UNREGISTERED',
    declarations: { ...declarations }, preparedAt: null, lastWrite: null, ...bagOverrides };
  const repo = { itineraries: [{ ...itinerary, ...itineraryOverrides }], activeItineraryId: 'flight',
    activeBagSetupId: 'bag', bagSetupsByItinerary: { flight: [bag] },
    ownedTags: [{ smartTagCode: 'ST-2048' }] };
  let cursor = 0;
  const state = [];
  const calls = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
  };
  const exports = {};
  const source = readFileSync(resolve(screenRoot, `${screen}.tsx`), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const names = new Proxy({}, { get: (_, name) => name });
  runInNewContext(code, { exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { ...Object.fromEntries(['View', 'Text', 'ScrollView', 'TouchableOpacity', 'Image'].map(n => [n, n])),
      Platform: { OS: 'web' }, StyleSheet: { create: value => value } };
    if (name === '@polyaero/shared') return { DEFAULT_DECLARATIONS: declarations,
      areDeclarationsComplete: value => Object.values(value).every(Boolean) };
    if (name === '../store') return { useSmartTagStore: () => ({ repo }),
      smartTagController: { navigateTo: (...args) => calls.push(args), goBack() {} },
      smartTagRepository: { prepareBagsForItinerary: value => { calls.push(value); return { bags: [bag] }; } } };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    return names;
  } });
  const render = () => { cursor = 0; return exports[screen]({}); };
  return { render, calls, repo };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...tree.children.flatMap(nodes)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const cta = tree => find(tree, node => node.props.testID === 'btn-continue-prepare');
const text = tree => JSON.stringify(tree);
function acknowledge(h) {
  for (const checkbox of nodes(h.render()).filter(node => node.props.accessibilityRole === 'checkbox')) checkbox.props.onPress();
}

test('Prepare requires explicit acknowledgements and SmartTag readiness', () => {
  const h = harness('PrepareSmartTagScreen');
  assert.equal(cta(h.render()).props.disabled, true);
  const checkboxes = nodes(h.render()).filter(n => n.props.accessibilityRole === 'checkbox');
  assert.equal(checkboxes.length, 5);
  assert.ok(checkboxes.every(n => n.props.accessibilityState.checked === false));
  acknowledge(h);
  assert.equal(cta(h.render()).props.disabled, false);
  cta(h.render()).props.onPress();
  assert.equal(h.calls.at(-1)[0], 'sync');
});

test('Prepare never continues without check-in, piece allowance, or owned tag', () => {
  for (const overrides of [{ checkInReadiness: 'CHECK_IN_PENDING' }, { checkedBagAllowance: 0 }]) {
    const h = harness('PrepareSmartTagScreen', {}, overrides);
    acknowledge(h);
    assert.equal(cta(h.render()).props.disabled, true);
    cta(h.render()).props.onPress();
    assert.equal(h.calls.length, 0);
  }
  const h = harness('PrepareSmartTagScreen');
  h.repo.ownedTags = [];
  acknowledge(h);
  assert.equal(cta(h.render()).props.disabled, true);
  cta(h.render()).props.onPress();
  assert.equal(h.calls.length, 0);
});

test('Prepare displays repository piece allowance without claiming weight verification', () => {
  const h = harness('PrepareSmartTagScreen', {}, { checkedBagAllowance: 3 });
  assert.match(text(h.render()), /3 checked bags/);
  assert.doesNotMatch(text(h.render()), /23 kg|Baggage within allowance|E-ticket and baggage allowance verified/);
});

test('Ready rejects incomplete, failed, and unverified physical writes', () => {
  const invalid = ['UNREGISTERED', 'LINKED', 'PENDING_PHYSICAL_WRITE', 'WRITE_FAILED'].map(setupState => ({ setupState }));
  invalid.push({ setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED' });
  invalid.push({ setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED', lastWrite: { mode: 'SIMULATED_DEMO', verifiedHardwareReadback: true } });
  invalid.push({ setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED', lastWrite: { mode: 'PHYSICAL_HARDWARE', verifiedHardwareReadback: false } });
  for (const bag of invalid) {
    const h = harness('SmartTagReadyScreen', bag);
    const tree = h.render();
    assert.equal(find(tree, node => node.props.testID === 'btn-view-journey-from-ready'), undefined);
    const back = find(tree, node => node.props.testID === 'btn-return-to-smarttag-setup');
    assert.ok(back, bag.setupState);
    back.props.onPress();
    assert.ok(['prepare', 'sync'].includes(h.calls[0][0]));
    assert.doesNotMatch(text(tree), /successfully written|Your SmartTag/);
  }
});

test('Ready labels simulation demo and only claims physical write with verified hardware record', () => {
  const demo = harness('SmartTagReadyScreen', { setupState: 'SIMULATED_WRITE_COMPLETED' });
  assert.match(text(demo.render()), /Demo SmartTag/);
  assert.match(text(demo.render()), /No physical tag was written/);
  const physical = harness('SmartTagReadyScreen', { setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED',
    lastWrite: { mode: 'PHYSICAL_HARDWARE', verifiedHardwareReadback: true } });
  assert.ok(find(physical.render(), node => node.props.testID === 'btn-view-journey-from-ready'));
  assert.match(text(physical.render()), /successfully written/);
});

test('Prepare retains saved acknowledgements but blocks when any is revoked', () => {
  const h = harness('PrepareSmartTagScreen', { preparedAt: '2026-11-09T00:00:00Z' });
  const tree = h.render();
  find(tree, n => n.props.testID === 'checkbox-smarttag-ready').props.onPress();
  assert.equal(cta(h.render()).props.disabled, false);
  find(h.render(), n => n.props.testID === 'checkbox-dangerousGoodsDeclared').props.onPress();
  assert.equal(cta(h.render()).props.disabled, true);
  cta(h.render()).props.onPress();
  assert.equal(h.calls.length, 0);
});

test('Ready never substitutes another bag for unknown active bag', () => {
  const h = harness('SmartTagReadyScreen', { setupState: 'SIMULATED_WRITE_COMPLETED' });
  h.repo.activeBagSetupId = 'unknown';
  assert.equal(find(h.render(), n => n.props.testID === 'btn-view-journey-from-ready'), undefined);
  assert.match(text(h.render()), /No synchronized SmartTag found/);
});
