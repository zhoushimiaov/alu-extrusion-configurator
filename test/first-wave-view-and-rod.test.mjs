import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { createSupportMarkers } from '../src/core/supportMarkers.js';
import { applyXrayTo } from '../src/core/xray.js';

const near = (a,b,label,eps=1e-5) =>
  assert.ok(Math.abs(a-b)<eps, `${label}: ${a} vs ${b}`);

test('亚克力展示屏：8mm实体半透板，四周边框可见，正面丝印无遮挡', () => {
  const model=buildRodRack({style:'acrylic',shelf:'none',backPanel:'none'});
  try {
    const {acr,acrEdges,printStrips}=model.groups;
    assert.equal(acr.count,1);
    assert.equal(acrEdges.count,4);
    assert.ok(acr.material.opacity>=0.7 && acr.material.transmission<0.5);
    assert.ok(acr.material.roughness>=0.3);
    near(acr.geometry.parameters.depth,0.008,'real 8mm thickness');
    const m=new THREE.Matrix4(), pos=new THREE.Vector3();
    acr.getMatrixAt(0,m);pos.setFromMatrixPosition(m);
    const panelFront=pos.z+0.004;
    for(let i=0;i<printStrips.count;i++){
      printStrips.getMatrixAt(i,m);pos.setFromMatrixPosition(m);
      assert.ok(pos.z>=panelFront+0.001,'printed strip must sit in front of panel, not behind');
    }
    assert.ok(model.stats.panes.some(p=>p.kind==='acrylic'));
  } finally { model.dispose(); }
});

test('窄托板：两根承托杆精确接触板底并横跨立柱，四处端夹计入BOM',()=>{
  for(const width of [0.5,0.8,1.0]){
    const b=buildRodRack({width,shelf:'tray'});
    try{
      const {tray,trayJoists,trayClips}=b.groups;
      assert.equal(tray.count,1);
      assert.equal(trayJoists.count,2);
      assert.equal(trayClips.count,4);
      const m=new THREE.Matrix4(), pos=new THREE.Vector3();
      tray.getMatrixAt(0,m);pos.setFromMatrixPosition(m);
      const boardBottom=pos.y-0.001;
      for(let i=0;i<2;i++){
        trayJoists.getMatrixAt(i,m);
        const p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
        m.decompose(p,q,sc);
        near(p.y+sc.y,boardBottom,'top of Ø12 joist touches tray bottom');
        near(Math.abs(p.z),0.055,'both supports lie inside narrow tray');
        near(sc.x,width+0.08,'joist spans full post-to-post width');
      }
      assert.ok(b.stats.cutList.some(c=>c.spec.includes('窄托板承托光轴')&&c.qty===2));
      assert.ok(b.stats.hardware.some(c=>c.name.includes('窄托板承托端夹')&&c.qty===4));
    }finally{b.dispose();}
  }
  const none=buildRodRack({shelf:'none'});
  try{assert.equal(none.groups.trayJoists,undefined);}finally{none.dispose();}
});

test('XRay 强化结构可读性，透明板取消透射、退出时无损恢复',()=>{
  const group=new THREE.Group();
  const metal=new THREE.MeshStandardMaterial({color:0x888888,metalness:0.75});
  const acrylic=new THREE.MeshPhysicalMaterial({color:0xeeeeee,transmission:1});
  const rail=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),metal);
  const pane=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),acrylic);
  group.add(rail,pane);
  applyXrayTo(group,true);
  assert.ok(rail.material.opacity>=0.4 && rail.material.opacity<=0.65);
  assert.ok(pane.material.opacity>=0.7);
  assert.equal(pane.material.transmission,0);
  assert.equal(rail.material.depthWrite,false);
  applyXrayTo(group,true);
  applyXrayTo(group,false);
  assert.strictEqual(rail.material,metal);
  assert.strictEqual(pane.material,acrylic);
  applyXrayTo(group,false);
  assert.equal(rail.userData.__origMat,undefined);
  group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  metal.dispose();acrylic.dispose();
});

test('标记四个脚轮接地点可见：不被深度遮挡，切配置时重新映射和清空',()=>{
  const p=createSupportMarkers();
  try{
    p.setPoints([[0,0,0],[1,0,0],[1,0,1],[0,0,1]]);
    p.setVisible(true);
    assert.equal(p.pointCount,4);
    assert.equal(p.group.children.length,2);
    assert.ok(p.group.children.every(o=>o.material.depthTest===false));
    p.setPoints([[0,0,0]]);
    assert.equal(p.pointCount,1);
    p.setPoints([[NaN,0,1]]);
    assert.equal(p.pointCount,0);
    p.setVisible(false);
    assert.equal(p.group.visible,false);
  } finally {p.dispose();}
});
