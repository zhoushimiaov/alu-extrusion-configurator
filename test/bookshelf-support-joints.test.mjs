import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBookshelf } from '../src/core/buildBookshelf.js';

// Verify parametric join geometry directly, without relying on camera perspective.
const eps = 1e-5;
const near = (a, b, msg = '') =>
  assert.ok(Math.abs(a - b) <= eps, `${msg}: expected ${b}, got ${a}`);

function instance(mesh, i) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  mesh.getMatrixAt(i, m);
  m.decompose(p, q, s);
  return { p, q, s };
}

test('光轴书架侧托杆：逐层沿板坡向，法线间隙2mm，真实伸入前后接头', () => {
  for (const cfg of [
    { bays: 1, levels: 4, depth: 0.34 },
    { bays: 2, levels: 5, depth: 0.28, bayW: 0.8 },
    { bays: 1, levels: 2, depth: 0.45, bayW: 1.2 },
  ]) {
    const built = buildBookshelf({ style: 'tower', books: false, ...cfg });
    try {
      const { panels, sideDiagSupports: diagonals, sideStubSupports: stubs } = built.groups;
      assert.equal(diagonals.count, cfg.bays * cfg.levels * 2);
      assert.equal(stubs.count, cfg.levels * (cfg.bays + 1) * 2);
      // 使用构建器归一化后的配置；用例可能省略 bayW，不能以 undefined 计算边界。
      const { bayW } = built.config;
      const width = cfg.bays * bayW;
      const bounds = Array.from({ length: cfg.bays + 1 }, (_, n) => -width / 2 + n * bayW);

      for (let n = 0; n < cfg.bays * cfg.levels; n++) {
        const panel = instance(panels, n);
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(panel.q);
        const slope = new THREE.Vector3(0, 1, 0).applyQuaternion(panel.q);
        const level = Math.floor(n / cfg.bays);
        const bay = n % cfg.bays;
        for (let edge = 0; edge < 2; edge++) {
          const rod = instance(diagonals, n * 2 + edge);
          const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(rod.q);
          near(Math.abs(axis.dot(slope)), 1, 'side support slope parallel to actual tilted shelf');
          near(rod.p.clone().sub(panel.p).dot(normal), -(0.014 / 2 + 0.005 + 0.002), 'rod center below shelf face');
          const postX = bounds[bay + edge];
          near(rod.p.x, postX + (edge === 0 ? 0.022 : -0.022), 'rod positioned beside panel edge');
          const front = rod.p.clone().addScaledVector(axis, -rod.s.y / 2);
          const back = rod.p.clone().addScaledVector(axis, rod.s.y / 2);
          near(front.z, cfg.depth / 2 - 0.004, 'front rod endpoint');
          near(back.z, -cfg.depth / 2 + 0.004, 'rear rod endpoint');
          const stubFront = instance(stubs, level * (cfg.bays + 1) * 2 + (bay + edge) * 2);
          const stubBack = instance(stubs, level * (cfg.bays + 1) * 2 + (bay + edge) * 2 + 1);
          for (const [tip, stub] of [[front, stubFront], [back, stubBack]]) {
            near(stub.p.x, postX, 'stub begins at post');
            near(stub.p.y, tip.y, 'stub and diagonal join Y');
            near(stub.p.z, tip.z, 'stub and diagonal join Z');
            assert.ok(Math.abs(tip.x - stub.p.x) < stub.s.x / 2, 'stub spans diagonal endpoint in X');
          }
        }
      }
      assert.ok(built.stats.cutList.some(c => c.spec.includes('斜层板侧托光轴')));
      assert.ok(built.stats.cutList.some(c => c.spec.includes('节点外伸短光轴')));
    } finally {
      built.dispose();
    }
  }
});

test('长桌不应生成展示塔专用斜撑节点', () => {
  const built = buildBookshelf({ style: 'table' });
  try {
    assert.equal(built.groups.sideDiagSupports, undefined);
    assert.equal(built.groups.sideStubSupports, undefined);
  } finally {
    built.dispose();
  }
});
