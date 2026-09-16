// 价格表运行时加载：Cloudflare KV（远端）优先，失败回退内置基准值。
// KV 结构：{ updated: ISO日期, source: 文案, rules: [...], hardware: [...], acrylicPerM2: {...}, zincPerM2: {...}, posterFlat: {...} }
// 更新流程：price-scout 抓取 → 人工核验 → wrangler kv key put price_table <json> → 页面无需重新构建部署。
import { MARKET as BUILTIN_MARKET } from './market.js';

const KV_URL = '/api/market'; // Pages Functions: KV binding MARKET_KV, key = price_table

let cache = null;      // 已合并结果
let inflight = null;   // 进行中的 fetch（去重）

/** 深合并：远端字段覆盖内置基准，缺失字段回退（保证向后兼容） */
function mergeMarket(remote, builtin) {
  if (!remote || typeof remote !== 'object') return builtin;
  return {
    updated: remote.updated || builtin.updated,
    source: remote.source || builtin.source,
    rules: (remote.rules && remote.rules.length ? remote.rules : builtin.rules),
    hardware: (remote.hardware && remote.hardware.length ? remote.hardware : builtin.hardware),
    acrylicPerM2: remote.acrylicPerM2 || builtin.acrylicPerM2,
    zincPerM2: remote.zincPerM2 || builtin.zincPerM2,
    posterFlat: remote.posterFlat || builtin.posterFlat,
    remoteUpdated: remote.updated || null,
  };
}

/** 获取当前价格表（带缓存）。KV 不可达/未配置时静默回退内置表，不阻塞首屏。 */
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
