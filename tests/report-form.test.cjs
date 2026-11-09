// Run from repository root: node <absolute path to this file>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));
const sourcePath = path.resolve('apps/mobile/src/features/smarttag/screens/ReportBaggageIssueScreen.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const state = [];
let cursor = 0;
let result = { validationError: 'Please provide a short description of at least 8 characters.' };
let submitted;
let throwing = false;
const repo = {
  activeItineraryId: 'trip', activeBagSetupId: 'bag',
  itineraries: [{ id: 'trip', flight: { flightNumber: 'CX520', origin: 'HKG', destination: 'NRT' } }],
  bagSetupsByItinerary: { trip: [{ id: 'bag' }] }, recoveryByBagSetupId: {},
};
const react = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  useState: (initial) => {
    const slot = cursor++;
    if (!(slot in state)) state[slot] = initial;
    return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
  },
};
const store = {
  useSmartTagStore: () => ({ repo }),
  smartTagController: { goBack() {}, navigateTo() {} },
  smartTagRepository: { createRecoveryCase(input) {
    submitted = input;
    if (throwing) throw Error('Repository failed');
    if (result.record) repo.recoveryByBagSetupId.bag = result.record;
    return result;
  } },
};
const moduleStub = { exports: {} };
const compiled = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
} }).outputText;
vm.runInNewContext(compiled, {
  module: moduleStub, exports: moduleStub.exports,
  require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return {
      StyleSheet: { create: (styles) => styles }, Platform: { OS: 'web' },
      View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput',
    };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name === '../store') return store;
    if (name.includes('CathaySmartTagPrimitives')) return {
      CathayPrimaryButton: 'CathayPrimaryButton', InlineNotice: 'InlineNotice',
      BrushwingFlightSummaryCard: 'BrushwingFlightSummaryCard',
    };
    throw Error(`Unexpected import: ${name}`);
  },
});
const render = () => { cursor = 0; return moduleStub.exports.ReportBaggageIssueScreen({}); };
const nodes = (tree) => typeof tree === 'object' && tree ? [tree, ...tree.children.flatMap(nodes)] : [];
const find = (tree, predicate) => nodes(tree).find(predicate);
const testId = (tree, id) => find(tree, (node) => node.props.testID === id);
const input = (tree) => find(tree, (node) => node.type === 'TextInput');
const submit = (tree) => testId(tree, 'btn-submit-issue-report').props.onPress();
let tree = render();
assert.equal(testId(tree, 'issue-type-selector').props.accessibilityState.expanded, false);
for (const value of ['NOT_LOCATED', 'TAG_DAMAGED_OR_UNREADABLE', 'DELAYED', 'GENERAL_ASSISTANCE']) {
  testId(tree, 'issue-type-selector').props.onPress();
  tree = render();
  const choices = nodes(tree).filter((node) => node.props.accessibilityRole === 'radio');
  assert.equal(choices.length, 4);
  testId(tree, `issue-type-${value}`).props.onPress();
  tree = render();
  assert.equal(testId(tree, 'issue-type-selector').props.accessibilityState.expanded, false);
  input(tree).props.onChangeText('short');
  tree = render();
  submit(tree);
  tree = render();
  assert.equal(submitted.issueType, value);
  assert.equal(submitted.description, 'short');
  assert.equal(input(tree).props.value, 'short');
  assert.equal(find(tree, (node) => node.type === 'InlineNotice').props.message, result.validationError);
}
throwing = true;
submit(tree);
tree = render();
assert.equal(input(tree).props.value, 'short');
assert.match(find(tree, (node) => node.type === 'InlineNotice').props.message, /details are still here/);
throwing = false;
input(tree).props.onChangeText('   ');
tree = render();
submit(tree);
assert.equal(submitted.description, 'Other baggage assistance');
result = { record: { recoveryCase: { caseNumber: 'REC-2026-0841' }, isSimulatedDemo: true } };
submit(tree);
tree = render();
assert.equal(input(tree), undefined);
assert.match(JSON.stringify(tree), /Demo report saved/);
assert.match(JSON.stringify(tree), /REC-2026-0841/);
assert.doesNotMatch(source, /hasPhoto|baggage_tag\.jpg|Photo attached/);
assert.match(source, /Not supported in this build/);
console.log('PASS: four issue mappings, accessible choices, validation and thrown errors preserve draft, optional description fallback, existing recovery success, no fake photo.');
