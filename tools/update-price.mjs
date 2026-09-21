// 改价一键脚本：重新导出 price_table.json → 写入 KV → 主动 purge 边缘缓存 → 验证线上已生效。
// 替代手工两步（wrangler kv key put + 等 5 分钟缓存过期）。
//
// 用法：
//   node tools/update-price.mjs                          # 用默认 wrangler.toml 写 KV
//   node tools/update-price.mjs --config wrangler.local.toml
//   node tools/update-price.mjs --config wrangler.local.toml --token <PURGE_TOKEN>
//   PURGE_TOKEN=xxx node tools/update-price.mjs          # token 也可走环境变量
//
// 说明：--token 未提供时跳过 purge，仅提示「约 5 分钟内生效」。
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const config = argVal('--config') || 'wrangler.toml';
const token = argVal('--token') || process.env.PURGE_TOKEN || '';
const BASE = process.env.RACK_BASE || 'https://rack.means.group';

console.log('[price] 1/3 重新导出 tools/price_table.json …');
execSync('node tools/export-price.mjs', { stdio: 'inherit' });

console.log(`[price] 2/3 写入 KV（--config ${config}）…`);
try {
  execSync(
    `npx wrangler kv key put --config ${config} --binding=MARKET_KV price_table --path tools/price_table.json --remote`,
    { stdio: 'inherit' },
  );
} catch (e) {
  console.error('[price] KV 写入失败。本机网络访问 CF API 需要代理：');
  console.error("  $env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'");
  console.error('（见 TOOLS.md「网络环境事实」）');
  process.exit(1);
}

const table = JSON.parse(readFileSync('tools/price_table.json', 'utf8'));

if (!token) {
  console.log('[price] 3/3 未提供 --token，跳过缓存 purge（约 5 分钟内全网生效）');
} else {
  console.log('[price] 3/3 主动 purge 边缘缓存 …');
  const res = await fetch(`${BASE}/api/market/purge`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[price] purge 失败：HTTP ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }
  console.log(`[price] purge OK（${body.code}），重新拉取验证 …`);
  const check = await fetch(`${BASE}/api/market`, { cache: 'no-store' });
  const remote = await check.json();
  if (remote.updated === table.updated && JSON.stringify(remote.rules) === JSON.stringify(table.rules)) {
    console.log(`[price] ✅ 线上已生效：updated=${remote.updated}，rules ${remote.rules.length} 条一致`);
  } else {
    console.warn('[price] ⚠️ 线上内容与本地表不一致（可能命中了反代层缓存），请稍后人工复核：', `${BASE}/api/market`);
  }
}