import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { buildRodRack } from '../src/core/buildRodRack.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function box(mesh,i=0){
  mesh.geometry.computeBoundingBox();
  const m=new THREE.Matrix4(); mesh.getMatrixAt(i,m);
  return mesh.geometry.boundingBox.clone().applyMatrix4(m);
}
test('glass anchors preserve the default eight points and remain independent of lower bay configuration',()=>{
  const reference=buildBookshelf({style:'table',tBays:3,tBayW:0.7});
  try {
    for(const [tBays,tBayW] of [[1,2.1],[2,1.05],[3,0.7],[4,0.525]]){
      const p=buildBookshelf({style:'table',tBays,tBayW});
      try {
        assert.equal(p.groups.tableGlassStandoffs.count,8);
        for(let i=0;i<8;i++){
          const stand=box(p.groups.tableGlassStandoffs,i),pad=box(p.groups.tableGlassPads,i);
          const foot=box(p.groups.tableStandoffFeet,i),old=box(reference.groups.tableGlassStandoffs,i);
          near(stand.min.x,old.min.x); near(stand.min.z,old.min.z);
          near(stand.getCenter(new THREE.Vector3()).x,[-1.015,-0.35,0.35,1.015][Math.floor(i/2)]);
          near(stand.max.y,pad.min.y);
          near(pad.max.y,p.groups.tableGlass.position.y-0.004);
          near(foot.min.y,0.88);
          near(foot.getCenter(new THREE.Vector3()).x,pad.getCenter(new THREE.Vector3()).x);
        }
        for(const h of p.stats.hardware.filter(h=>/玻璃/.test(h.name)))assert.equal(h.qty,8);
      } finally {p.dispose();}
    }
  } finally {reference.dispose();}
});
test('glass anchors derive from true tabletop width at every supported total width',()=>{
  for(const [tBays,tBayW] of [[1,0.6],[2,0.9],[3,1.4],[4,0.8]]){
    const p=buildBookshelf({style:'table',tBays,tBayW});
    try {
      const W=tBays*tBayW;
      const expected=[-W/2+0.035,-W/6,W/6,W/2-0.035];
      assert.equal(p.groups.tableGlassStandoffs.count,8);
      for(let i=0;i<8;i++){
        const stand=box(p.groups.tableGlassStandoffs,i);
        const pad=box(p.groups.tableGlassPads,i);
        const foot=box(p.groups.tableStandoffFeet,i);
        const glass=p.groups.tableGlass.geometry.boundingBox.clone()
          .applyMatrix4(p.groups.tableGlass.matrixWorld);
        near(stand.getCenter(new THREE.Vector3()).x,expected[Math.floor(i/2)]);
        near(pad.getCenter(new THREE.Vector3()).x,expected[Math.floor(i/2)]);
        near(foot.getCenter(new THREE.Vector3()).x,expected[Math.floor(i/2)]);
        near(stand.max.y,pad.min.y);
        near(pad.max.y,glass.min.y);
        assert.ok(stand.intersectsBox(foot));
        assert.ok(stand.min.x>glass.min.x&&stand.max.x<glass.max.x,
          'glass support stays inside the glass width');
        assert.ok(stand.min.z>glass.min.z&&stand.max.z<glass.max.z,
          'glass support stays inside the glass depth');
      }
      for(const name of [/玻璃副层板支承立柱/,/玻璃端座\/金属帽/,/玻璃隔振垫/])
        assert.equal(p.stats.hardware.find(h=>name.test(h.name)).qty,8);
    } finally {p.dispose();}
  }
});
test('default reading table glass supports align with upper and lower leg axes',()=>{
  const p=buildBookshelf({style:'table',tBays:3,tBayW:0.7});
  try {
    const standXs=[],standZs=[],legXs=[],legZs=[];
    for(let i=0;i<8;i++){
      const stand=box(p.groups.tableGlassStandoffs,i);
      const pad=box(p.groups.tableGlassPads,i);
      const head=box(p.groups.tableStandoffFeet,i);
      const center=stand.getCenter(new THREE.Vector3());
      standXs.push(center.x); standZs.push(center.z);
      near(head.getCenter(new THREE.Vector3()).x,center.x);
      near(head.getCenter(new THREE.Vector3()).z,center.z);
      near(pad.getCenter(new THREE.Vector3()).x,center.x);
      near(pad.getCenter(new THREE.Vector3()).z,center.z);
    }
    for(let i=0;i<p.groups.tableLevelFeet.count;i++){
      const c=box(p.groups.tableLevelFeet,i).getCenter(new THREE.Vector3());
      legXs.push(c.x); legZs.push(c.z);
    }
    const unique=s=>[...new Set(s.map(v=>v.toFixed(5)))].sort();
    assert.deepEqual(unique(standXs),unique(legXs));
    assert.deepEqual(unique(standZs),unique(legZs));
  } finally {p.dispose();}
});
test('panel lower rail has no redundant frame when shelf is off, with connected center collar and matching BOM',()=>{
  for(const width of [0.6,0.9,1.2])for(const shelf of ['none','tray','deck'])for(const casters of [false,true]){
    const p=buildRodRack({style:'panel',width,height:1.0,shelf,casters,backPanel:'none'});
    try {
      assert.equal(p.groups.rails.count,3);
      assert.equal(p.stats.partCount,{none:77,tray:86,deck:88}[shelf]);
      assert.equal(p.groups.frameEnds?.count??0,shelf==='none'?0:2);
      assert.equal(p.groups.panelCenterTopCollars.count,3);
      const rail=box(p.groups.rails,0);
      near(rail.getCenter(new THREE.Vector3()).z,0);
      near(rail.max.x,width/2+0.013);
      for(const [mesh,i] of [[p.groups.posts,0],[p.groups.posts,1],[p.groups.panelCenterPost,0]])
        assert.ok(rail.intersectsBox(box(mesh,i)),'main rod crosses every upright');
      for(let level=0;level<3;level++){
        const main=box(p.groups.rails,level);
        for(const [mesh,i] of [[p.groups.posts,0],[p.groups.posts,1],[p.groups.panelCenterPost,0]])
          assert.ok(main.intersectsBox(box(mesh,i)),`main rod ${level} crosses every upright`);
        assert.ok(main.intersectsBox(box(p.groups.panelCenterTopCollars,level)),
          `main rod ${level} has a real center through-collar`);
      }
      assert.equal(p.groups.diags.count+p.groups.panelCenterBraces.count,6);
      assert.equal(p.stats.cutList.find(c=>c.spec==='置物框/档杆').qty,3);
      assert.equal(p.stats.cutList.find(c=>c.spec==='框侧连接轴')?.qty??0,shelf==='none'?0:2);
      assert.equal(p.stats.hardware.find(h=>h.name==='T 型夹块').qty,p.groups.blocks.count);
      if(shelf!=='none'){
        const joists=p.groups.trayJoists??p.groups.rodJoists;
        const board=box(p.groups.tray??p.groups.rodDeck);
        for(let i=0;i<2;i++){
          near(box(joists,i).max.y,board.min.y);
          for(let j=0;j<2;j++)assert.ok(box(joists,i).intersectsBox(box(p.groups.frameEnds,j)));
        }
        const clips=p.groups.trayClips??p.groups.deckClips;
        for(let i=0;i<joists.count;i++)
          for(let j=0;j<clips.count;j++)
            if(Math.abs(box(joists,i).getCenter(new THREE.Vector3()).z-box(clips,j).getCenter(new THREE.Vector3()).z)<0.02)
              assert.ok(box(joists,i).intersectsBox(box(clips,j)),'joist is retained by a real side clip');
      }
      const cutLength=p.stats.cutList.filter(c=>c.section!=='板').reduce((s,c)=>s+c.len*c.qty,0);
      assert.ok(Math.abs(cutLength-p.stats.profileLengthM)<0.01,'cut list length matches generated rod total');
    } finally {p.dispose();}
  }
});
