import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { buildGlbFrame } from '../src/core/buildGlbFrame.js';
import { LIMITS } from '../src/config/product.js';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildShelf } from '../src/core/buildShelf.js';
import { measureAssembly } from '../src/core/assemblyEnvelope.js';
import {
  captureAssemblyPose,
  disposeFlattenedMeshes,
  flattenToPlainMeshes,
} from '../src/ui/modelExport.js';
import { applyXrayTo } from '../src/core/xray.js';

class NodeFileReader {
  constructor() {
    this.result = null;
    this.onloadend = null;
    this.onerror = null;
  }
  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

test('manufacturing export excludes display props while retaining structure and connector entities', () => {
  const built = buildGlbFrame({
    bayWidths: [.57, .57],
    levels: 3,
    decks: ['rib', 'rib', 'rib'],
    props: true,
    sidePanels: false,
  });
  const exported = flattenToPlainMeshes(built.group, 'Manufacturing');
  try {
    assert.ok(built.groups.props);
    assert.equal(built.groups.props.userData.displayOnly, true);
    assert.equal(exported.children.some(mesh => mesh.name.startsWith('props')), false);
    assert.equal(exported.children.some(mesh => mesh.name.startsWith('displayBooks')), false);
    assert.equal(
      exported.children.filter(mesh => mesh.name.startsWith('connectors_')).length,
      built.groups.connectors.count,
    );
    assert.equal(
      exported.children.filter(mesh => mesh.name.startsWith('connectors_')).length,
      built.stats.hardware.find(h => h.name.includes('精确节点连接件')).qty,
    );
  } finally {
    disposeFlattenedMeshes(exported);
    built.dispose();
  }
});

test('manufacturing export passes through GLTFExporter with connector geometry', async () => {
  const previousFileReader = globalThis.FileReader;
  globalThis.FileReader = NodeFileReader;
  const built = buildGlbFrame({
    bayWidths: [.57, .57],
    levels: 3,
    decks: ['rib', 'rib', 'rib'],
    props: true,
    sidePanels: false,
  });
  const exported = flattenToPlainMeshes(built.group, 'ExporterSmoke', { cloneResources: true });
  try {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const glb = await new GLTFExporter().parseAsync(exported, {
      binary: true,
      onlyVisible: true,
    });
    assert.ok(glb instanceof ArrayBuffer);
    assert.ok(glb.byteLength > 10000);
  } finally {
    disposeFlattenedMeshes(exported);
    built.dispose();
    globalThis.FileReader = previousFileReader;
  }
});

test('manufacturing export excludes standard-shelf and rod-book display props', () => {
  const previousDocument = globalThis.document;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get(_target, property) {
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient;
      }
      return () => {};
    },
    set() { return true; },
  });
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') return {};
      return { width: 0, height: 0, getContext: () => context };
    },
  };
  let shelf;
  let books;
  let shelfExport;
  let booksExport;
  try {
    shelf = buildShelf({
      bays: 2,
      levels: 3,
      bayWidths: [.57, .57],
      decks: ['rib', 'acrylic', 'rib'],
      props: true,
      sidePanels: false,
    }, true);
    shelfExport = flattenToPlainMeshes(shelf.group, 'Shelf');
    books = buildBookshelf({ style: 'tower', bays: 1, levels: 2, books: true });
    booksExport = flattenToPlainMeshes(books.group, 'Books');
    assert.ok(shelf.groups.props);
    assert.equal(shelfExport.children.some(mesh => mesh.name.startsWith('props')), false);
    assert.ok(books.groups.books);
    assert.equal(books.groups.books.userData.displayOnly, true);
    assert.equal(booksExport.children.some(mesh => mesh.name.startsWith('displayBooks')), false);
    assert.ok(booksExport.children.length > books.groups.books.children.length);
  } finally {
    if (shelfExport) disposeFlattenedMeshes(shelfExport);
    if (booksExport) disposeFlattenedMeshes(booksExport);
    shelf?.dispose();
    books?.dispose();
    globalThis.document = previousDocument;
  }
});

test('levels can go down to the new minimum of 2 and still build finite geometry', () => {
  assert.equal(LIMITS.levels[0], 2);
  for (const levels of [2, 3]) {
    const built = buildGlbFrame({ bayWidths: [.57, .57], levels, props: true, sidePanels: true });
    assert.ok(built.layout.H > 0);
    for (const mesh of Object.values(built.groups)) {
      const arr = mesh.isInstancedMesh
        ? [...mesh.geometry.attributes.position.array, ...mesh.instanceMatrix.array]
        : [];
      assert.ok(arr.every(Number.isFinite));
    }
    // 背板分跨嵌入：每层每跨一块（bayWidths 2 跨）
    assert.equal(built.groups.panels.count, 1);
    built.dispose();
  }
});

test('model export button is wired into both product panels and main actions', async () => {
  const panelSrc = readFileSync(new URL('../src/ui/panel.js', import.meta.url), 'utf8');
  assert.match(panelSrc, /data-model/);
  assert.match(panelSrc, /onExportModel/);
  const rodSrc = readFileSync(new URL('../src/ui/rodPanel.js', import.meta.url), 'utf8');
  assert.match(rodSrc, /data-model/);
  assert.match(rodSrc, /onExportModel/);
  const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(mainSrc, /downloadModel/);
  assert.match(mainSrc, /onExportModel: async/);
  // exporter 存在于依赖里且支持 InstancedMesh
  const exporterSrc = readFileSync(new URL('../node_modules/three/examples/jsm/exporters/GLTFExporter.js', import.meta.url), 'utf8');
  assert.match(exporterSrc, /EXT_mesh_gpu_instancing/);
});

test('modelExport module exposes downloadModel and expands instanced meshes for portable export', async () => {
  const src = readFileSync(new URL('../src/ui/modelExport.js', import.meta.url), 'utf8');
  assert.match(src, /export async function downloadModel/);
  assert.match(src, /binary: true/);
  // 导出必须把 InstancedMesh 逐实例展平（避免 EXT_mesh_gpu_instancing 在通用查看器里丢零件）
  assert.match(src, /isInstancedMesh/);
  assert.match(src, /getMatrixAt/);
  assert.match(src, /applyMatrix4/);
});

test('mid-explosion export restores the assembly pose without moving the visible model', async () => {
  let time = 0;
  const originalPerformance = globalThis.performance;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => time }, configurable: true });
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const { createAnims } = await import('../src/core/anims.js?modelExportPose=1');
  const product = buildRodRack({ style: 'panel', width: 0.9, height: 1, shelf: 'tray' });
  try {
    const pose = captureAssemblyPose(product.group);
    const assembled = measureAssembly(product.group).envelope;
    const anims = createAnims(new THREE.PerspectiveCamera(), {
      target: new THREE.Vector3(),
      addEventListener() {},
    });
    anims.explode(product.groups, true);
    time += 700;
    anims.update();
    const exploded = measureAssembly(product.group).envelope;
    assert.ok(Math.abs(exploded.D - assembled.D) > 0.1);

    const before = new Map();
    product.group.traverse((object) => before.set(object, object.matrixWorld.clone()));
    const exported = flattenToPlainMeshes(product.group, 'Frozen', {
      assemblyPose: pose,
      cloneResources: true,
    });
    assert.deepEqual(measureAssembly(exported).envelope, assembled);
    product.group.updateMatrixWorld(true);
    for (const [object, matrix] of before) {
      for (let i = 0; i < 16; i++) {
        assert.ok(Math.abs(object.matrixWorld.elements[i] - matrix.elements[i]) < 1e-8);
      }
    }
  } finally {
    product.dispose();
    Object.defineProperty(globalThis, 'performance', { value: originalPerformance, configurable: true });
    globalThis.window = originalWindow;
  }
});

test('export during connector fade freezes assembly material and restores the visible fade', async () => {
  let time = 0;
  const originalPerformance = globalThis.performance;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => time }, configurable: true });
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = {
    createElement: () => ({
      width: 256,
      height: 256,
      getContext: () => new Proxy({}, {
        get: (target, key) => target[key] ?? (() => {}),
        set: (target, key, value) => (target[key] = value, true),
      }),
    }),
  };
  const { createAnims } = await import('../src/core/anims.js?connectorMaterialExport=1');
  const product = buildShelf({
    bays: 2, levels: 3, bayWidths: [0.57, 0.57],
    decks: ['rib', 'acrylic', 'none'], props: false, sidePanels: false,
  }, false);
  let exported = null;
  try {
    const connector = product.groups.conn;
    assert.ok(connector, 'profile shelf must expose connector geometry');
    const sourceMaterials = Array.isArray(connector.material) ? connector.material : [connector.material];
    const assembledStates = sourceMaterials.map((material) => ({
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    }));
    const pose = captureAssemblyPose(product.group);
    const anims = createAnims(new THREE.PerspectiveCamera(), {
      target: new THREE.Vector3(),
      addEventListener() {},
    });
    anims.explode(product.groups, true);
    time += 200;
    anims.update();
    assert.ok(sourceMaterials.some((material) => material.opacity < 1));

    exported = flattenToPlainMeshes(product.group, 'FrozenConnector', {
      assemblyPose: pose,
      cloneResources: true,
    });
    const exportedConnectorMaterials = new Set();
    exported.traverse((object) => {
      if (!object.isMesh || !object.name.startsWith('conn_')) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (material) exportedConnectorMaterials.add(material);
      }
    });
    assert.ok(exportedConnectorMaterials.size > 0);
    for (const material of exportedConnectorMaterials) {
      assert.ok(assembledStates.some((state) =>
        material.opacity === state.opacity
        && material.transparent === state.transparent
        && material.depthWrite === state.depthWrite
      ));
    }
    assert.ok(sourceMaterials.some((material) => material.opacity < 1),
      'visible animation material state must be restored after flattening');
  } finally {
    if (exported) disposeFlattenedMeshes(exported);
    product.dispose();
    Object.defineProperty(globalThis, 'performance', { value: originalPerformance, configurable: true });
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test('export resources are cloned and XRay material never enters the manufacturing GLB', () => {
  const product = buildRodRack({ style: 'poster' });
  try {
    const pose = captureAssemblyPose(product.group);
    const originalMaterials = new Set();
    product.group.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        originalMaterials.add(material);
      }
    });
    applyXrayTo(product.group, true);
    const exported = flattenToPlainMeshes(product.group, 'Frozen', {
      assemblyPose: pose,
      cloneResources: true,
    });
    const sourceMaterials = new Set();
    product.group.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        sourceMaterials.add(material);
      }
    });
    exported.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        assert.ok(!sourceMaterials.has(material), 'exported material must not alias live/XRay material');
      }
    });
    applyXrayTo(product.group, false);
    const clean = flattenToPlainMeshes(product.group, 'Clean', {
      assemblyPose: pose,
      cloneResources: true,
    });
    let sawOriginal = false, sawXray = false;
    const originalStates = new Set([...originalMaterials].map(
      (material) => `${material.opacity}|${material.transparent}|${material.depthWrite}|${material.color?.getHexString?.()}`,
    ));
    clean.traverse((object) => {
      if (!object.isMesh) return;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        sawOriginal ||= originalStates.has(
          `${material.opacity}|${material.transparent}|${material.depthWrite}|${material.color?.getHexString?.()}`,
        );
        sawXray ||= material.transparent === true && material.depthWrite === false;
      }
    });
    assert.equal(sawOriginal, true);
    assert.equal(sawXray, false);
  } finally {
    product.dispose();
  }
});
