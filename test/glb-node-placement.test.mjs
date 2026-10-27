import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { glbLayout, buildGlbFrame } from '../src/core/buildGlbFrame.js';

test('GLB layout has no invented mid-bay connector grid', () => {
  const a = glbLayout({ bayWidths: [.57, .57], levels: 3 });
  assert.equal(a.rows.connectors.length, a.rows.depth.length);
  assert.deepEqual(a.rows.connectors, a.rows.depth.map(([x, y]) => [x, y, -.17]));
  assert.equal(a.rows.bolts, undefined);
});

test('exact joint entities match depth-member/post intersections one-for-one', () => {
  const a = glbLayout({ bayWidths: [.57, .57], levels: 3 });
  assert.deepEqual([...new Set(a.rows.depth.map(r => r[0]))], [-.57, 0, .57]);
  const b = buildGlbFrame({ bayWidths: [.57, .57], levels: 3 });
  assert.ok(b.groups.connectors);
  assert.equal(b.groups.connectors.count, a.rows.depth.length);
  assert.equal(b.groups.connectors.userData.jointCount, a.rows.depth.length);
  assert.equal(
    b.stats.hardware.find(h => h.name.includes('精确节点连接件')).qty,
    b.groups.connectors.count,
  );
  assert.equal(b.groups.bolts, undefined);
  assert.ok(b.groups.depth);
  const connectorMaterials = Array.isArray(b.groups.connectors.material)
    ? b.groups.connectors.material
    : [b.groups.connectors.material];
  assert.ok(b.groups.connectors.geometry.groups.length > 0);
  assert.ok(
    b.groups.connectors.geometry.groups.every(
      group => group.materialIndex < connectorMaterials.length,
    ),
    'every connector geometry group must resolve to an exported material',
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < b.groups.connectors.count; i++) {
    b.groups.connectors.getMatrixAt(i, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    const expected = a.rows.connectors[i];
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(Math.abs(position.getComponent(axis) - expected[axis]) < 1e-6);
    }
  }
  b.dispose();
});

test('depth member keeps GLB extent while exposing the original section on the open side', () => {
  const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 3 });
  assert.ok(built.layout.ends, 'layout must expose depth end metadata');
  assert.equal(built.layout.ends.backSideZ, -.20);
  assert.equal(built.layout.ends.openSideZ, .20);
  assert.equal(built.layout.ends.exposedSectionZ, .20);

  const matrix = new THREE.Matrix4();
  built.groups.depth.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.z - .20) < 1e-6);

  built.groups.depth.geometry.computeBoundingBox();
  const box = built.groups.depth.geometry.boundingBox.clone().applyMatrix4(matrix);
  assert.ok(Math.abs(box.min.z - -.17) < 1e-6);
  assert.ok(Math.abs(box.max.z - .20) < 1e-6);
  built.dispose();
});
