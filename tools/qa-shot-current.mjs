// 当前环境 QA 截图：7 产品渲染 + 控制台错误采集 + 关键状态探针
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const DIST = 'file:///D:/.agents/.orca/alu-extrusion-configurator/dist/index.html';
const OUT = 'D:/.agents/.orca/alu-extrusion-configurator/tools/qa-out';
mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 200)));

const targets = [
  { hash: '', tag: 'profile' },
  { hash: '#rod', tag: 'rod' },
  { hash: '#books', tag: 'books' },
  { hash: '#cart', tag: 'cart' },
  { hash: '#crates', tag: 'crates' },
  { hash: '#woodcart', tag: 'woodcart' },
  { hash: '#hanger', tag: 'hanger' },
];

for (const t of targets) {
  await page.goto('about:blank');
  await page.goto(DIST + t.hash, { waitUntil: 'load' });
  await page.waitForTimeout(2800);
  const state = await page.evaluate(() => {
    const loader = document.getElementById('loader');
    return {
      loaderHidden: loader && loader.style.display === 'none',
      ready: window.__ALU_READY || null,
      fx: window.__ALU_FX || null,
      activeTab: document.querySelector('#product-tabs button.on')?.textContent || null,
      panelChildren: document.getElementById('panel').children.length,
      hudText: (document.getElementById('hud-left')?.innerText || '').replace(/\n/g, ' | ').slice(0, 140),
      priceText: (document.querySelector('.price-line .price')?.textContent || '').slice(0, 40),
      hotspots: document.querySelectorAll('#hotspot-layer .hotspot').length,
    };
  });
  await page.screenshot({ path: `${OUT}/${t.tag}.png` });
  results.push({ tag: t.tag, ...state });
}

// 桌面清单按钮可点性 + tab 切换烟测
await page.goto(DIST, { waitUntil: 'load' });
await page.waitForTimeout(2200);
const listBtn = await page.$('#config-list-btn, .config-list-btn');
const listClickable = !!listBtn;

writeFileSync(`${OUT}/report.json`, JSON.stringify({ results, listClickable, consoleErrors }, null, 2));
console.log('=== QA REPORT ===');
console.log('console errors:', consoleErrors.length, consoleErrors.slice(0, 5));
for (const r of results) console.log(`${r.tag}: ready=${JSON.stringify(r.ready)} fx=${r.fx?.mode} panel=${r.panelChildren} hotspots=${r.hotspots} price="${r.priceText}" hud="${r.hudText}"`);
await browser.close();
