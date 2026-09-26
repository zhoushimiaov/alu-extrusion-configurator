// envelope 一致性守卫：真实外轮廓（尺寸标注与规格卡的唯一数据源）计算正确、
// 各非原封 builder 都挂了 stats.envelope，且与取景 bounds 的关系符合设计。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// builder 会在 node 环境里创建 canvas 纹理（woodcartMaterials 还会 drawImage 画木纹）：
// 用 Proxy 通配 2D context，任何绘图调用都是 no-op
const gradientStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradientStub;
    if (prop === 'canvas') return { width: 0, height: 0 };
    return () => {};
  },
  set() { return true; },
});
globalThis.document = {
  createElement: (t) => (t === 'canvas'
    ? { width: 0, height: 0, getContext: () => ctx2d }
    : {}),
};

const { computeEnvelope } = await import('../src/core/envelope.js');
const { buildRodRack } = await import('../src/core/buildRodRack.js');
const { buildCartTable } = await import('../src/core/buildCartTable.js');
const { buildCratesRack } = await import('../src/core/buildCratesRack.js');
const { buildWoodCart } = await import('../src/core/buildWoodCart.js');
const { buildHanger } = await import('../src/core/buildHanger.js');

function finiteDims(env) {
  for (const v of [env.W, env.H, env.D]) {
    assert.ok(Number.isFinite(v) && v > 0, `envelope 维度必须为正有限数，得到 ${JSON.stringify(env)}`);
  }
}

test('computeEnvelope 正确展开 InstancedMesh 实例矩阵', () => {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial(),
    2,
  );
  const m = new THREE.Matrix4();
  m.setPosition(1, 0, 0);
  mesh.setMatrixAt(0, m);
  m.setPosition(2.5, 0, 0);
  mesh.setMatrixAt(1, m);
  const env = computeEnvelope(mesh);
  assert.ok(Math.abs(env.W - 1.6) < 1e-6, `实例跨度应为 1.6，得到 ${env.W}`);
});

test('五个非型材架 builder 都返回真实外轮廓 stats.envelope', () => {
  const cases = [
    ['buildRodRack', buildRodRack, {}],
    ['buildCartTable', buildCartTable, {}],
    ['buildCratesRack', buildCratesRack, {}],
    ['buildWoodCart', buildWoodCart, {}],
    ['buildHanger', buildHanger, {}],
  ];
  for (const [name, build, cfg] of cases) {
    const prod = build(cfg);
    try {
      assert.ok(prod.stats?.envelope, `${name} 缺少 stats.envelope`);
      finiteDims(prod.stats.envelope);
      // envelope 是真实外轮廓（无取景留白），不得超过取景包围盒太多
      const b = prod.stats.envelope, bounds = prod.bounds;
      for (const k of ['W', 'H', 'D']) {
        assert.ok(b[k] <= bounds[k] + 0.15, `${name} envelope.${k}(${b[k]}) 明显大于 bounds.${k}(${bounds[k]})，取景留白语义被破坏`);
      }
    } finally {
      prod.dispose();
    }
  }
});

test('光轴展架默认外轮廓与 rodtest 基线一致', () => {
  const prod = buildRodRack({});
  try {
    const env = prod.stats.envelope;
    // rodtest.mjs 基线：bounds = { W: 0.92, H: 1.382, D: 0.42 }（该产品 bounds 即真实轮廓）
    assert.ok(Math.abs(env.W - 0.92) < 0.05, `W=${env.W}`);
    assert.ok(Math.abs(env.H - 1.382) < 0.05, `H=${env.H}`);
    assert.ok(Math.abs(env.D - 0.42) < 0.05, `D=${env.D}`);
  } finally {
    prod.dispose();
  }
});
