import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/index.html', import.meta.url));

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // Profile shelf
  await page.goto(dist + '#profile');
  await page.waitForFunction(() => window.__ALU_READY !== undefined, null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tools/mobile-profile.png' });
  console.log('Saved tools/mobile-profile.png');

  // Rod rack
  await page.getByRole('button', { name: '切换到光轴展架' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tools/mobile-rod.png' });
  console.log('Saved tools/mobile-rod.png');

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
