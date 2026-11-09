const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || process.cwd();
const ts = require(path.join(root, 'node_modules/typescript'));
const file = path.join(root, 'apps/mobile/src/features/smarttag/screens/BaggageJourneyScreen.tsx');
const source = fs.readFileSync(file, 'utf8');
const flight = { flightNumber: 'CX100', origin: 'HKG', destination: 'LHR' };
const itinerary = { id: 'trip', flight };
const bag = { id: 'bag', lastWrite: { mode: 'SIMULATED_DEMO' } };
let journey;
let nav;
const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }) };
const moduleResult = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, {
  exports: moduleResult.exports,
  module: moduleResult,
  require: (id) => {
    if (id === 'react') return react;
    if (id === 'react-native') return { StyleSheet: { create: value => value }, Platform: { OS: 'web' }, ...Object.fromEntries(['View', 'Text', 'ScrollView', 'TouchableOpacity'].map(name => [name, name])) };
    if (id === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (id.includes('CathaySmartTagPrimitives')) return { JadeStatusCard: 'JadeStatusCard', InlineNotice: 'InlineNotice', HeaderSoftWave: 'HeaderSoftWave' };
    if (id === '../store') return {
      smartTagRepository: { getJourneyView: () => journey },
      smartTagController: { goBack() {}, navigateTo: (...args) => { nav = args; } },
      useSmartTagStore: () => ({ repo: { activeItineraryId: 'trip', itineraries: [itinerary], bagSetupsByItinerary: { trip: [bag] } } }),
    };
    throw Error(`Unexpected require ${id}`);
  },
});
const render = () => moduleResult.exports.BaggageJourneyScreen({});
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : [];
const text = tree => tree && typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree ?? '');
const item = (key, state, timestamp = null, isSimulated = false) => ({ key, title: `Milestone ${key}`, subtitle: `Details ${key}`, state, timestamp, sourceLabel: 'Airport source', isSimulated });
journey = { bag, items: [item('tag_synced', 'completed', '2026-11-10T20:14:00Z'), item('next', 'current'), item('future', 'pending')], statusBadgeLabel: 'Awaiting bag-drop', isSimulated: true, lastUpdatedAt: '2026-11-10T20:14:00Z' };
let tree = render();
let all = nodes(tree);
assert.equal(all.find(n => n.type === 'JadeStatusCard').props.title, journey.statusBadgeLabel);
assert.match(text(tree), /Milestone next/);
assert.match(text(tree), /Pending/);
assert.match(text(tree), /Simulated/);
assert.match(text(tree), /Airport source/);
assert.match(text(tree), /UTC/);
assert.doesNotMatch(text(tree), /Last updated 2 min ago/);
assert.equal(all.filter(n => n.type === 'Ionicons' && n.props.name === 'checkmark').length, 1);
assert.equal(all.filter(n => n.type === 'Ionicons' && n.props.name === 'refresh').length, 0);
for (const state of ['delayed', 'exception']) {
  journey = { ...journey, statusBadgeLabel: state, items: [item('problem', state)], isSimulated: false, lastUpdatedAt: null };
  tree = render();
  assert.match(text(tree), new RegExp(state, 'i'));
  assert.equal(nodes(tree).filter(n => n.type === 'Ionicons' && n.props.name === 'checkmark').length, 0);
  assert.equal(nodes(tree).find(n => n.type === 'JadeStatusCard').props.subtitle, 'Details problem');
}
journey = { ...journey, items: [item('future', 'current', null), item('invalid', 'pending', 'bad date')], lastUpdatedAt: 'bad date' };
tree = render();
assert.doesNotMatch(text(tree), /Invalid Date|NaN|Arrived in Tokyo/);
for (const button of nodes(tree).filter(n => n.type === 'TouchableOpacity')) {
  assert.equal(button.props.accessibilityRole, 'button');
  assert.ok(button.props.accessibilityLabel);
}
nodes(tree).find(n => n.props.testID === 'btn-report-issue-entry').props.onPress();
assert.equal(nav[0], 'report');
assert.equal(nav[1].itineraryId, 'trip');
assert.equal(nav[1].bagSetupId, 'bag');
console.log('Journey screen checks passed: source-driven states, demo/source labels, timestamps, actions, accessibility.');
