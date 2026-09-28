// 第六轮新功能 QA：打印按钮 / X 光 / 支撑点标记 / 板材外伸 / JSON 导出按钮
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const DIST = 'file:///D:/.agents/.orca/alu-extrusion-configurator/dist/index.html';
const OUT = 'D:/.agents/.orca/alu-extrusion-configurator/tools/qa-out';
mkdirSync(OUT, { recursive: true });

const b64url = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const WC_DEFAULT = { width: 0.8, depth: 0.45, height: 2.15, shelves: 2, cabinetH: 0.72, pegboard: true, topRail: true, sideRail: true, casters: true, woodTone: 'birch', ohF: 0, ohB: 0, ohL: 0, ohR: 0, ohLink: true };
const ohCfg = { ...WC_DEFAULT, ohF: 0.1, ohB: 0.1, ohL: 0.1, ohR: 0.1 };

const consoleErrors = [];
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + String(err).slice(0, 200)));

const results = [];

async function shot(hash, tag, extra) {
  await page.goto('about:blank');
  await page.goto(DIST + hash, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  if (extra) await extra();
  const state = await page.evaluate(() => ({
    ready: window.__ALU_READY || null,
    loaderHidden: document.getElementById('loader')?.style.display === 'none',
    printBtns: document.querySelectorAll('[data-print]').length,
    xrayChip: !!document.querySelector('button[aria-label="X 光透视"]'),
    supports: window.__ALU_SUPPORTS ? window.__ALU_SUPPORTS() : 'no-hook',
    hud: (document.getElementById('hud-left')?.innerText || '').replace(/\n/g, ' | ').slice(0, 120),
  }));
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  results.push({ tag, ...state });
  console.log(`${tag}: printBtns=${state.printBtns} xrayChip=${state.xrayChip} supports=${JSON.stringify(state.supports)} ready=${JSON.stringify(state.ready)}`);
}

// 1) 各产品打印按钮 + 支撑点
for (const [hash, tag] of [['', 'f-profile'], ['#rod', 'f-rod'], ['#woodcart', 'f-woodcart'], ['#books', 'f-books'], ['#hanger', 'f-hanger']]) {
  await shot(hash, tag);
}

// 2) X 光：profile + rod（键盘 X）
await shot('', 'f-profile-xray', async () => { await page.keyboard.press('x'); await page.waitForTimeout(500); });
await shot('#rod', 'f-rod-xray', async () => { await page.keyboard.press('x'); await page.waitForTimeout(500); });

// 3) 木展车四向外伸（hash 直达配置 ohF/B/L/R=0.1）→ 联动值 + 顶板外伸可见
await shot('#woodcart?c=' + b64url(ohCfg), 'f-woodcart-overhang');

// 4) JSON 导出按钮（种子一条配置后打开清单抽屉探测——空清单时抽屉无底栏按钮）
await page.goto('about:blank');
await page.goto(DIST, { waitUntil: 'load' });
await page.evaluate(() => {
  localStorage.setItem('modulo_config_list', JSON.stringify([{
    id: 'qa_seed_1', kind: 'woodcart', title: '光轴木展车', summary: 'QA 种子条目',
    priceText: '¥ 1', cfg: { width: 0.8 }, timestamp: Date.now(), url: '',
  }]));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2400);
await page.click('#config-list-btn, .config-list-btn');
await page.waitForTimeout(500);
const jsonBtn = await page.evaluate(() => !!document.getElementById('df-json-btn'));
await page.screenshot({ path: `${OUT}/f-config-drawer.png` });
results.push({ tag: 'f-config-drawer', jsonBtn });
console.log('f-config-drawer: jsonBtn=' + jsonBtn);

writeFileSync(`${OUT}/report-features.json`, JSON.stringify({ results, consoleErrors }, null, 2));
console.log('=== console errors:', consoleErrors.length, consoleErrors.slice(0, 5));
await browser.close();
