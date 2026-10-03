// 非型材架产品回归：默认配置重建 → 与 baselines.mjs 一致；挂衣架原木款外轮廓对齐 GLB；
// 共用脚轮组件触地/高度正确；周转箱抽屉滑轨约束。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import baselines from './baselines.mjs';

const gradientStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradientStub;
    if (prop === 'canvas') return { width: 0, height: 0 };
    return () => {};
  },
  set() { return true; },
});
globalThis.document = { createElement: (t) => (t === 'canvas' ? { width: 0, height: 0, getContext: () => ctx2d } : {}) };

const { buildRodRack } = await import('../src/core/buildRodRack.js');
const { buildCartTable } = await import('../src/core/buildCartTable.js');
const { buildCratesRack } = await import('../src/core/buildCratesRack.js');
const { buildWoodCart } = await import('../src/core/buildWoodCart.js');
const { buildHanger } = await import('../src/core/buildHanger.js');
const { buildCasters, buildLevelFeet, outwardYaw } = await import('../src/core/casters.js');

function check(name, prod, b) {
  try {
    assert.ok(Math.abs(prod.stats.weightKg - b.weightKg) < 0.05 + 1e-9, `${name} 自重 ${prod.stats.weightKg.toFixed(2)} ≠ 基线 ${b.weightKg}`);
    assert.equal(prod.stats.partCount, b.partCount, `${name} 件数`);
    if (b.profileLengthM != null) assert.ok(Math.abs(prod.stats.profileLengthM - b.profileLengthM) < 0.005 + 1e-9, `${name} 总长 ${prod.stats.profileLengthM}`);
  } finally {
    prod.dispose();
  }
}

test('默认配置与基线一致（rod / cart / crates / woodcart / hanger 两款）', () => {
  check('rod', buildRodRack({}), baselines.rod);
  check('cart', buildCartTable({}), baselines.cart);
  check('crates', buildCratesRack({}), baselines.crates);
  check('woodcart', buildWoodCart({}), baselines.woodcart);
  check('hanger', buildHanger({}), baselines.hanger);
  check('hangerAtelier', buildHanger({ style: 'atelier', wheels: false }), baselines.hangerAtelier);
});

test('挂衣架原木款外轮廓对齐 ref/挂衣架.glb（1.402 × 2.480 × 0.504 m）', () => {
  const p = buildHanger({ style: 'atelier', width: 1.40, depth: 0.50, height: 2.40, drawers: 2, wheels: false });
  try {
    const e = p.stats.envelope;
    assert.ok(Math.abs(e.W - 1.402) < 0.01, `W=${e.W}`);
    assert.ok(Math.abs(e.H - 2.480) < 0.01, `H=${e.H}`);
    assert.ok(Math.abs(e.D - 0.504) < 0.01, `D=${e.D}`);
    // 四个储物模块数都能构建，且模块数单调影响件数
    const parts = [0, 1, 2, 3].map((d) => { const q = buildHanger({ style: 'atelier', drawers: d }); const n = q.stats.partCount; q.dispose(); return n; });
    assert.ok(parts[0] < parts[1] && parts[1] < parts[2] && parts[2] < parts[3], `模块件数 ${parts}`);
  } finally {
    p.dispose();
  }
});

test('未知样式回退为光轴抽屉柜（分享链接注入非法值不崩）', () => {
  const a = buildHanger({ style: 'nope' });
  const b = buildHanger({});
  try {
    assert.equal(a.stats.partCount, b.stats.partCount);
  } finally { a.dispose(); b.dispose(); }
});

test('共用脚轮：轮底触地、安装面高度 = H、每材质一个 InstancedMesh 且实例数 = 支撑点数', () => {
  const pts = [{ x: 0, z: 0, yaw: 0 }, { x: 1, z: 0, yaw: Math.PI }, { x: 0, z: 1, yaw: 1 }];
  for (const opts of [
    { H: 0.078, wheelD: 0.05, wheelW: 0.009, twin: true, twinGap: 0.005, trail: 0.023, mount: 'stem' },
    { H: 0.068, wheelD: 0.045, wheelW: 0.018, trail: 0.016, mount: 'plate', brake: true },
    { H: 0.085, wheelD: 0.05, wheelW: 0.02, trail: 0.018, mount: 'plate', brake: true, hood: true, palette: 'white' },
  ]) {
    const g = buildCasters(pts, opts);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3();
    let meshes = 0;
    g.traverse((o) => {
      if (!o.isInstancedMesh) return;
      meshes++;
      assert.equal(o.count, pts.length);
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox);
    });
    assert.ok(meshes >= 3, '至少 胎/毂/叉 三种材质');
    assert.ok(Math.abs(box.min.y) < 1e-4, `轮底应触地 y=0，得到 ${box.min.y}`);
    if (opts.mount === 'plate') assert.ok(Math.abs(box.max.y - opts.H) < 1e-4, `平板顶面应在 H=${opts.H}，得到 ${box.max.y}`);
    else assert.ok(box.max.y > opts.H, '螺杆应插入安装面以上（夹块内）');
  }
  const f = buildLevelFeet(pts, { H: 0.05 });
  const fb = new THREE.Box3().setFromObject(f);
  assert.ok(Math.abs(fb.min.y) < 1e-4 && fb.max.y <= 0.0505, `地脚 0~H，得到 ${fb.min.y}~${fb.max.y}`);
  // 拖尾朝外：轮心 (-t,0,0) 经 yaw 旋转后与外向同向
  for (const [x, z] of [[-1, 0], [1, 0], [0.5, 0.5], [-0.3, 0.7]]) {
    const a = outwardYaw(x, z, 'diag');
    const wx = -Math.cos(a), wz = Math.sin(a);
    assert.ok(wx * x + wz * z > 0, `yaw(${x},${z}) 未朝外`);
  }
});

test('周转箱：箱体在两侧滑轨之间；推入状态箱体不越出立柱内表面；抽出不改变架体规格尺寸', () => {
  const pushIn = buildCratesRack({ pullOut: false });
  const pullOut = buildCratesRack({ pullOut: true });
  try {
    const { config } = pushIn;
    const innerX = config.width / 2 - 0.02;
    assert.ok(pushIn.crate.len / 2 + 0.012 < innerX - 0.02, '箱长 + 唇边应在侧梁内侧（滑轨面以内）');
    assert.ok(pushIn.crate.width / 2 + 0.012 <= config.depth / 2 - 0.02 + 1e-6, '推入时箱宽 + 唇边在立柱内表面以内');
    assert.ok(pullOut.crate.pulls.some((p) => p > 0.1), '抽拉展示应有明显抽出（参考图）');
    assert.deepEqual(pushIn.stats.envelope, pullOut.stats.envelope, '规格外轮廓不随抽出变化');
    assert.ok(pullOut.bounds.D > pushIn.bounds.D, '取景包围盒应包含抽出量');
  } finally {
    pushIn.dispose(); pullOut.dispose();
  }
});
