const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
function harness() {
  const state = []; const refs = []; let cursor = 0; let cleanup;
  let scanOptions; let complete; let cancelCalls = 0; let recorded = 0; let navigated = 0;
  const bag = { id: 'bag', setupState: 'PENDING_PHYSICAL_WRITE', smartTag: { tagUid: 'UID' } };
  const service = { setMockTag() {}, cancelScan: async () => { cancelCalls++; } };
  class Cancelled extends Error {}
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) { const i=cursor++; if (!(i in state)) state[i]=initial; return [state[i],v=>state[i]=v]; },
    useRef(initial) { const i=cursor++; return refs[i] ||= { current: initial }; },
    useEffect(fn) { cleanup ||= fn(); },
  };
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve('apps/mobile/src/features/smarttag/screens/SyncSmartTagScreen.tsx'),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports:mod.exports,require(id){
    if(id==='react')return react;
    if(id==='react-native')return {StyleSheet:{create:v=>v},Platform:{OS:'web'},...Object.fromEntries(['View','Text','Image','ScrollView','TouchableOpacity'].map(n=>[n,n]))};
    if(id==='@expo/vector-icons')return {Ionicons:'Ionicons'};
    if(id==='@polyaero/shared')return {NfcCancelledError:Cancelled,NFC_STATE_MESSAGES:{IDLE:'Idle',CANCELLED:'Cancelled'},buildNfcPayloadForBag:()=>({}),runSmartTagSync:options=>{scanOptions=options;options.onStep({state:'SCANNING',statusMessage:'Scanning'});return new Promise(resolve=>{complete=resolve;});}};
    if(id.includes('services/nfc/hardwareScan'))return {scanPhysicalTag:async()=>({tagUid:'UID',isMockSimulation:false}),cancelPhysicalTagScan:async()=>{}};
    if(id.includes('services/nfc'))return {demoNfcService:service,getPhysicalNfcService:()=>null};
    if(id==='../store')return {useSmartTagStore:()=>({repo:{itineraries:[{id:'trip'}],bagSetupsByItinerary:{trip:[bag]}}}),smartTagRepository:{recordSyncOutcome:()=>recorded++},smartTagController:{navigateTo:()=>navigated++,goBack(){}}};
    return new Proxy({},{get:(_,n)=>n});
  }});
  const render=()=>{cursor=0;return mod.exports.SyncSmartTagScreen({});};
  const nodes=t=>!t||typeof t!=='object'?[]:[t,...t.children.flatMap(nodes)];
  return {render,find:id=>nodes(render()).find(n=>n.props.testID===id),get options(){return scanOptions;},complete:()=>complete({finalState:'SUCCESS'}),get result(){return {cancelCalls,recorded,navigated};},unmount:()=>cleanup?.(),bag};
}
test('Sync physical action refuses unavailable hardware, never silently simulates',async()=>{
 const h=harness(); await h.find('btn-start-sync').props.onPress();
 assert.equal(h.options,undefined); assert.match(JSON.stringify(h.render()),/Physical NFC unavailable/);
});
test('Cancelled demo never records success; cancellation between RF steps stops next write',async()=>{
 const h=harness(); const running=h.find('btn-demo-sync').props.onPress();
 assert.equal(h.options.mode,'SIMULATED_DEMO');
 await h.find('btn-cancel-sync').props.onPress();
 assert.throws(()=>h.options.onStep({state:'WRITING'}));
 h.complete(); await running;
 assert.deepEqual(h.result,{cancelCalls:1,recorded:0,navigated:0});
});
test('Unmount cancels active NFC operation and discards late success',async()=>{
 const h=harness(); const running=h.find('btn-demo-sync').props.onPress();
 h.unmount(); h.complete(); await running;
 assert.deepEqual(h.result,{cancelCalls:1,recorded:0,navigated:0});
});
