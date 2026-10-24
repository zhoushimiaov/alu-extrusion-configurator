import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { measureAssembly } from '../src/core/assemblyEnvelope.js';
import { createReviewedDimensions } from '../src/core/reviewedDimensions.js';

test('final assembly envelope expands instances, skips hidden ancestors and preview LOD', () => {
  const root = new THREE.Group();
  const geo = new THREE.BoxGeometry(2, 4, 6);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 2);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-2, -1, 3));
  mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(4, 2, -1));
  root.add(mesh);
  const hidden = new THREE.Group(); hidden.visible = false;
  const phantom = new THREE.Mesh(geo); phantom.position.set(100, 100, 100);
  hidden.add(phantom); root.add(hidden);
  const lod = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
  lod.name = 'stripsLOD'; root.add(lod);
  const strips = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  strips.name = 'strips'; strips.visible = false; strips.position.x = 7;
  root.add(strips);
  const result = measureAssembly(root);
  assert.deepEqual(result.envelope, { W: 10.5, H: 7, D: 10 });
  assert.deepEqual(result.min, [-3, -3, -4]);
  assert.deepEqual(result.max, [7.5, 4, 6]);
  assert.deepEqual(result.center, [2.25, .5, 1]);
  geo.dispose(); strips.geometry.dispose(); lod.geometry.dispose();
});

function element(tag) {
  return { tag, attrs: {}, style: {}, children: [],
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); },
    insertBefore(c, ref) { this.children.splice(this.children.indexOf(ref), 0, c); },
  };
}
const renderer = { domElement: { getBoundingClientRect: () => ({width: 1000, height: 800}) } };
function project(point, camera) {
  const p = new THREE.Vector3(...point).project(camera);
  return [(p.x * .5 + .5) * 1000, (-p.y * .5 + .5) * 800];
}
function close(actual, expected) { assert.ok(Math.abs(Number(actual)-expected) < 1e-6, `${actual} != ${expected}`); }

test('dimension anchors follow asymmetric assembly and real bottom with either projection', () => {
  const previous = globalThis.document;
  globalThis.document = { createElementNS: (_ns, tag) => element(tag) };
  try {
    const svg = element('svg');
    const camera = new THREE.PerspectiveCamera(45, 1.25, .01, 100);
    const ortho = new THREE.OrthographicCamera(-5, 5, 4, -4, .01, 100);
    let dims;
    for (const cam of [camera, ortho]) {
      cam.position.set(6, 5, 8); cam.lookAt(1, 1, 1); cam.updateMatrixWorld(true);
      const original = cam.matrixWorld.toArray();
      if (!dims) dims = createReviewedDimensions(svg, cam, renderer);
      else dims.setCamera(cam);
      dims.update({W: 4, H: 3, D: 2, minY: -.4}, new THREE.Vector3(1.5, 0, -.75));
      const lines = svg.children.filter(c => c.tag === 'line');
      const expected = [
        [[-.5, -.4, .31], [3.5, -.4, .31]],
        [[-.6, -.4, .25], [-.6, 2.6, .25]],
        [[3.6, -.38, .25], [3.6, -.38, -1.75]],
      ];
      for (let i=0; i<3; i++) {
        const a = project(expected[i][0], cam), b = project(expected[i][1], cam);
        close(lines[i].attrs.x1, a[0]); close(lines[i].attrs.y1, a[1]);
        close(lines[i].attrs.x2, b[0]); close(lines[i].attrs.y2, b[1]);
      }
      assert.deepEqual(cam.matrixWorld.toArray(), original, 'real view camera must remain unchanged');
    }
  } finally { globalThis.document = previous; }
});
