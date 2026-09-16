// 端到端验证模型导出：真机点击「导出 3D 模型」，抓取 .glb 并解析节点/网格数量
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';
const OUT = 'C:/Users/Administrator/.openclaw-autoclaw/agents/auto-coder/workspace/.openclaw/tmp';

function parseGLB(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546C67) return { error: 'not glb' };
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const meshNodes = (json.nodes || []).filter((n) => n.mesh !== undefined).length;
  const instExt = (json.extensionsUsed || []).filter((e) => /instancing/i.test(e));
  return {
    bytes: buf.length,
    nodes: (json.nodes || []).length,
    meshes: (json.meshes || []).length,
    meshNodes,
    materials: (json.materials || []).length,
    extensionsUsed: json.extensionsUsed || [],
    usesGpuInstancing: instExt,
  };
}

const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const out = {};
for (const [hash, tag] of [['', 'profile'], ['#rod', 'rod'], ['#cart', 'cart'], ['#crates', 'crates'], ['#woodcart', 'woodcart']]) {
  await page.goto('about:blank');
  await page.goto('file:///F:/Autoclaw/alu_extrusion/dist/index.html' + hash, { waitUntil: 'load' });
  await page.waitForTimeout(2800);
  const dl = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('#panel button[data-model]'),
  ]).then(([d]) => d);
  const file = `${OUT}/export-${tag}.glb`;
  await dl.saveAs(file);
  out[tag] = { name: dl.suggestedFilename(), ...parseGLB(file) };
}
console.log(JSON.stringify(out, null, 2));
writeFileSync(`${OUT}/export-report.json`, JSON.stringify(out, null, 2));
await browser.close();
