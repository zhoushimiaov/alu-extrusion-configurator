// 真机 GPU 最终验收：五产品渲染 + console 错误 + 木展车开关联动 + 截图
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const OUT = 'C:/Users/Administrator/.openclaw-autoclaw/agents/auto-coder/workspace/.openclaw/tmp';
const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 180)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 180)));
const out = { products: [], switches: [] };
const targets = [['', 'profile'], ['#rod', 'rod'], ['#cart', 'cart'], ['#crates', 'crates'], ['#woodcart', 'woodcart']];
for (const [hash, tag] of targets) {
  await page.goto('about:blank');
  await page.goto('file:///F:/Autoclaw/alu_extrusion/dist/index.html' + hash, { waitUntil: 'load' });
  await page.waitForTimeout(2800);
  const s = await page.evaluate(() => ({
    fx: window.__ALU_FX || null,
    loaderHidden: document.getElementById('loader').style.display === 'none',
    stats: window.__ALU_STATS ? window.__ALU_STATS() : null,
    hud: (document.getElementById('hud-left') || {}).innerText ? document.getElementById('hud-left').innerText.replace(/\n/g, ' | ').slice(0, 110) : '',
    panel: document.getElementById('panel').children.length,
  }));
  writeFileSync(`${OUT}/final-${tag}.png`, await page.screenshot());
  out.products.push({ tag, ...s });
}
// 木展车四开关（真机点击）
await page.goto('about:blank');
await page.goto('file:///F:/Autoclaw/alu_extrusion/dist/index.html#woodcart', { waitUntil: 'load' });
await page.waitForTimeout(2600);
for (const key of ['pegboard', 'topRail', 'sideRail', 'casters']) {
  const b = await page.evaluate(() => window.__ALU_STATS());
  await page.click(`#panel .switch[data-sw="${key}"]`);
  await page.waitForTimeout(800);
  const a = await page.evaluate(() => window.__ALU_STATS());
  out.switches.push({ key, before: b, after: a, changed: JSON.stringify(b) !== JSON.stringify(a) });
}
writeFileSync(`${OUT}/final-woodcart-toggled.png`, await page.screenshot());
out.consoleErrors = errors;
writeFileSync(`${OUT}/final-report.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
