// 本地部署配置生成器：由公开的 wrangler.toml + 环境变量生成 wrangler.local.toml。
//
// 目的：消灭「三份配置（wrangler.toml / wrangler.local.toml / wrangler.ci.toml）靠注释互相提醒同步」
//       的漂移面 —— 结构以公开 wrangler.toml 为唯一模板，私密标识符只走环境变量注入。
//
// 用法：
//   CLOUDFLARE_ACCOUNT_ID=xxx MARKET_KV_NAMESPACE_ID=yyy node tools/make-local-config.mjs
//   加 --force 才允许覆盖已存在的 wrangler.local.toml（默认拒绝覆盖，保护现有可用配置）。
//
// 行为：
//   - account_id 行：用 CLOUDFLARE_ACCOUNT_ID 替换公开版的占位注释
//   - KV id：用 MARKET_KV_NAMESPACE_ID 替换占位符 REPLACE_WITH_YOUR_KV_NAMESPACE_ID
//   - 生成的 wrangler.local.toml 已被 .gitignore 忽略，不会回写仓库
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const src = path.join(root, 'wrangler.toml');
const out = path.join(root, 'wrangler.local.toml');

const force = process.argv.includes('--force');
if (fs.existsSync(out) && !force) {
  console.error(`[local-config] ${path.basename(out)} 已存在。为保护现有可用配置，默认不覆盖。`);
  console.error('[local-config] 确需重新生成请加 --force（会丢失手工改动）。');
  process.exit(2);
}
if (!fs.existsSync(src)) {
  console.error(`[local-config] 找不到模板 ${src}`);
  process.exit(1);
}

const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const kvId = (process.env.MARKET_KV_NAMESPACE_ID || '').trim();
const PLACEHOLDER = 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID';

let toml = fs.readFileSync(src, 'utf8');

// 1) account_id：公开版是注释占位，本地版需要真实值
if (accountId) {
  // 在 compatibility_date 行之后插入 account_id（若已存在则替换）
  if (/^account_id\s*=/m.test(toml)) {
    toml = toml.replace(/^account_id\s*=.*$/m, `account_id = "${accountId}"`);
  } else {
    toml = toml.replace(/^(compatibility_date\s*=.*)$/m, `$1\naccount_id = "${accountId}"`);
  }
  console.log(`[local-config] 已注入 account_id（${accountId.slice(0, 4)}…）`);
} else {
  console.warn('[local-config] 未提供 CLOUDFLARE_ACCOUNT_ID：account_id 保持公开版注释（部署时需另行提供）');
}

// 2) KV namespace id
if (kvId && kvId !== PLACEHOLDER) {
  toml = toml.split(PLACEHOLDER).join(kvId);
  console.log(`[local-config] 已注入 KV namespace id（${kvId.slice(0, 8)}…）`);
} else {
  console.warn(`[local-config] 未提供 MARKET_KV_NAMESPACE_ID：KV id 仍为占位符，部署前需回填`);
}

fs.writeFileSync(out, toml, 'utf8');
const hasPlaceholder = toml.includes(PLACEHOLDER);
console.log(`[local-config] 已生成 ${path.basename(out)}（${toml.length} 字节${hasPlaceholder ? '，仍含 KV 占位符' : ''}）`);
