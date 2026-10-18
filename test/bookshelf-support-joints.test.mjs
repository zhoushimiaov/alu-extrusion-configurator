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
      assert.equal(built.groups.sideDiagCouplers.count, diagonals.count * 2);
      assert.equal(built.groups.clamps.geometry.type, 'CylinderGeometry');
      assert.ok(built.groups.clamps.material.metalness > 0.8, 'avoid bulky black square joints');
      // 每个横杆节点只允许一个套筒（跨与顶层共享的节点不可重叠）。
      const collarPositions = new Set();
      for (let c = 0; c < built.groups.clamps.count; c++) {
        const p = instance(built.groups.clamps, c).p;
        const key = [p.x, p.y, p.z].map(v => v.toFixed(4)).join(':');
        assert.ok(!collarPositions.has(key), 'duplicate post collar');
        collarPositions.add(key);
      }
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
          near(rod.p.x, postX + (edge === 0 ? -0.03 : 0.03), 'diagonal brace mounted OUTSIDE each bay');
          assert.ok((edge === 0 ? rod.p.x < postX : rod.p.x > postX), 'side brace must be outside the bay boundary');
          const front = rod.p.clone().addScaledVector(axis, -rod.s.y / 2);
          const back = rod.p.clone().addScaledVector(axis, rod.s.y / 2);
          near(front.z, cfg.depth / 2 - 0.004, 'front rod endpoint');
          near(back.z, -cfg.depth / 2 + 0.004, 'rear rod endpoint');
          const boundary = bay + edge;
          const stubFront = instance(stubs, level * (cfg.bays + 1) * 2 + boundary * 2);
          const stubBack = instance(stubs, level * (cfg.bays + 1) * 2 + boundary * 2 + 1);
          const isLeft = boundary === 0;
          const isRight = boundary === cfg.bays;
          const isShared = !isLeft && !isRight;
          const expectedCenter = postX + (isLeft ? -0.04 : isRight ? 0.04 : 0);
          const expectedLength = isShared ? 0.20 : 0.12;
          for (const [tip, stub] of [[front, stubFront], [back, stubBack]]) {
            near(stub.p.x, expectedCenter, 'off-center perimeter stub / centered shared stub');
            near(stub.s.x, expectedLength, 'stub cut length matches actual span');
            near(stub.p.y, tip.y, 'stub and diagonal join Y');
            near(stub.p.z, tip.z, 'stub and diagonal join Z');
            assert.ok(Math.abs(tip.x - stub.p.x) + 0.005 < stub.s.x / 2, 'diagonal end joins within stub, not past end cap');
            // Perimeter stub must visibly project 100 mm OUTWARD, retaining 20 mm inside the post.
            if (!isShared) {
              const innerExtent = isLeft ? stub.p.x + stub.s.x / 2 : stub.p.x - stub.s.x / 2;
              const outerExtent = isLeft ? stub.p.x - stub.s.x / 2 : stub.p.x + stub.s.x / 2;
              near(Math.abs(innerExtent - postX), 0.02, '20 mm inboard overlap');
              near(Math.abs(outerExtent - postX), 0.10, '100 mm exterior tip projection');
            } else {
              near(stub.p.x - stub.s.x / 2, postX - 0.10, 'shared post projects 100mm left');
              near(stub.p.x + stub.s.x / 2, postX + 0.10, 'shared post projects 100mm right');
            }
          }
        }
      }
      assert.ok(built.stats.cutList.some(c => c.spec.includes('斜层板侧托光轴')));
      const stubCuts = built.stats.cutList.filter(c => c.spec.includes('节点外挑') || c.spec.includes('节点双向外挑'));
      assert.equal(stubCuts.reduce((sum, c) => sum + c.qty, 0), stubs.count, 'BOM includes each support stub once');
      const stubTotalLength = stubCuts.reduce((sum, c) => sum + c.len * c.qty, 0);
      near(stubTotalLength,
        cfg.levels * (0.12 * 4 + (cfg.bays - 1) * 0.20 * 2),
        'BOM counts both perimeter and shared-post cut lengths');
      assert.ok(built.stats.hardware.some(c => c.name.includes('斜撑杆端金属转接套')));
      const sideCollars = built.groups.sidePostCollars;
      if (sideCollars) {
        for (let c = 0; c < sideCollars.count; c++) {
          const p = instance(sideCollars, c).p;
          assert.ok(![...collarPositions].some(key => {
            const [x, y, z] = key.split(':').map(Number);
            return Math.abs(x - p.x) < 0.001 && Math.abs(y - p.y) < 0.018 && Math.abs(z - p.z) < 0.012;
          }), 'side collar must not overlap an existing rail collar');
        }
      }
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
