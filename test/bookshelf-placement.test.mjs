import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBookshelf } from '../src/core/buildBookshelf.js';

// Geometry-only test: materials may request a canvas texture, without requiring a browser.
globalThis.document = {
  createElement: () => ({
    width: 256, height: 256,
    getContext: () => new Proxy({}, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => (o[k] = v, true) }),
  }),
};

const near = (actual, expected, eps = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < eps, `${actual} should be near ${expected}`);

test('光轴书架：所有样书与各自斜层板共面平行、表面不穿模、边缘不过界', () => {
  for (const cfg of [
    { bays: 1, levels: 4, depth: 0.34 },
    { bays: 2, levels: 5, depth: 0.28, bayW: 0.8 },
    { bays: 1, levels: 2, depth: 0.45, bayW: 1.2 },
  ]) {
    const shelf = buildBookshelf({ style: 'tower', books: true, ...cfg });
    try {
      const { panels, books } = shelf.groups;
      assert.equal(books.children.length, cfg.bays * cfg.levels);
      assert.equal(panels.count, books.children.length);
      panels.updateMatrixWorld(true);

      for (let i = 0; i < panels.count; i++) {
        const matrix = new THREE.Matrix4();
        const panelPosition = new THREE.Vector3();
        const panelRotation = new THREE.Quaternion();
        const panelScale = new THREE.Vector3();
        panels.getMatrixAt(i, matrix);
        matrix.decompose(panelPosition, panelRotation, panelScale);

        const book = books.children[i];
        const panelNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(panelRotation);
        const bookNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(book.quaternion);
        const panelSlope = new THREE.Vector3(0, 1, 0).applyQuaternion(panelRotation);
        const delta = book.position.clone().sub(panelPosition);

        // Both top surfaces must point along the same normal.
        near(panelNormal.dot(bookNormal), 1);
        near(panelNormal.length(), 1);
        // Panel 14mm + book 18mm, separated by a 2mm surface gap.
        near(delta.dot(panelNormal), 0.014 / 2 + 0.018 / 2 + 0.002);
        // Book center is 28% uphill from the lower/front edge, leaving 3% front margin.
        near(delta.dot(panelSlope), -0.22 * panelScale.y);
        near(delta.x, 0);
        near(book.scale.z, 0.018);
        assert.ok(book.scale.x < panelScale.x);
        assert.ok(Math.abs(delta.dot(panelSlope)) + book.scale.y / 2 < panelScale.y / 2);
      }
    } finally {
      shelf.dispose();
    }
  }
});

test('光轴书架：关闭样书或切换长桌不会产生隐藏的样书几何', () => {
  for (const cfg of [{ style: 'tower', books: false }, { style: 'table', books: true }]) {
    const built = buildBookshelf(cfg);
    try {
      assert.equal(built.groups.books, undefined);
    } finally {
      built.dispose();
    }
  }
});
