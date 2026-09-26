import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildGlbFrame } from '../src/core/buildGlbFrame.js';
import { calcMarketPrice } from '../src/ui/marketPrice.js';

test('GLB exact mode emits real cut list, positive mass and explicit unpriced reference items', () => {
  const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 3, props: false, sidePanels: false });
  assert.ok(built.stats.cutList.length >= 5);
  assert.ok(built.stats.profileLengthM > 1);
  assert.ok(built.stats.weightKg > 0.5);

  const quote = calcMarketPrice(built.stats);
  assert.ok(quote.total > 0);
  assert.equal(quote.complete, false);
  assert.ok(quote.unpriced.some(name => /30×30/.test(name)));
  assert.ok(quote.unpriced.some(name => /连接方式/.test(name)));
  assert.ok(built.stats.cutList.some(c => c.section === '20×20'));

  built.dispose();
});

test('GLB exact mode applies anodized color while keeping cut faces distinct', () => {
  const expected = { silver: 0x9ba1a8, black: 0x24262a, champagne: 0xb89f78 };
  for (const [color, hex] of Object.entries(expected)) {
    const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 2, props: false, sidePanels: false, color });
    const sideMaterial = built.groups.posts.material[1];
    const capMaterial = built.groups.posts.material[0];
    assert.equal(sideMaterial.color.getHex(), hex);
    assert.notEqual(capMaterial.color.getHex(), sideMaterial.color.getHex());
    built.dispose();
  }
});

test('GLB exact mode props switch creates deterministic display-only props on deck levels', () => {
  const cfg = {
    bayWidths: [.57, .57],
    levels: 3,
    decks: ['rib', 'none', 'rib'],
    sidePanels: false,
    color: 'silver',
    props: true,
  };
  const a = buildGlbFrame(cfg);
  const b = buildGlbFrame(cfg);
  assert.ok(a.groups.props);
  assert.equal(a.groups.props.userData.displayOnly, true);
  assert.ok(a.groups.props.children.length > 0);
  assert.equal(a.groups.props.children.length, b.groups.props.children.length);

  const off = buildGlbFrame({ ...cfg, props: false });
  assert.equal(off.groups.props, undefined);
  a.dispose();
  b.dispose();
  off.dispose();
});

test('GLB exact mode sidePanels places per-level back panels on wall side only', () => {
  const cfg = {
    bayWidths: [.57, .57],
    levels: 3,
    decks: ['rib', 'none', 'rib'],
    props: false,
    sidePanels: true,
    color: 'silver',
  };
  const built = buildGlbFrame(cfg);
  assert.ok(built.groups.panels);
  // 背板全开 → 整块通高拉通（单实例，零横向接缝）
  assert.equal(built.groups.panels.count, 1);
  const matrix = new THREE.Matrix4();
  built.groups.panels.getMatrixAt(0, matrix);
  const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(pos.z < built.layout.ends.backSideZ + .03);
  assert.ok(pos.z > -.25);
  built.groups.panels.geometry.computeBoundingBox();
  const box = built.groups.panels.geometry.boundingBox.clone().applyMatrix4(matrix);
  assert.ok(Math.abs(box.min.y - 0) < 1e-6);
  assert.ok(Math.abs(box.max.y - built.layout.H) < 1e-6);

  // 分跨背板：backs[k]==='none' 的层不出背板（2 跨 × 2 层 = 4 块）
  const partial = buildGlbFrame({ ...cfg, backs: ['panel', 'none', 'panel'] });
  assert.equal(partial.groups.panels.count, 2);

  // 背板颜色可选：默认镀锌银灰，可切换哑黑
  assert.equal(built.groups.panels.material.color.getHex(), 0xc7cdd1);
  const dark = buildGlbFrame({ ...cfg, panelColor: 'black' });
  assert.equal(dark.groups.panels.material.color.getHex(), 0x2b2d30);
  dark.dispose();

  const off = buildGlbFrame({ ...cfg, sidePanels: false });
  assert.equal(off.groups.panels, undefined);
  built.dispose();
  partial.dispose();
  off.dispose();
});

test('GLB exact mode respects per-level decks: none skips strips, acrylic adds panes', () => {
  const cfg = { bayWidths: [.57, .57], levels: 3, decks: ['rib', 'acrylic', 'none'], props: false, sidePanels: false };
  const built = buildGlbFrame(cfg);
  // 仅第 1 层铺板条：每跨 floor((.57-.03)/.02)=27 根 × 2 跨
  assert.equal(built.groups.strips.count, 27 * 2);
  // 第 2 层改磨砂亚克力整板：2 跨 → 2 块
  assert.ok(built.groups.pane);
  assert.equal(built.groups.pane.count, 2);
  assert.ok(built.stats.panes.length > 0);
  // 无层板配置（兼容旧调用）：全层铺板条（含顶层封面）
  const legacy = buildGlbFrame({ bayWidths: [.57, .57], levels: 3, props: false, sidePanels: false });
  assert.equal(legacy.groups.strips.count, 27 * 2 * 4);
  assert.equal(legacy.groups.pane, undefined);
  built.dispose();
  legacy.dispose();
});

test('GLB exact mode marks its price as a partial reference estimate', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /\.price-note/);
  // 注：未计价态的显性表达已上移到 priceview.js（¥ N + / 「另有 N 项待询价」胶囊），
  // 面板价注只保留身份文案。
  assert.match(source, /参考估价/);
  const priceview = readFileSync(new URL('../src/ui/priceview.js', import.meta.url), 'utf8');
  assert.match(priceview, /项待询价/);
  assert.match(priceview, /q\.complete/);
});

test('GLB exact mode stats respond to bays and levels', () => {
  const small = buildGlbFrame({ bayWidths: [.57, .57], levels: 2, props: false, sidePanels: false });
  const large = buildGlbFrame({ bayWidths: [.57, .57, .8], levels: 3, props: false, sidePanels: false });
  assert.ok(large.stats.profileLengthM > small.stats.profileLengthM);
  assert.ok(large.stats.weightKg > small.stats.weightKg);
  assert.ok(large.stats.partCount > small.stats.partCount);
  small.dispose();
  large.dispose();
});
