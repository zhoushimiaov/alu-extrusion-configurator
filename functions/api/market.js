// Cloudflare Pages Functions：价格表 KV 接口
// KV namespace 绑定 MARKET_KV，key: price_table
// 部署后更新价格：wrangler kv key put --binding=MARKET_KV price_table <json 文件路径>

export async function onRequestGet(context) {
  const { env } = context;
  try {
    if (!env.MARKET_KV) return Response.json({ error: 'MARKET_KV not bound' }, { status: 503 });
    const raw = await env.MARKET_KV.get('price_table');
    if (!raw) return Response.json({ error: 'price_table not set' }, { status: 404 });
    return new Response(raw, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300', // 浏览器 5 分钟缓存，改价后最多延迟 5 分钟生效
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
