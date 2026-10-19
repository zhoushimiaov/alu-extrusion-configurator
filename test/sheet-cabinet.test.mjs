import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_GZIP_BASE64, originalGlbBytes } from '../src/assets/sheetCabinetGlb.js';
import { DEFAULT_SHEET_CONFIG, SHEET_ORIGINAL } from '../src/config/sheet.js';
import { buildSheetCabinet, sheetPreviewStats } from '../src/core/buildSheetCabinet.js';
import { sheetStore } from '../src/ui/sheetPanel.js';

test('镀锌板书架：嵌入的是原始 GLB（58KB、58个mesh与node层级），不是程序重新捏造的几何', async () => {
  assert.ok(SOURCE_GZIP_BASE64.length > 7000);
  const bytes = await originalGlbBytes();
  assert.equal(bytes.byteLength, 57856);
  const view = new DataView(bytes);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
  assert.equal(gltf.meshes.length, 58);
  assert.equal(gltf.materials.length, 2);
});

test('镀锌板书架：源模型原位坐标校正后尺寸是4.30×2.35×0.60m，辅助线可切换且不改变网格', async () => {
  const a = await buildSheetCabinet({ ...DEFAULT_SHEET_CONFIG, showGuides: false });
  const b = await buildSheetCabinet({ ...DEFAULT_SHEET_CONFIG, showGuides: true });
  try {
    for (const built of [a, b]) {
      assert.ok(Math.abs(built.bounds.W - SHEET_ORIGINAL.W) < 0.01);
      assert.ok(Math.abs(built.bounds.H - SHEET_ORIGINAL.H) < 0.01);
      assert.ok(Math.abs(built.bounds.D - SHEET_ORIGINAL.D) < 0.01);
      assert.equal(built.stats.meshCount, 44);
      assert.equal(built.stats.guideCount, 14);
      assert.equal(built.stats.prototypeOnly, true);
      assert.deepEqual(built.stats.cutList, []);
    }
    let aLines = 0, bLines = 0;
    a.group.traverse(o => { if (o.isLine) { ++aLines; assert.equal(o.visible, false); } });
    b.group.traverse(o => { if (o.isLine) { ++bLines; assert.equal(o.visible, true); } });
    assert.equal(aLines, 14);
    assert.equal(bLines, 14);
  } finally { a.dispose(); b.dispose(); }
});

test('镀锌板书架：无WebGL模式有源模型尺寸，配置Store只接受boolean', () => {
  assert.deepEqual(Object.keys(DEFAULT_SHEET_CONFIG).sort(), ['kind', 'schemaVersion', 'showGuides'].sort());
  const stats = sheetPreviewStats();
  assert.equal(stats.envelope.W, 4.3);
  assert.equal(stats.weightKg, 0);
  assert.equal(stats.prototypeOnly, true);
  sheetStore.set({ showGuides: true });
  assert.equal(sheetStore.get().showGuides, true);
  sheetStore.set({ showGuides: 'yes', kind: 'profile' });
  assert.equal(sheetStore.get().showGuides, true);
  assert.equal(sheetStore.get().kind, 'sheet');
  sheetStore.set({ showGuides: false });
});
