import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildReviewedShelf } from '../src/core/buildReviewedShelf.js';
import { buildGlbFrame, computeGlbStats } from '../src/core/buildGlbFrame.js';
import { buildPurchaseRows } from '../src/ui/purchaseList.js';

globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>({addColorStop(){}})}),width:256,height:256})};

test('standard acrylic procurement lists actual sheets and pads with no phantom clamps', () => {
  const b=buildReviewedShelf({bays:2,levels:2,bayWidths:[.3,1.2],decks:['acrylic','acrylic']},false);
  try {
    assert.ok(!b.stats.hardware.some(h=>h.name==='亚克力支撑卡扣'),'no clamp geometry is present');
    const rows=buildPurchaseRows(b.stats,'profile',b.config).detail;
    const sheets=rows.filter(r=>r[0]==='板件'&&r[1]==='磨砂亚克力层板');
    assert.equal(sheets.reduce((sum,r)=>sum+r[7],0),b.groups.pane.count);
    assert.ok(sheets.every(r=>r[3]>0&&r[4]===.36&&r[5]===.008));
    const m=new THREE.Matrix4();let area=0;
    for(let i=0;i<b.groups.pane.count;i++){b.groups.pane.getMatrixAt(i,m);area+=new THREE.Vector3().setFromMatrixScale(m).x*.36;}
    assert.ok(Math.abs(area-sheets.reduce((sum,r)=>sum+r[3]*r[4]*r[7],0))<1e-5);
    assert.equal(b.stats.hardware.find(h=>h.name==='EVA 缓冲垫片').qty,b.groups.pads.count);
  }finally{b.dispose();}
});

test('far-view LOD retains the same rib levels as the default physical assembly', () => {
  const b=buildGlbFrame();
  try {
    const ys=mesh=>{
      const m=new THREE.Matrix4(),out=new Set();
      for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);out.add(m.elements[13].toFixed(4));}
      return [...out].sort();
    };
    assert.deepEqual(ys(b.groups.stripsLOD),ys(b.groups.strips));
  }finally{b.dispose();}
});

test('geometry and statistics apply identical validation to invalid frame dimensions', () => {
  for(const cfg of [{levels:0},{levels:9},{levels:2.5},{bayWidths:[]}]){
    assert.throws(()=>buildGlbFrame(cfg),/Invalid reference dimensions/);
    assert.throws(()=>computeGlbStats(cfg),/Invalid reference dimensions/);
  }
  const b=buildGlbFrame({levels:null,bayWidths:null});
  try{assert.deepEqual(computeGlbStats({levels:null,bayWidths:null}),Object.fromEntries(Object.entries(b.stats).filter(([k])=>k!=='envelope')));}finally{b.dispose();}
});

test('GLB configurations without rib shelves omit zero-quantity rod purchases', () => {
  for (const deck of ['acrylic','none']) {
    const b=buildGlbFrame({bayWidths:[.3,.3],levels:2,decks:[deck,deck]});
    try {
      assert.ok(b.stats.cutList.every(c=>c.qty>0));
      assert.ok(!b.stats.cutList.some(c=>c.spec==='GLB 20×20 精确层板条'));
    }finally{b.dispose();}
  }
});
