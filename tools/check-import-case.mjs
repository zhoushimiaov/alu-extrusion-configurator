// 导入路径大小写检查（CI 用）
//
// 为什么需要：Windows / macOS 的文件系统不区分大小写，相对导入写成大小写不符的形式
// 在本地能正常跑，一上 Linux CI 就报 ERR_MODULE_NOT_FOUND。本脚本按字节比较目录项，
// 能提前抓出这类问题。
//
// 用法：node tools/check-import-case.mjs
//   无问题 → 退出码 0；有问题 → 逐条打印，退出码 1
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const exts = new Set(['.js', '.mjs', '.cjs', '.css']);
const skipDirs = new Set(['node_modules', '.git', 'dist', '.openclaw', '.crush', '.wrangler', 'test-results', 'backups']);

function collectFiles(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (skipDirs.has(e.name) || /^backup-/.test(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(full, acc);
    else if (exts.has(path.extname(e.name))) acc.push(full);
  }
  return acc;
}

// 去掉注释与字符串里的干扰（只保留代码行做粗筛）
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');
}

function resolveExactCase(absPath) {
  const parts = absPath.split(path.sep);
  let cur = parts[0] + path.sep;
  for (let i = 1; i < parts.length; i++) {
    const want = parts[i];
    let entries;
    try { entries = fs.readdirSync(cur); } catch { return { ok: false, reason: '目录不可读: ' + cur }; }
    if (!entries.includes(want)) {
      const ci = entries.find((n) => n.toLowerCase() === want.toLowerCase());
      return { ok: false, reason: ci ? `大小写不符（磁盘上是 "${ci}"）` : `不存在 "${want}"` };
    }
    cur = path.join(cur, want);
  }
  return { ok: true };
}

const files = [...new Set(collectFiles(root))];
const importRe = /(?:from\s+|import\s*\(\s*|^\s*import\s+)['"](\.[^'"]+)['"]/gm;
const problems = [];
let checked = 0;

for (const file of files) {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const spec = m[1];
    const base = path.resolve(path.dirname(file), spec);
    checked++;
    const candidates = [base, base + '.js', base + '.mjs', base + '.cjs', base + '.css', path.join(base, 'index.js')];
    const hit = candidates.find((c) => fs.existsSync(c) || fs.existsSync(path.dirname(c)));
    if (!hit) { problems.push({ file: path.relative(root, file), spec, detail: '解析不到目标' }); continue; }
    const r = resolveExactCase(hit);
    if (!r.ok) problems.push({ file: path.relative(root, file), spec, detail: r.reason });
  }
}

console.log(`检查 ${checked} 条相对导入，覆盖 ${files.length} 个文件`);
if (problems.length === 0) {
  console.log('✓ 未发现大小写不匹配的导入路径');
  process.exit(0);
}
console.log(`✗ 发现 ${problems.length} 处问题：`);
for (const p of problems) console.log(`  ${p.file}  →  ${p.spec}    ${p.detail}`);
process.exit(1);
