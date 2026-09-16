// 价格表序列化回归：防止「RegExp 存不进 JSON → 线上报价引擎 TypeError」复发
// 历史 bug：export-price.mjs 直接 JSON.stringify(MARKET)，所有 match 变成 {}，
//          线上 https 下 calcMarketPrice 调 r.match.test() 抛 TypeError。
//          file:// 走内置表（真 RegExp）所以本地 QA 抓不到，只有线上炸。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TABLE = JSON.parse(readFileSync(new URL('../tools/price_table.json', import.meta.url), 'utf8'));

test('price_table.json 的 match 字段全部是可编译的非空字符串（不是 RegExp 也不是 {}）', () => {
  for (const list of [TABLE.rules, TABLE.hardware]) {
    assert.ok(Array.isArray(list) && list.length, 'rules/hardware 必须是非空数组');
    for (const r of list) {
      assert.equal(typeof r.match, 'string', `match 必须是字符串，实际 ${typeof r.match}（${r.id || ''}）`);
      assert.ok(r.match.length > 0, 'match 不能为空串');
      assert.ok(typeof r.price === 'number' && Number.isFinite(r.price) && r.price >= 0, 'price 必须是有限非负数');
      assert.doesNotThrow(() => new RegExp(r.match), `match 源码必须可编译：${r.match}`);
    }
  }
});

test('板件单价表字段为有限非负数', () => {
  for (const k of ['acrylicPerM2', 'zincPerM2', 'posterFlat']) {
    assert.equal(typeof TABLE[k].price, 'number', `${k}.price 必须是数字`);
    assert.ok(Number.isFinite(TABLE[k].price) && TABLE[k].price >= 0, `${k}.price 必须有限非负`);
  }
});

test('marketRemote 清洗：坏 match（{} / 非法源码 / 缺 price）被丢弃而非抛错', async () => {
  const { getMarket, resetMarketCacheForTest } = await import('../src/config/marketRemote.js');
  resetMarketCacheForTest();
  const prevFetch = globalThis.fetch;
  // 模拟 KV 返回部分坏数据
  const bad = {
    updated: '2026-09-16', source: 'test',
    rules: [
      { id: 'good', match: '20×40|2040', price: 16 },
      { id: 'bad-empty', match: {}, price: 9 },          // {} 应被丢弃
      { id: 'bad-src', match: '([', price: 5 },          // 非法正则应被丢弃
      { id: 'bad-price', match: 'x', price: NaN },       // NaN 应被丢弃
    ],
    hardware: [{ match: '压铸角件', price: 0.8 }],
    acrylicPerM2: { price: 150 }, zincPerM2: { price: 45 }, posterFlat: { price: 28 },
  };
  globalThis.fetch = async () => ({ ok: true, json: async () => bad });
  const m = await getMarket();
  const goodRule = m.rules.find(r => r.id === 'good');
  assert.ok(goodRule, '合法规则应保留');
  assert.ok(goodRule.match instanceof RegExp, '合法规则的 match 应被编译为 RegExp');
  assert.equal(m.rules.length, 1, '三条坏规则应被全部丢弃，只剩 1 条');
  // 还原：用真实 price_table.json 作 stub，保证后续测试 import marketPrice 时能拿到合法表
  globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL('../tools/price_table.json', import.meta.url), 'utf8')) });
  resetMarketCacheForTest();
});

test('marketPrice 引擎正常路径：内置/远端表下报价可算且不抛错', async () => {
  const { calcMarketPrice } = await import('../src/ui/marketPrice.js');
  const stats = {
    cutList: [{ spec: '2040 立柱', section: '20×40', len: 1, qty: 4 }],
    hardware: [{ name: '压铸角件 26mm', qty: 8 }],
    panes: [],
  };
  assert.doesNotThrow(() => calcMarketPrice(stats));
  const q = calcMarketPrice(stats);
  assert.ok(q.total > 0, '应算出正报价');
});
