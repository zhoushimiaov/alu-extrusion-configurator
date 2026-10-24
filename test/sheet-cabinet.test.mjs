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
  assert.deepEqual(Object.keys(DEFAULT_SHEET_CONFIG).sort(), ['kind', 'schemaVersion', 'showGuides', 'thicknessMm', 'folds', 'fasteners', 'finish'].sort());
  const stats = sheetPreviewStats();
  assert.equal(stats.envelope.W, 4.3);
  assert.equal(stats.weightKg, 0);
  assert.equal(stats.prototypeOnly, true);
  sheetStore.set({ showGuides: true });
  assert.equal(sheetStore.get().showGuides, true);
  sheetStore.set({ showGuides: 'yes', kind: 'profile' });
  assert.equal(sheetStore.get().showGuides, true);
  assert.equal(sheetStore.get().kind, 'sheet');
  sheetStore.set({ showGuides: false, thicknessMm: 2, folds: false, fasteners: false, finish: 'satin' });
  assert.equal(sheetStore.get().thicknessMm, 2);
  assert.equal(sheetStore.get().finish, 'satin');
  sheetStore.set({ thicknessMm: -1, finish: 'not-a-material', folds: 'none', fasteners: 42 });
  assert.equal(sheetStore.get().thicknessMm, 2);
  assert.equal(sheetStore.get().finish, 'satin');
  assert.equal(sheetStore.get().folds, false);
  assert.equal(sheetStore.get().fasteners, false);
  sheetStore.set({ ...DEFAULT_SHEET_CONFIG });
});

test('镀锌板书架：32组零厚度面形成封闭有厚度实体，箱体与原始 GLB 保持不变', async () => {
  const thin = await buildSheetCabinet({ thicknessMm: 1, folds: false, fasteners: false });
  const thick = await buildSheetCabinet({ thicknessMm: 2, folds: true, fasteners: true });
  try {
    for (const built of [thin, thick]) {
      assert.equal(built.stats.meshCount, 44, '原始板件/箱体网格不丢失');
      assert.equal(built.stats.displayDetails.sheetSurfaces, 32, '32 个零厚度面升级成实体');
      assert.deepEqual(built.stats.cutList, [], '不得把自动显示细节冒充工程下料数据');
      assert.equal(built.stats.prototypeOnly, true);
      assert.ok(Math.abs(built.bounds.W - 4.3) < 0.01);
    }
    const findHorizontal = built => {
      let match;
      built.group.traverse(o => { if (o.name === 'FoldableSheet_0') match = o; });
      assert.ok(match, '首个全宽水平板应生成实体');
      return match;
    };
    const p1 = findHorizontal(thin);
    const p2 = findHorizontal(thick);
    p1.geometry.computeBoundingBox();
    p2.geometry.computeBoundingBox();
    const h1 = p1.geometry.boundingBox.max.y - p1.geometry.boundingBox.min.y;
    const h2 = p2.geometry.boundingBox.max.y - p2.geometry.boundingBox.min.y;
    assert.ok(Math.abs(h1 - 0.001) < 0.0001, '1mm 厚度必须改变真实 geometry');
    assert.ok(Math.abs(h2 - 0.002) < 0.0001, '2mm 厚度必须改变真实 geometry');
    assert.ok(p2.geometry.index.count > 12, '应包含双面板和封闭侧墙，而不是原来2个三角面');
    assert.equal(thin.stats.displayDetails.foldCount, 0);
    assert.equal(thin.stats.displayDetails.fastenerCount, 0);
    assert.ok(thick.stats.displayDetails.foldCount >= 3, '横向板和斜板产生可见回折');
    assert.ok(thick.stats.displayDetails.fastenerCount >= 4, '连接点被实例化');
    let hasReturn = false, hasRivet = false;
    thick.group.traverse(o => {
      if (o.name === 'FrontHem' || o.name === 'DiagonalPanelReturn') hasReturn = true;
      if (o.name === 'FixingRivet') hasRivet = true;
    });
    assert.ok(hasReturn && hasRivet, '真实的回折和金属连接件位于场景中');
  } finally { thin.dispose(); thick.dispose(); }
});
