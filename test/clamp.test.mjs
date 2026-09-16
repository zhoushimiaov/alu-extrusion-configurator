// store 层数值钳制回归：hash/localStorage 注入的越界值必须被收敛到 limits
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeClamp } from '../src/config/clamp.js';
import { LIMITS as ROD_LIMITS, DEFAULT_ROD_CONFIG } from '../src/config/rodrack.js';
import { LIMITS as CRATES_LIMITS, DEFAULT_CRATES_CONFIG } from '../src/config/crates.js';
import { LIMITS as WC_LIMITS, DEFAULT_WOODCART_CONFIG } from '../src/config/woodcart.js';

test('clamp 收敛越界数值到 limits', () => {
  const c = makeClamp(ROD_LIMITS, DEFAULT_ROD_CONFIG);
  const out = c({ ...DEFAULT_ROD_CONFIG, width: 1e9, height: -5 });
  assert.equal(out.width, ROD_LIMITS.width[1]);
  assert.equal(out.height, ROD_LIMITS.height[0]);
});

test('clamp 对非有限值回退默认值', () => {
  const c = makeClamp(CRATES_LIMITS, DEFAULT_CRATES_CONFIG);
  const out = c({ ...DEFAULT_CRATES_CONFIG, width: NaN, tiers: Infinity, depth: 'x' });
  assert.equal(out.width, DEFAULT_CRATES_CONFIG.width);
  assert.equal(out.tiers, DEFAULT_CRATES_CONFIG.tiers);
  assert.equal(out.depth, DEFAULT_CRATES_CONFIG.depth);
});

test('clamp 保留合法值与非数值键', () => {
  const c = makeClamp(WC_LIMITS, DEFAULT_WOODCART_CONFIG);
  const out = c({ ...DEFAULT_WOODCART_CONFIG, width: 1.0, woodTone: 'walnut' });
  assert.equal(out.width, 1.0);
  assert.equal(out.woodTone, 'walnut');
});

test('rodStore.set 经钳制：注入 width 1e9 后读数为上限', async () => {
  const { rodStore } = await import('../src/ui/rodPanel.js');
  rodStore.set({ width: 1e9 });
  assert.equal(rodStore.get().width, ROD_LIMITS.width[1]);
  rodStore.set({ width: DEFAULT_ROD_CONFIG.width });
});
