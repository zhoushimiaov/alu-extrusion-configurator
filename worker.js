// modulo-alu-shelf worker 入口：assets 优先，未命中的 /api/* 由本脚本处理
// MARKET_KV 绑定提供远端价格表（key: price_table）
//
// 契约卫生：
//   - 只接受 GET/HEAD（读接口）；其余方法 405
//   - 错误体用稳定枚举 code，绝不回传异常字符串 / 内部绑定名
//   - 价格表在边缘做一次 schema 校验：match 必须是可编译的正则源码字符串、
//     price 必须是有限非负数；坏数据不回传（宁可 502 让前端回退内置表）
//   - ETag + Cache API：价格表是人工月度级更新、读频率极高，边缘缓存挡掉重复回源

const ERR = {
  method: { code: 'method_not_allowed', message: 'Use GET' },
  not_found: { code: 'not_found', message: 'No such endpoint' },
  unbound: { code: 'backend_unavailable', message: 'Price backend not configured' },
  missing: { code: 'price_table_missing', message: 'Price table not provisioned' },
  invalid: { code: 'price_table_invalid', message: 'Price table failed schema validation' },
  internal: { code: 'internal_error', message: 'Unexpected server error' },
};

function jsonError(err, status) {
  return Response.json(err, { status, headers: { 'cache-control': 'no-store' } });
}

// 内容寻址 ETag：对 JSON 文本做 SHA-256 前 16 hex
async function etagOf(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return '"' + [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('') + '"';
  } catch { return null; }
}

// 价格表结构校验（边缘侧，第一道防线；前端 marketRemote.js 还有第二道清洗）
function isValidTable(t) {
  if (!t || typeof t !== 'object') return false;
  const okRule = (r) =>
    r && typeof r === 'object' &&
    typeof r.match === 'string' && r.match.length > 0 &&
    Number.isFinite(r.price) && r.price >= 0 &&
    safeRegExp(r.match);
  const okList = (a) => Array.isArray(a) && a.length > 0 && a.every(okRule);
  const okFlat = (f) => f && typeof f === 'object' && Number.isFinite(f.price) && f.price >= 0;
  return okList(t.rules) && okList(t.hardware) &&
    okFlat(t.acrylicPerM2) && okFlat(t.zincPerM2) && okFlat(t.posterFlat);
}
function safeRegExp(src) {
  try { new RegExp(src); return true; } catch { return false; }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 静态资产由 assets 绑定优先处理；本脚本只负责 /api/*
    if (url.pathname !== '/api/market') {
      return jsonError(ERR.not_found, 404);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonError(ERR.method, 405);
    }

    // 命中边缘缓存直接返回
    const cache = caches.default;
    const cacheKey = new Request(url.origin + '/api/market', { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let raw;
    try {
      if (!env.MARKET_KV) return jsonError(ERR.unbound, 503);
      raw = await env.MARKET_KV.get('price_table');
    } catch {
      return jsonError(ERR.internal, 500);
    }
    if (!raw) return jsonError(ERR.missing, 404);

    // schema 校验：坏数据不回传，前端会因非 2xx 回退内置表
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return jsonError(ERR.invalid, 502); }
    if (!isValidTable(parsed)) return jsonError(ERR.invalid, 502);

    const etag = await etagOf(raw);
    // 协商缓存：客户端带匹配的 If-None-Match 时 304
    if (etag && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { etag, 'cache-control': 'public, max-age=300' } });
    }

    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    };
    if (etag) headers.etag = etag;
    const res = new Response(raw, { headers });
    // 边缘缓存 5 分钟（与 max-age 对齐）；等待队列写回，不阻塞响应
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
