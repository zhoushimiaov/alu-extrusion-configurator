import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBookshelf } from '../src/core/buildBookshelf.js';

function worldMeshCenters(mesh) {
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  return Array.from({ length: mesh.count }, (_, i) => {
    mesh.getMatrixAt(i, m);
    m.decompose(pos, q, s);
    return [pos.x, pos.y, pos.z].map(x => x.toFixed(5)).join(',');
  });
}

test('光轴书架顶框后杆仅出现一次，相邻跨与顶档不产生重叠杆件', () => {
  for (const { bays, levels } of [{ bays: 1, levels: 2 }, { bays: 2, levels: 4 }, { bays: 3, levels: 6 }]) {
    const built = buildBookshelf({ style: 'tower', bays, levels });
    try {
      const rails = built.groups.rails;
      const expected = bays * (2 * levels + 1); // 前低后高 × 层数，加顶框前杆
      assert.equal(rails.count, expected);
      const positions = worldMeshCenters(rails);
      assert.equal(new Set(positions).size, rails.count, 'overlapping rods create doubled geometry/z-fighting');
      const cuts = built.stats.cutList.filter(c => c.spec.startsWith('光轴横杆'));
      assert.ok(cuts.some(c => c.qty === expected), 'BOM mirrors real continuous rail count');
    } finally { built.dispose(); }
  }
});
