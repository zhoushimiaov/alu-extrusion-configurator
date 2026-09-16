// modulo-alu-shelf worker 入口：assets 优先，未命中的 /api/* 由本脚本处理
// MARKET_KV 绑定提供远端价格表（key: price_table）
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/market') {
      try {
        if (!env.MARKET_KV) {
          return Response.json({ error: 'MARKET_KV not bound' }, { status: 503 });
        }
        const raw = await env.MARKET_KV.get('price_table');
        if (!raw) {
          return Response.json({ error: 'price_table not set' }, { status: 404 });
        }
        return new Response(raw, {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        });
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
      }
    }
    return new Response('Not found', { status: 404 });
  },
};
