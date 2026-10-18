import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULT_CONFIG, normalizeConfig, LIMITS } from '../src/config/product.js';
import { decodeCfg } from '../src/ui/persist.js';
import { calcMarketPrice } from '../src/ui/marketPrice.js';
import { summarizeBom } from '../src/ui/bomSummary.js';
import { flattenToPlainMeshes } from '../src/ui/modelExport.js';

test('型材架配置：非法 URL/存储数据不可突破层数、跨数与宽度限制', () => {
  const cfg = normalizeConfig({
    bays: 999999, levels: 999999, series: 'unknown', frameMode: 'fake',
    decks: ['invalid'], backs: ['none', 123],
    bayWidths: [Infinity, NaN, -999, 9999, 0.57],
    color: 'bogus', props: 'yes',
  });
  assert.equal(cfg.bays, LIMITS.bays[1]);
  assert.equal(cfg.levels, LIMITS.levels[1]);
  assert.equal(cfg.series, DEFAULT_CONFIG.series);
  assert.equal(cfg.frameMode, DEFAULT_CONFIG.frameMode);
  assert.equal(cfg.color, DEFAULT_CONFIG.color);
  assert.equal(cfg.props, DEFAULT_CONFIG.props);
  assert.equal(cfg.decks.length, cfg.levels);
  assert.equal(cfg.backs.length, cfg.levels);
  assert.equal(cfg.bayWidths.length, cfg.bays);
  assert.deepEqual(cfg.bayWidths.slice(0, 5), [0.57, 0.57, 0.3, 1.2, 0.57]);
  assert.ok(cfg.bayWidths.every(w => Number.isFinite(w) && w >= LIMITS.bayWidth[0] && w <= LIMITS.bayWidth[1]));
  assert.equal(cfg.decks[0], 'rib');
  assert.equal(cfg.backs[0], 'none');
  assert.equal(normalizeConfig({ levels: 2.5 }).levels, DEFAULT_CONFIG.levels);
  assert.equal(normalizeConfig({ bays: -1 }).bays, LIMITS.bays[0]);
  assert.equal(decodeCfg('A'.repeat(17000)), null);
});

test('报价：胶合板不会从 cutList 静默漏价', () => {
  const quote = calcMarketPrice({
    cutList: [{ spec: '底台（胶合板 18mm）', section: '板', len: 1.2, qty: 1 }],
    panes: [], hardware: [],
  });
  assert.equal(quote.complete, false);
  assert.ok(quote.unpriced.includes('底台（胶合板 18mm）'));
});

test('报价：未知板材不会自动使用镀锌板单价；已覆盖的板件不重复计价', () => {
  const quote = calcMarketPrice({
    cutList: [{ spec: '钢化玻璃台面 8mm', section: '板', len: 1.2, qty: 1, pricedViaPane: true }],
    panes: [{ label: '钢化玻璃台面（8mm）', kind: 'glass', areaM2: 0.8 }],
    hardware: [],
  });
  assert.equal(quote.complete, false);
  assert.equal(quote.total, 0);
  assert.deepEqual(quote.unpriced, ['钢化玻璃台面（8mm）']);
  const acrylic = calcMarketPrice({
    cutList: [{ spec: '磨砂亚克力板', section: '板', len: 1, qty: 1, pricedViaPane: true }],
    panes: [{ label: '磨砂亚克力板', kind: 'acrylic', areaM2: 1 }],
  });
  assert.equal(acrylic.complete, true);
  assert.equal(acrylic.total, 150);
});

test('BOM：板件与成品件单边尺寸不可累加到型材下料长度', () => {
  const summary = summarizeBom({ cutList: [
    { section: '20×20', len: 1.2, qty: 3 },
    { section: '板', len: 2, qty: 5 },
    { section: '件', len: 1.8, qty: 2 },
  ]});
  assert.ok(Math.abs(summary.cutLengthM - 3.6) < 1e-9);
  assert.equal(summary.panelCount, 5);
  assert.equal(summary.assemblyCount, 2);
});

test('GLB 展平：即使远景隐藏高精度板条，也只导出真实板条而不是 LOD 替身', () => {
  const root = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  const strips = new THREE.InstancedMesh(geo, mat, 1);
  strips.name = 'strips'; strips.visible = false;
  strips.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 2, 3));
  root.add(strips);
  const lod = new THREE.InstancedMesh(geo, mat, 1);
  lod.name = 'stripsLOD'; lod.visible = true;
  root.add(lod);
  const hiddenParent = new THREE.Group();
  hiddenParent.visible = false;
  hiddenParent.add(new THREE.Mesh(geo, mat));
  root.add(hiddenParent);
  const flattened = flattenToPlainMeshes(root, 'Test');
  assert.deepEqual(flattened.children.map(m => m.name), ['strips_0']);
  assert.equal(flattened.children[0].position.x, 1);
  assert.equal(flattened.children[0].position.y, 2);
  assert.equal(flattened.children[0].position.z, 3);
  geo.dispose(); mat.dispose();
});
