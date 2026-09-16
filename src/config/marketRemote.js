// 价格表运行时加载：Cloudflare KV（远端）优先，失败回退内置基准值。
// KV 结构：{ updated: ISO日期, source: 文案, rules: [...], hardware: [...], acrylicPerM2: {...}, zincPerM2: {...}, posterFlat: {...} }
// 注意：JSON 无法承载 RegExp —— 远端 rules/hardware 的 match 字段必须是「正则源码字符串」，
//       本模块负责编译还原；任何一项非法即丢弃该项，整表非法则回退内置表。
// 更新流程：改 tools/price_table.json（人工核验后）→ wrangler kv key put price_table → 页面无需重新构建部署。
import { MARKET as BUILTIN_MARKET } from './market.js';

const KV_URL = '/api/market'; // Cloudflare Worker（worker.js）：KV 绑定 MARKET_KV，key = price_table

let cache = null;      // 已合并结果
let inflight = null;   // 进行中的 fetch（去重）

/** 把 match 字段规整为 RegExp：已是 RegExp 直接用；字符串则编译；非法返回 null */
function toRegExp(match) {
  if (match instanceof RegExp) return match;
  if (typeof match === 'string' && match.length) {
    try { return new RegExp(match); } catch { return null; }
  }
  return null;
}

/**
 * 清洗规则表：逐项校验 match 可编译 + price 为有限正数，丢弃非法项。
 * 返回 null 表示整表不可用（调用方应回退内置表）。
 */
function sanitizeRules(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const match = toRegExp(r.match);
    const price = Number(r.price);
    if (!match || !Number.isFinite(price) || price < 0) continue;
    out.push({ ...r, match, price });
  }
  return out.length ? out : null;
}

/** 清洗按面积/张计价的板件单价表：price 必须是有限非负数 */
function sanitizeFlat(t, fallback) {
  if (!t || typeof t !== 'object') return fallback;
  const price = Number(t.price);
  if (!Number.isFinite(price) || price < 0) return fallback;
  return { ...fallback, ...t, price };
}

/** 深合并：远端字段覆盖内置基准，缺失/非法字段回退（保证向后兼容，坏数据不会污染报价） */
function mergeMarket(remote, builtin) {
  if (!remote || typeof remote !== 'object') return builtin;
  return {
    updated: typeof remote.updated === 'string' ? remote.updated : builtin.updated,
    source: typeof remote.source === 'string' ? remote.source : builtin.source,
    rules: sanitizeRules(remote.rules) || builtin.rules,
    hardware: sanitizeRules(remote.hardware) || builtin.hardware,
    acrylicPerM2: sanitizeFlat(remote.acrylicPerM2, builtin.acrylicPerM2),
    zincPerM2: sanitizeFlat(remote.zincPerM2, builtin.zincPerM2),
    posterFlat: sanitizeFlat(remote.posterFlat, builtin.posterFlat),
    remoteUpdated: typeof remote.updated === 'string' ? remote.updated : null,
  };
}

/** 获取当前价格表（带缓存）。KV 不可达/未配置/数据非法时静默回退内置表，不阻塞首屏。 */
export function getMarket() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  // file:// 单文件版没有后端：直接用内置表，避免 fetch 抛协议错误
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    cache = { ...BUILTIN_MARKET, remoteUpdated: null };
    return Promise.resolve(cache);
  }
  inflight = fetch(KV_URL, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((remote) => { cache = mergeMarket(remote, BUILTIN_MARKET); return cache; })
    .catch(() => { cache = { ...BUILTIN_MARKET, remoteUpdated: null }; return cache; })
    .finally(() => { inflight = null; });
  return inflight;
}

/** 同步基准值（测试/SSR/极端离线场景）：不发起网络请求 */
export function getBuiltinMarket() {
  return BUILTIN_MARKET;
}

/** 测试辅助：重置缓存 */
export function resetMarketCacheForTest() {
  cache = null;
  inflight = null;
}
