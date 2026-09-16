import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildGlbFrame } from '../src/core/buildGlbFrame.js';
import { LIMITS } from '../src/config/product.js';

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
    // 2 层时背板仍为通高整板
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
