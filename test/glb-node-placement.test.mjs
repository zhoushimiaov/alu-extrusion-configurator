import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { glbLayout, buildGlbFrame } from '../src/core/buildGlbFrame.js';

test('GLB layout has no invented floating mid-bay connector grid', () => {
  const a = glbLayout({ bayWidths: [.57, .57], levels: 3 });
  assert.equal(a.rows.connectors, undefined);
  assert.equal(a.rows.bolts, undefined);
});

test('exact joint section is installed on depth members at post lines', () => {
  const a = glbLayout({ bayWidths: [.57, .57], levels: 3 });
  assert.deepEqual([...new Set(a.rows.depth.map(r => r[0]))], [-.57, 0, .57]);
  const b = buildGlbFrame({ bayWidths: [.57, .57], levels: 3 });
  assert.equal(b.groups.connectors, undefined);
  assert.equal(b.groups.bolts, undefined);
  assert.ok(b.groups.depth);
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
