import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as persistence from '../src/ui/persist.js';
import { buildHanger } from '../src/core/buildHanger.js';
import { buildShelf } from '../src/core/buildShelf.js';
import { buildReviewedShelf } from '../src/core/buildReviewedShelf.js';
import { DEFAULT_CONFIG } from '../src/config/product.js';
import { buildGlbFrame } from '../src/core/buildGlbFrame.js';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { buildCartTable } from '../src/core/buildCartTable.js';
import { buildCratesRack } from '../src/core/buildCratesRack.js';
import { buildWoodCart } from '../src/core/buildWoodCart.js';
import { buildSheetCabinet, cloneSheetGroup } from '../src/core/buildSheetCabinet.js';
import { flattenToPlainMeshes } from '../src/ui/modelExport.js';
import { measureAssembly } from '../src/core/assemblyEnvelope.js';
import { createPanel } from '../src/ui/panel.js';
import { store } from '../src/ui/store.js';

function matrices(root) {
  root.updateMatrixWorld(true);
  const out=new Map();root.traverse(o=>out.set(o,o.matrixWorld.clone()));return out;
}
function sameMatrices(root, expected) {
  root.updateMatrixWorld(true);
  for(const [o,m] of expected) for(let i=0;i<16;i++)
    assert.ok(Math.abs(o.matrixWorld.elements[i]-m.elements[i])<1e-8,`${o.name || o.type} matrix[${i}] changed`);
}

test('X01: every product survives node-close, explode, reveal interruption and rapid toggles',async()=>{
  let time=0;const originalPerformance=globalThis.performance,originalWindow=globalThis.window,originalDocument=globalThis.document;
  const ctx=new Proxy({}, {get:(_target,key)=>String(key).startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
  globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})};
  Object.defineProperty(globalThis,'performance',{value:{now:()=>time},configurable:true});
  try {
    for(const reduced of [false,true]) {
      globalThis.window={matchMedia:()=>({matches:reduced})};
      const {createAnims}=await import(`../src/core/anims.js?reviewReduced=${reduced}`);
      const builds = [
        () => buildHanger({style:'classic'}), () => buildHanger({style:'atelier'}),
        () => buildShelf(DEFAULT_CONFIG, false), () => buildReviewedShelf(DEFAULT_CONFIG, false),
        () => buildGlbFrame({bayWidths:[.57,.57], levels:3, props:false}),
        ...['poster', 'panel', 'acrylic'].map(style => () => buildRodRack({style})),
        () => buildBookshelf({}), () => buildBookshelf({style:'table'}),
        () => buildCartTable({}), () => buildCratesRack({}), () => buildWoodCart({}),
        () => buildSheetCabinet({}),
      ];
      for (const build of builds) {
      const p = await build();
      try {
        const expected=matrices(p.group);
        const envelope=measureAssembly(p.group).envelope;
        const a=createAnims(new THREE.PerspectiveCamera(),{target:new THREE.Vector3(),addEventListener(){}});
        const settle=()=>{time+=4000;a.update();};
        a.explode(p.groups,false);settle();sameMatrices(p.group,expected);
        assert.deepEqual(measureAssembly(flattenToPlainMeshes(p.group,'roundtrip')).envelope,envelope,'portable export must retain the original envelope');
        a.explode(p.groups,true);settle();
        a.explode(p.groups,false);settle();sameMatrices(p.group,expected);
        a.revealGroups(p.group.children);time+=80;a.update();
        a.explode(p.groups,true);time+=100;a.update();
        a.explode(p.groups,false);time+=40;a.update();
        a.explode(p.groups,true);time+=60;a.update();
        a.explode(p.groups,false);settle();sameMatrices(p.group,expected);
      }finally{p.dispose();}
      }
    }
  }finally{
    Object.defineProperty(globalThis,'performance',{value:originalPerformance,configurable:true});
    globalThis.window=originalWindow;
    globalThis.document=originalDocument;
  }
});

test('STATE-01: old table links and saved configurations migrate to the independent table without erasing the source',()=>{
  const originalLocation=globalThis.location,originalStorage=globalThis.localStorage;
  const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const old={schemaVersion:2,kind:'books',style:'table',tBays:2,tBayW:.95,depth:.4,glassTop:false};
  const oldEncoded=persistence.encodeCfg(old);
  globalThis.location={hash:'#books/side?c='+oldEncoded};
  try {
    assert.equal(typeof persistence.resolveStartupProduct,'function');
    assert.equal(typeof persistence.migrateLegacyTableStorage,'function');
    const route=persistence.resolveStartupProduct();
    assert.equal(route.kind,'table');assert.match(route.hash,/^#table\/side\?c=/);
    globalThis.location.hash=route.hash;
    const shared=persistence.loadSaved('table');
    assert.equal(shared.tBays,2);assert.equal(shared.tBayW,.95);assert.equal(shared.glassTop,false);
    values.set('alu.cfg.books',oldEncoded);globalThis.location.hash='#profile';
    persistence.migrateLegacyTableStorage();
    assert.equal(values.get('alu.cfg.books'),oldEncoded);
    assert.equal(persistence.loadSaved('books'),null);
    assert.equal(persistence.loadSaved('table').tBays,2);
    values.set('alu.cfg.table',persistence.encodeCfg({...old,kind:'table',tBays:1}));
    persistence.migrateLegacyTableStorage();assert.equal(persistence.loadSaved('table').tBays,1);
    const loaded=persistence.resolveProductConfig('books',old);
    assert.equal(loaded.kind,'table');assert.equal(loaded.cfg.kind,'table');assert.equal(old.kind,'books');
    assert.equal(persistence.resolveProductConfig('books',{style:'tower'}).kind,'books');
    assert.equal(persistence.resolveProductConfig('profile',{schemaVersion:2,frameMode:'standard'}).cfg.frameMode,'standard');
  }finally{globalThis.location=originalLocation;globalThis.localStorage=originalStorage;}
});

test('STATE-02: product rebuild after dispose keeps independent live materials', async()=>{
  const cases=[
    ['hanger-classic',()=>buildHanger({style:'classic'}),()=>buildHanger({style:'classic'})],
    ['hanger-atelier',()=>buildHanger({style:'atelier'}),()=>buildHanger({style:'atelier'})],
    ['cart',()=>buildCartTable({}),()=>buildCartTable({})],
    ['crates',()=>buildCratesRack({}),()=>buildCratesRack({})],
    ['woodcart',()=>buildWoodCart({}),()=>buildWoodCart({})],
    ['books',()=>buildBookshelf({}),()=>buildBookshelf({})],
    ['table',()=>buildBookshelf({style:'table'}),()=>buildBookshelf({style:'table'})],
    ['rod',()=>buildRodRack({style:'poster'}),()=>buildRodRack({style:'poster'})],
    ['sheet',()=>buildSheetCabinet({}),()=>buildSheetCabinet({})],
  ];
  for(const [name,build,rebuild] of cases){
    const a=await build();
    const firstMaterials=new Set();
    a.group.traverse(o=>{
      if(!o.isMesh)return;
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))firstMaterials.add(m);
    });
    a.dispose();
    const b=await rebuild();
    try {
      const secondMaterials=new Set();
      b.group.traverse(o=>{
        if(!o.isMesh)return;
        for(const m of (Array.isArray(o.material)?o.material:[o.material]))secondMaterials.add(m);
      });
      assert.ok(secondMaterials.size>0,`${name}: rebuilt model has no materials`);
      for(const m of secondMaterials){
        assert.notEqual(m.disposed,true,`${name}: rebuilt model reuses a disposed material`);
        assert.ok(Number.isFinite(m.opacity),`${name}: invalid material opacity`);
      }
    } finally {b.dispose();}
  }
});

test('STATE-03: sheet cabinet template clones own geometry, materials and textures', ()=>{
  const sourceTexture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  const sourceMaterial=new THREE.MeshStandardMaterial({map:sourceTexture,alphaMap:sourceTexture});
  const source=new THREE.Group();
  source.add(new THREE.Mesh(new THREE.BoxGeometry(),sourceMaterial));

  const a=cloneSheetGroup(source),b=cloneSheetGroup(source);
  const aMaterial=a.group.children[0].material,bMaterial=b.group.children[0].material;
  assert.equal(a.textures.length,1,'a shared source texture slot must be cloned once per instance');
  assert.equal(b.textures.length,1);
  assert.notEqual(a.textures[0],sourceTexture);
  assert.notEqual(b.textures[0],sourceTexture);
  assert.notEqual(a.textures[0],b.textures[0]);
  assert.equal(aMaterial.map,a.textures[0]);
  assert.equal(aMaterial.alphaMap,a.textures[0]);
  assert.equal(bMaterial.map,b.textures[0]);

  a.textures[0].dispose();
  assert.notEqual(b.textures[0].disposed,true,'disposing one clone must not release another instance texture');
  for(const texture of [...a.textures,...b.textures])texture.dispose();
  for(const material of [...a.materials,...b.materials])material.dispose();
  for(const geometry of [...a.geometries,...b.geometries])geometry.dispose();
  sourceTexture.dispose();sourceMaterial.dispose();source.children[0].geometry.dispose();
});

test('STATE-03b: async sheet cabinet instances own geometry, materials and guide lines', async()=>{
  const a=await buildSheetCabinet({});
  const b=await buildSheetCabinet({});
  const owned=new Set();
  a.group.traverse(o=>{
    if(!o.isMesh&&!o.isLine&&!o.isLineSegments)return;
    if(o.geometry)owned.add(o.geometry);
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)owned.add(m);
  });
  let shared=0;
  b.group.traverse(o=>{
    if(!o.isMesh&&!o.isLine&&!o.isLineSegments)return;
    if(o.geometry&&owned.has(o.geometry))shared++;
    for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&owned.has(m))shared++;
  });
  assert.equal(shared,0,'two sheet cabinet instances must not share owned GPU resources');
  a.dispose();
  let lines=0,meshes=0;
  b.group.traverse(o=>{if(o.isLine||o.isLineSegments)lines++;if(o.isMesh)meshes++;});
  assert.ok(lines>0);assert.ok(meshes>0);
  b.dispose();
});

function fakeElement(tag='div') {
  const element={
    tagName:tag.toUpperCase(),children:[],parentNode:null,dataset:{},style:{},
    classList:{toggle(){},add(){},remove(){}},attributes:{},innerHTML:'',textContent:'',
    spec:{},nums:{},acts:{},
    appendChild(child){child.parentNode=this;this.children.push(child);return child;},
    insertBefore(child){child.parentNode=this;this.children.push(child);return child;},
    remove(){
      if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);
      this.parentNode=null;
    },
    setAttribute(key,value){this.attributes[key]=String(value);},
    removeAttribute(key){delete this.attributes[key];},
    addEventListener(){},removeEventListener(){},
    querySelector(selector){
      if(selector.startsWith('[data-spec=')){
        const key=selector.match(/"([whdp])"/)[1];
        return this.spec[key]??=fakeElement();
      }
      if(selector.startsWith('[data-num=')){
        const key=selector.match(/"([^"]+)"/)[1];
        return this.nums[key]??=fakeElement();
      }
      if(selector.startsWith('[data-act=')){
        const key=selector.match(/"([^"]+)"/)[1];
        return this.acts[key]??=fakeElement();
      }
      if(selector==='[data-deck-summary]')return this.deckSummary??=fakeElement();
      if(selector==='[data-bay-summary]')return this.baySummary??=fakeElement();
      if(selector==='[data-weight]')return this.weight??=fakeElement();
      return fakeElement();
    },
    querySelectorAll(){return[];},
    closest(){return null;},
  };
  return element;
}

test('STATE-05: disposing a profile panel unsubscribes it from store updates',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:fakeElement,body:fakeElement(),querySelector:()=>null,querySelectorAll:()=>[]};
  try {
    const liveRoot=fakeElement(),staleRoot=fakeElement();
    const livePanel=createPanel(liveRoot,{}),stalePanel=createPanel(staleRoot,{});
    const liveSpec=liveRoot.children.find(child=>child.className==='spec-grid');
    const staleSpec=staleRoot.children.find(child=>child.className==='spec-grid');
    assert.equal(typeof stalePanel.dispose,'function');
    stalePanel.dispose();
    const staleBefore=staleSpec.spec.w.innerHTML;
    store.set({bays:store.get().bays===4?5:4});
    assert.notEqual(liveSpec.spec.w.innerHTML,staleBefore,'the live panel must still receive store updates');
    assert.equal(staleSpec.spec.w.innerHTML,staleBefore,'the disposed panel must stop receiving store updates');
    livePanel.dispose();
  } finally { globalThis.document=originalDocument; }
});

test('STATE-04: disposing one product instance never releases geometry still owned by another', async()=>{
  const originalDocument=globalThis.document;
  const ctx=new Proxy({}, {get:(_target,key)=>String(key).startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
  globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>ctx})};
  const cases=[
    ['hanger-classic',()=>buildHanger({style:'classic'})],
    ['hanger-atelier',()=>buildHanger({style:'atelier'})],
    ['profile-standard',()=>buildShelf(DEFAULT_CONFIG,false)],
    ['profile-glb',()=>buildGlbFrame({bayWidths:[.57,.57],levels:3,props:false})],
    ['rod',()=>buildRodRack({style:'poster'})],
    ['books',()=>buildBookshelf({})],
    ['table',()=>buildBookshelf({style:'table'})],
    ['cart',()=>buildCartTable({})],
    ['crates',()=>buildCratesRack({})],
    ['woodcart',()=>buildWoodCart({})],
  ];
  try {
    for(const [name,build] of cases){
      const a=await build(),b=await build();
      const aGeometries=new Set(),aMaterials=new Set();
      a.group.traverse(o=>{
        if(!o.isMesh&&!o.isInstancedMesh)return;
        if(o.geometry)aGeometries.add(o.geometry);
        for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)aMaterials.add(m);
      });
      let sharedGeometries=0,sharedMaterials=0;
      b.group.traverse(o=>{
        if(!o.isMesh&&!o.isInstancedMesh)return;
        if(o.geometry&&aGeometries.has(o.geometry))sharedGeometries++;
        for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m&&aMaterials.has(m))sharedMaterials++;
      });
      if(name==='profile-glb')assert.ok(sharedGeometries>0,`${name}: expected reference-counted geometry cache reuse`);
      else assert.equal(sharedGeometries,0,`${name}: two product instances must not share owned geometry`);
      assert.equal(sharedMaterials,0,`${name}: two product instances must not share owned materials`);
      a.dispose();
      b.group.traverse(o=>{
        if(!o.isMesh&&!o.isInstancedMesh)return;
        assert.notEqual(o.geometry?.disposed,true,`${name}: disposing first instance released live geometry`);
        for(const m of (Array.isArray(o.material)?o.material:[o.material]))
          assert.notEqual(m?.disposed,true,`${name}: disposing first instance released live material`);
      });
      b.dispose();
    }
  } finally { globalThis.document=originalDocument; }
});

