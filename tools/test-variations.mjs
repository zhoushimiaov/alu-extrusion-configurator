import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/dist/index.html#hanger';
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(2000);

// 1. 抽屉 0 层
await page.click('button[data-act="t-"]');
await page.waitForTimeout(300);
await page.click('button[data-act="t-"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'tools/test-hanger-drawers-0.png' });

// 2. 抽屉 3 层
await page.click('button[data-act="t+"]');
await page.waitForTimeout(200);
await page.click('button[data-act="t+"]');
await page.waitForTimeout(200);
await page.click('button[data-act="t+"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'tools/test-hanger-drawers-3.png' });

// 3. 黑色 + 地脚
await page.click('button.swatch[data-color="black"]');
await page.waitForTimeout(300);
await page.click('.switch[data-sw="wheels"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'tools/test-hanger-black-feet.png' });

// 4. 爆炸图
const boomBtn = await page.$('.chip-toggle[data-tip="爆炸分解"], button[data-tip="爆炸分解"]');
if (boomBtn) {
  await boomBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tools/test-hanger-exploded.png' });
}

await browser.close();
console.log('All variation tests completed successfully');
