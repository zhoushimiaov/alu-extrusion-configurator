// Playwright 真实浏览器全量检查：五产品渲染 + 交互 + 控制台错误采集
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const results = [];
const consoleErrors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
});
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 200)));

const targets = [
  { hash: '', tag: 'profile', probe: '#gl' },
  { hash: '#rod', tag: 'rod', probe: '#gl' },
  { hash: '#cart', tag: 'cart', probe: '#gl' },
  { hash: '#crates', tag: 'crates', probe: '#gl' },
  { hash: '#woodcart', tag: 'woodcart', probe: '#gl' },
];

for (const t of targets) {
  await page.goto('about:blank');
  await page.goto('file:///F:/Autoclaw/alu_extrusion/dist/index.html' + t.hash, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => {
    const loader = document.getElementById('loader');
    const loaderHidden = loader && loader.style.display === 'none';
    const ready = window.__ALU_READY || null;
    const tabs = document.querySelectorAll('#product-tabs button').length;
    const activeTab = document.querySelector('#product-tabs button.on');
    const panelChildren = document.getElementById('panel').children.length;
    const hudText = document.getElementById('hud-left') ? document.getElementById('hud-left').innerText.replace(/\n/g, ' | ') : '';
    const hotspots = document.querySelectorAll('#hotspot-layer .hotspot').length;
    const hotspotVisible = [...document.querySelectorAll('#hotspot-layer .hotspot')].filter(b => b.style.display !== 'none').length;
    return { loaderHidden, ready, tabs, activeTab: activeTab ? activeTab.textContent : null, panelChildren, hudText: hudText.slice(0, 120), hotspots, hotspotVisible };
  });
  const shot = `C:/Users/Administrator/.openclaw-autoclaw/agents/auto-coder/workspace/.openclaw/tmp/pw-${t.tag}.png`;
  await page.screenshot({ path: shot });
  results.push({ tag: t.tag, ...state });
}

// 交互测试：profile 下点 level+ / bay+，验证数字变化
await page.goto('file:///F:/Autoclaw/alu_extrusion/dist/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
const before = await page.evaluate(() => window.__ALU_READY);
await page.click('#hotspot-layer .hotspot[data-id="level+"]');
await page.waitForTimeout(600);
const afterLevel = await page.evaluate(() => document.getElementById('hud-left').innerText.match(/(\d+)\s*层/) || document.getElementById('hud-left').innerText);
await page.click('#hotspot-layer .hotspot[data-id="bay+"]');
await page.waitForTimeout(600);
const hudAfter = await page.evaluate(() => document.getElementById('hud-left').innerText.replace(/\n/g, ' | '));

// tab 切换测试：profile → woodcart → crates
await page.click('#product-tabs button[data-kind="woodcart"]');
await page.waitForTimeout(1500);
const woodState = await page.evaluate(() => ({
  tab: document.querySelector('#product-tabs button.on')?.textContent,
  panel: document.getElementById('panel').children.length,
  ready: !!window.__ALU_READY,
}));
await page.click('#product-tabs button[data-kind="crates"]');
await page.waitForTimeout(1500);
const cratesState = await page.evaluate(() => ({
  tab: document.querySelector('#product-tabs button.on')?.textContent,
  panel: document.getElementById('panel').children.length,
}));

writeFileSync('F:/Autoclaw/alu_extrusion/.openclaw/tmp/pw-report.json', JSON.stringify({ results, interaction: { before, hudAfter, woodState, cratesState }, consoleErrors }, null, 2));
console.log('REPORT WRITTEN');
console.log('console errors:', consoleErrors.length);
for (const r of results) console.log(`${r.tag}: loaderHidden=${r.loaderHidden} ready=${JSON.stringify(r.ready)} panel=${r.panelChildren} hotspots=${r.hotspotVisible}/${r.hotspots}`);
console.log('woodcart tab switch:', JSON.stringify(woodState));
console.log('crates tab switch:', JSON.stringify(cratesState));
await browser.close();
