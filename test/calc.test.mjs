// 纯函数单测：下料修正模型 / 配置规整 / 报价 / 算料单工作簿
// 运行：npm test（node --test，无需浏览器）
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConfig, DEFAULT_CONFIG, beamCutLength, JOINT_GAP, LIMITS,
} from '../src/config/product.js';
import { calcPrice } from '../src/ui/store.js';

// buildCutlistWorkbook 在调用时读 window.__ALU_LABELS（浏览器注入），node 下手动补
globalThis.window = {
  __ALU_LABELS: {
    product: {
      PROFILE_SERIES: { '2040': { label: '2040' } },
      DECK_TYPES: { rib: { label: '型材层板' }, acrylic: { label: '磨砂亚克力' }, none: { label: '无' } },
      COLORS: { silver: { label: '银色' } },
    },
    rodrack: {
      BACK_TYPES: { none: { label: '无' } },
      SHELF_TYPES: { none: { label: '无' } },
      ROD_COLORS: { chrome: { label: '镀铬' } },
    },
  },
};
const { buildCutlistWorkbook } = await import('../src/ui/cutlist.js');

test('beamCutLength 扣除立柱占宽与两端角件间隙', () => {
  assert.equal(beamCutLength(0.57), +(0.57 - 0.02 - 2 * JOINT_GAP).toFixed(3));
  assert.equal(beamCutLength(0.30), 0.276);
  assert.ok(beamCutLength(1.2) < 1.2, '下料长必须小于名义跨宽');
});

test('normalizeConfig 补齐并裁剪 decks / bayWidths', () => {
  const c = normalizeConfig({ ...DEFAULT_CONFIG, bays: 3, levels: 4 });
  assert.equal(c.decks.length, 4);
  assert.equal(c.bayWidths.length, 3);
  // 层数缩小时旧数组被裁剪到当前 levels
  const c2 = normalizeConfig({ ...c, levels: 2, decks: ['rib', 'acrylic', 'none', 'rib'] });
  assert.equal(c2.decks.length, 2);
});

test('calcPrice 从BOM计价并随材料量增长', () => {
 const stats={cutList:[{spec:'梁',section:'20×40',len:1,qty:2}]};
 assert.equal(calcPrice({},stats),32);
 assert.equal(calcPrice({}, {cutList:[{...stats.cutList[0],qty:3}]}),48);
});

test('算料单工作簿：含净跨列、无虚假公差声明、下料长已修正', () => {
  const cfg = normalizeConfig({ ...DEFAULT_CONFIG, bays: 2, levels: 3, bayWidths: [0.57, 0.57] });
  const stats = {
    cutList: [
      { spec: '2040 背横梁', section: '20×40', len: beamCutLength(0.57), span: 0.57, qty: 8 },
    ],
    hardware: [{ name: '压铸角件 26mm', qty: 24 }],
    profileLengthM: 20, weightKg: 50, partCount: 100, stripLengthM: 5,
  };
  const xml = buildCutlistWorkbook(cfg, stats, 'profile');
  assert.match(xml, /名义尺寸/);
  assert.doesNotMatch(xml, /±0\.5mm/);
  assert.match(xml, /0\.546/, '0.57m 跨的下料长应为 0.546');
  assert.match(xml, /磨砂亚克力|型材层板/);
});

test('LIMITS 边界：跨宽上下限下料长仍为正值', () => {
  const [min, max] = LIMITS.bayWidth;
  assert.ok(beamCutLength(min) > 0.2, '最小跨下料长应合理');
  assert.ok(beamCutLength(max) < max, '最大跨必须扣除节点占位');
});

test('updatePriceBlock 正常运行并填充价格与明细，无未定义变量异常', async () => {
  const { updatePriceBlock } = await import('../src/ui/priceview.js');
  const div = {
    querySelector: () => ({
      textContent: '',
      innerHTML: '',
      append: () => {},
      appendChild: () => {},
      classList: { remove: () => {}, add: () => {} },
      offsetWidth: 100,
    }),
  };
  globalThis.document = {
    createElement: () => ({
      className: '',
      textContent: '',
      append: () => {},
      appendChild: () => {},
    }),
  };
  const stats = { cutList: [{ spec: '梁', section: '20×40', len: 1, qty: 2 }], hardware: [], panes: [] };
  const q = updatePriceBlock(div, stats);
  assert.ok(q && Number.isFinite(q.total));
});
