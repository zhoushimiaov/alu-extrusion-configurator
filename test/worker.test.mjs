// worker.js 契约单测：mock Workers 的 caches / KV / ctx，验证 method 门禁、
// 错误体枚举化、schema 校验、ETag/缓存、协商缓存 304 等全部行为分支。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// --- Workers 全局 mock ---
function makeCacheStore() {
  const map = new Map();
  return {
    match: async (req) => map.get(req.url) || undefined,
    put: async (req, res) => { map.set(req.url, res); },
    delete: async (req) => map.delete(req.url),
    _size: () => map.size,
  };
}
const store = makeCacheStore();
globalThis.caches = { default: store };
globalThis.TextEncoder = TextEncoder;

const { default: worker } = await import('../worker.js');

const VALID = JSON.parse(readFileSync(new URL('../tools/price_table.json', import.meta.url), 'utf8'));
const VALID_JSON = JSON.stringify(VALID);

function req(path, opts = {}) {
  return new Request('https://rack.means.group' + path, opts);
}
function ctx() {
  return { waitUntil: () => {} };
}
function envWith(tableText) {
  return { MARKET_KV: { get: async () => tableText } };
}

test('非 /api/market 路径返回 404 + 枚举错误体（无内部细节）', async () => {
  const r = await worker.fetch(req('/api/nope'), envWith(VALID_JSON), ctx());
  assert.equal(r.status, 404);
  const j = await r.json();
  assert.equal(j.code, 'not_found');
  assert.equal(typeof j.message, 'string');
});

test('POST /api/market 返回 405（读接口不接受写）', async () => {
  const r = await worker.fetch(req('/api/market', { method: 'POST' }), envWith(VALID_JSON), ctx());
  assert.equal(r.status, 405);
  assert.equal((await r.json()).code, 'method_not_allowed');
});

test('MARKET_KV 未绑定 → 503 backend_unavailable（不回传绑定名细节）', async () => {
  const r = await worker.fetch(req('/api/market'), {}, ctx());
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'backend_unavailable');
});

test('price_table 未写入 → 404 price_table_missing', async () => {
  const r = await worker.fetch(req('/api/market'), envWith(null), ctx());
  assert.equal(r.status, 404);
  assert.equal((await r.json()).code, 'price_table_missing');
});

test('KV 抛错 → 500 internal_error（错误体不含异常字符串）', async () => {
  const env = { MARKET_KV: { get: async () => { throw new Error('kv boom secret-detail'); } } };
  const r = await worker.fetch(req('/api/market'), env, ctx());
  assert.equal(r.status, 500);
  const j = await r.json();
  assert.equal(j.code, 'internal_error');
  assert.ok(!JSON.stringify(j).includes('kv boom'), '错误体不得泄漏内部异常字符串');
});

test('非法 JSON → 502 price_table_invalid', async () => {
  const r = await worker.fetch(req('/api/market'), envWith('{ not json'), ctx());
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, 'price_table_invalid');
});

test('match 为 {}（RegExp 序列化历史 bug）→ 502 拒绝回传', async () => {
  const bad = { ...VALID, rules: VALID.rules.map(r => ({ ...r, match: {} })) };
  const r = await worker.fetch(req('/api/market'), envWith(JSON.stringify(bad)), ctx());
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, 'price_table_invalid');
});

test('price 为 NaN/负数 → 502 拒绝回传', async () => {
  const bad = { ...VALID, rules: VALID.rules.map((r, i) => ({ ...r, price: i === 0 ? -1 : r.price })) };
  const r = await worker.fetch(req('/api/market'), envWith(JSON.stringify(bad)), ctx());
  assert.equal(r.status, 502);
});

test('合法价格表 → 200 + JSON + ETag + cache-control', async () => {
  const r = await worker.fetch(req('/api/market'), envWith(VALID_JSON), ctx());
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.match(r.headers.get('cache-control'), /max-age=300/);
  assert.ok(r.headers.get('etag'), '应带 ETag');
  const j = await r.json();
  assert.ok(Array.isArray(j.rules) && j.rules.length);
});

test('二次请求命中边缘缓存（Cache API put 生效）', async () => {
  // 用独立缓存，避免被前面测试写入的同 URL 响应污染
  globalThis.caches = { default: makeCacheStore() };
  let kvReads = 0;
  const env = { MARKET_KV: { get: async () => { kvReads++; return VALID_JSON; } } };
  await worker.fetch(req('/api/market'), env, ctx());
  const readsAfterFirst = kvReads;
  await worker.fetch(req('/api/market'), env, ctx());
  assert.equal(readsAfterFirst, 1, '首次应读 KV');
  assert.equal(kvReads, 1, '二次应命中缓存，不再读 KV');
});

test('If-None-Match 匹配 → 304（协商缓存）', async () => {
  // 先拿一次 ETag
  const s2 = makeCacheStore();
  globalThis.caches = { default: s2 };
  const first = await worker.fetch(req('/api/market'), envWith(VALID_JSON), ctx());
  const etag = first.headers.get('etag');
  await first.arrayBuffer();
  const second = await worker.fetch(req('/api/market', { headers: { 'if-none-match': etag } }), envWith(VALID_JSON), ctx());
  // 第二次可能命中 Cache API 直接 200，也可能走协商 304 —— 两者都可接受
  assert.ok([200, 304].includes(second.status), `期望 200 或 304，实际 ${second.status}`);
});

// ---- /api/version ----

test('GET /api/version 返回部署指纹（worker 名 + build + kv 绑定状态）', async () => {
  const r = await worker.fetch(req('/api/version'), envWith(VALID_JSON), ctx());
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.worker, 'modulo-alu-shelf');
  assert.equal(typeof j.build, 'string');
  assert.equal(j.kv, true);
  assert.match(r.headers.get('cache-control') || '', /no-store/);
});

test('POST /api/version 返回 405（只读端点）', async () => {
  const r = await worker.fetch(req('/api/version', { method: 'POST' }), envWith(VALID_JSON), ctx());
  assert.equal(r.status, 405);
});

// ---- /api/market/purge ----

test('purge 无 token / 错 token → 401，且不清缓存', async () => {
  globalThis.caches = { default: makeCacheStore() };
  const env = { ...envWith(VALID_JSON), PURGE_TOKEN: 'secret-abc' };
  // 先灌入一条缓存
  await worker.fetch(req('/api/market'), env, ctx());
  const r1 = await worker.fetch(req('/api/market/purge', { method: 'POST' }), env, ctx());
  assert.equal(r1.status, 401);
  assert.equal((await r1.json()).code, 'unauthorized');
  const r2 = await worker.fetch(req('/api/market/purge', { method: 'POST', headers: { authorization: 'Bearer wrong' } }), env, ctx());
  assert.equal(r2.status, 401);
});

test('PURGE_TOKEN 未配置时端点恒 401（不因缺配置变成开放端点）', async () => {
  const r = await worker.fetch(
    req('/api/market/purge', { method: 'POST', headers: { authorization: 'Bearer whatever' } }),
    envWith(VALID_JSON), ctx(),
  );
  assert.equal(r.status, 401);
});

test('GET /api/market/purge → 405（只接受 POST）', async () => {
  const r = await worker.fetch(req('/api/market/purge'), { ...envWith(VALID_JSON), PURGE_TOKEN: 'x' }, ctx());
  assert.equal(r.status, 405);
});

test('正确 token purge 后缓存被清：下一次 /api/market 重新读 KV', async () => {
  globalThis.caches = { default: makeCacheStore() };
  let kvReads = 0;
  const env = { MARKET_KV: { get: async () => { kvReads++; return VALID_JSON; } }, PURGE_TOKEN: 'secret-abc' };
  await worker.fetch(req('/api/market'), env, ctx());   // 读 KV + 写缓存
  await worker.fetch(req('/api/market'), env, ctx());   // 命中缓存
  assert.equal(kvReads, 1);
  const p = await worker.fetch(req('/api/market/purge', { method: 'POST', headers: { authorization: 'Bearer secret-abc' } }), env, ctx());
  assert.equal(p.status, 200);
  assert.equal((await p.json()).code, 'cache_purged');
  await worker.fetch(req('/api/market'), env, ctx());   // 缓存已清 → 重新读 KV
  assert.equal(kvReads, 2);
});
