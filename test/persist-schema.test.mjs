// 持久化白名单（persist.js SCHEMA）与各产品 DEFAULT_CONFIG 一致性断言：
// 新增配置字段漏登记时此测试直接失败，杜绝「配置写入后被静默丢弃」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const persistSrc = readFileSync(new URL('../src/ui/persist.js', import.meta.url), 'utf8');

// 从 persist.js 源码提取 SCHEMA 块（运行时 import 不导出内部常量，源码断言更直接）
const schemaMatch = persistSrc.match(/const SCHEMA = \{([\s\S]*?)\n\};/);
assert.ok(schemaMatch, 'persist.js 中应能找到 SCHEMA 定义');
const SCHEMA = new Function(`return {${schemaMatch[1]}\n}`)();

const configs = {
  profile: (await import('../src/config/product.js')).DEFAULT_CONFIG,
  rod: (await import('../src/config/rodrack.js')).DEFAULT_ROD_CONFIG,
  cart: (await import('../src/config/cart.js')).DEFAULT_CART_CONFIG,
  crates: (await import('../src/config/crates.js')).DEFAULT_CRATES_CONFIG,
  woodcart: (await import('../src/config/woodcart.js')).DEFAULT_WOODCART_CONFIG,
  hanger: (await import('../src/config/hanger.js')).DEFAULT_HANGER_CONFIG,
  books: (await import('../src/config/bookshelf.js')).DEFAULT_BOOKSHELF_CONFIG,
};

for (const [kind, defaults] of Object.entries(configs)) {
  test(`persist SCHEMA[${kind}] 覆盖 DEFAULT_CONFIG 全部字段`, () => {
    const white = SCHEMA[kind];
    assert.ok(Array.isArray(white), `SCHEMA.${kind} 缺失`);
    const missing = Object.keys(defaults).filter((k) => !white.includes(k));
    assert.deepEqual(missing, [], `DEFAULT_CONFIG 中的字段未登记进 persist 白名单（会被静默丢弃）: ${missing.join(', ')}`);
  });
}

test('SCHEMA 中的产品种类与配置集合一一对应', () => {
  assert.deepEqual(Object.keys(SCHEMA).sort(), Object.keys(configs).sort());
});