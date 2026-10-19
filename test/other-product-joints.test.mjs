// 多产品节点自检：关心真实几何和五金清单一致，不凭视觉猜测改变原设计。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const gradientStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradientStub;
    if (prop === 'canvas') return { width: 512, height: 256 };
    return () => {};
  }, set() { return true; },
});
globalThis.document = { createElement: () => ({ width: 512, height: 256, getContext: () => ctx2d }) };

const { buildWoodCart } = await import('../src/core/buildWoodCart.js');
const { buildCratesRack } = await import('../src/core/buildCratesRack.js');
const { buildCartTable } = await import('../src/core/buildCartTable.js');

const near = (actual, expected, label, tol = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: got ${actual}, expected ${expected}`);
function instanceBox(mesh, i) {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(i, matrix);
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
}
function instanceCenter(mesh, i) {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
}

test('木展车：上下错层挂杆各自有立柱套筒，间距真实且无假十字夹块', () => {
  for (const [topRail, sideRail, expected] of [[true,true,14],[true,false,6],[false,true,8],[false,false,0]]) {
    const p = buildWoodCart({ topRail, sideRail });
    try {
      const collar = p.groups.hangingCollars;
      if (!expected) { assert.equal(collar, undefined); }
      else {
        assert.equal(collar.count, expected);
        assert.equal(collar.geometry.type, 'CylinderGeometry');
        near(collar.geometry.parameters.height, 0.018, 'slender post sleeves');
        const collarHardware = p.stats.hardware.find(h => h.name.includes('独立圆形挂杆立柱套筒'));
        assert.equal(collarHardware?.qty, expected, 'actual collars must match BOM');
      }
      const cardOnly = p.stats.hardware.find(h => h.name.includes('十字光轴夹块'));
      assert.equal(cardOnly.qty, p.groups.railClamps.count, 'square clamps are for card rails only');
      if (topRail && sideRail) {
        const zFront = p.config.depth / 2;
        const xLeft = -p.config.width / 2;
        const jointY = [];
        for (let i=0; i<collar.count; i++) {
          const v = instanceCenter(collar, i);
          if (Math.abs(v.x - xLeft) < 1e-5 && Math.abs(v.z-zFront)<1e-5)
            jointY.push(v.y);
        }
        jointY.sort((a,b)=>b-a);
        assert.equal(jointY.length,4, 'upper X/Z rails and lower presentation X/Z rails independently attach to the same upright');
        near(jointY[0] - jointY[1], 0.04, 'top rail to side rail uses distinct 40mm elevations');
        near(jointY[2] - jointY[3], 0.04, 'middle hanging rail pair also remains distinct');
        assert.ok(jointY[0] - jointY[1] - collar.geometry.parameters.height >= 0.02,
          'adjacent 18mm sleeves leave at least 20mm visible gap');
      }
    } finally { p.dispose(); }
  }
});

test('周转箱：实际2040立柱 Z厚20mm，箱口含外翻边仍有进深净空', () => {
  for (const depth of [0.32, 0.42, 0.62]) {
    const p = buildCratesRack({ depth, pullOut: false });
    try {
      const columnInnerFaceZ = depth / 2 - 0.02 / 2;
      const rimAndTolerance = 0.012 + 0.006 + 0.005;
      near(p.crate.width / 2 + rimAndTolerance, columnInnerFaceZ, 'crate rim respects Z inner face with draft/gap');
      assert.ok(p.crate.width > depth - 0.09, 'no redundant clearance from X-oriented 40mm upright width');
      assert.ok(p.stats.envelope.W > 0 && p.stats.envelope.D > 0);
    } finally { p.dispose(); }
  }
});

test('移动边几：四只2mm实体减震垫分别接触型材顶和玻璃底且清单一致', () => {
  for (const [width, depth, glassTop] of [[0.5,0.4,true],[0.8,0.65,true],[0.5,0.4,false]]) {
    const p=buildCartTable({width,depth,glassTop});
    try {
      if (!glassTop) {assert.equal(p.groups.glassPads, undefined); continue;}
      const pads=p.groups.glassPads;
      assert.equal(pads.count,4);
      near(pads.geometry.parameters.height,0.002,'isolation pad physical thickness');
      const glass=p.groups.glass.children[0], post=p.groups.aluPosts;
      const glassBottom=instanceBox(glass,0).min.y;
      const frameTop=instanceBox(post,0).max.y;
      near(glassBottom-frameTop,0.002,'2mm gap exists in geometric model');
      for(let i=0;i<4;i++){
        const b=instanceBox(pads,i);
        near(b.min.y,frameTop,'pad bottom seated on structural frame');
        near(b.max.y,glassBottom,'pad top touches underside of glass');
        const center=instanceCenter(pads,i);
        near(Math.abs(center.x),width/2,'pad centered over corner post X');
        near(Math.abs(center.z),depth/2,'pad centered over corner post Z');
      }
      assert.equal(p.stats.hardware.find(h=>h.name==='玻璃减震垫片').qty,4);
    } finally {p.dispose();}
  }
});
