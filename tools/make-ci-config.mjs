// CI 用：由公开的 wrangler.toml 生成一份带真实标识符的部署配置。
//
// 用法：
//   node tools/make-ci-config.mjs                → 生成 wrangler.ci.toml
//   MARKET_KV_NAMESPACE_ID=xxx node tools/make-ci-config.mjs
//
// 行为：
//   - 设置了 MARKET_KV_NAMESPACE_ID：把占位符替换为真实 id（保留 KV 绑定）
//   - 未设置：整块 [[kv_namespaces]] 剔除，Worker 仍可部署，页面自动回退内置价格表
//   - 生成的 wrangler.ci.toml 已被 .gitignore 忽略，不会回写仓库
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const src = path.join(root, 'wrangler.toml');
const out = path.join(root, 'wrangler.ci.toml');

if (!fs.existsSync(src)) {
  console.error(`[ci-config] 找不到 ${src}`);
  process.exit(1);
}

const PLACEHOLDER = 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID';
const kvId = (process.env.MARKET_KV_NAMESPACE_ID || '').trim();

let toml = fs.readFileSync(src, 'utf8');

if (kvId && kvId !== PLACEHOLDER) {
  toml = toml.split(PLACEHOLDER).join(kvId);
  console.log(`[ci-config] 已注入 KV namespace id（${kvId.slice(0, 8)}…）`);
} else {
  // 剔除 KV 绑定段（含其上方注释），保证无 Secret 时也能部署成功
  const lines = toml.split('\n');
  const kept = [];
  let inKv = false;
  for (const line of lines) {
    if (/^\s*\[\[kv_namespaces\]\]/.test(line)) { inKv = true; continue; }
    if (inKv) {
      // 整个 KV 段内的内容（绑定名、id 等）全部跳过，直到下一个 section 开始
      if (/^\s*\[/.test(line)) inKv = false;
      else continue;
    }
    kept.push(line);
  }
  toml = kept.join('\n');
  console.log('[ci-config] 未提供 MARKET_KV_NAMESPACE_ID：已移除 KV 绑定，页面将回退内置价格表');
}

fs.writeFileSync(out, toml);
const hasKv = /^\s*\[\[kv_namespaces\]\]/m.test(toml);
const hasPlaceholder = toml.includes(PLACEHOLDER);
console.log(`[ci-config] 已生成 ${path.basename(out)}（${toml.length} 字节，KV 绑定：${hasKv ? '有' : '无'}${hasPlaceholder ? '，仍含占位符（异常）' : ''}）`);
console.log('--- 生成结果预览 ---');
console.log(toml.trim());
