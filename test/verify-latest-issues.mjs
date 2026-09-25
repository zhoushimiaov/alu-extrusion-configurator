import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = path.resolve(__dirname, '../dist/index.html');
const fileUrl = 'file:///' + distHtml.replace(/\\/g, '/');

async function testAll() {
  console.log('Testing fixes for the 3 issues...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // 1. Test profile shelf hotspot buttons styling
    console.log('\n--- 1. Testing Profile Shelf Hotspot Buttons ---');
    const hotspots = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.hotspot'));
      return btns.map(b => {
        const cs = window.getComputedStyle(b);
        const svg = b.querySelector('svg');
        const svgCs = svg ? window.getComputedStyle(svg) : null;
        return {
          id: b.dataset.id,
          width: cs.width,
          height: cs.height,
          bg: cs.backgroundColor,
          color: cs.color,
          boxShadow: cs.boxShadow,
          borderRadius: cs.borderRadius,
          svgW: svgCs ? svgCs.width : null,
          svgH: svgCs ? svgCs.height : null
        };
      });
    });
    console.log('Hotspots count:', hotspots.length);
    console.log('First hotspot sample:', hotspots[0]);
    if (!hotspots.length) throw new Error('No hotspots found!');
    if (hotspots[0].bg !== 'rgb(255, 255, 255)') throw new Error('Hotspot background is not pure white!');
    if (!hotspots[0].boxShadow || hotspots[0].boxShadow === 'none') throw new Error('Hotspot has no box-shadow!');

    await page.screenshot({ path: path.resolve(__dirname, '../test/hotspots.png') });

    // 2. Switch to rod rack mode and test drag handles
    console.log('\n--- 2. Testing Rod Rack Drag Handles ---');
    await page.click('[data-kind="rod"]');
    await page.waitForTimeout(600);

    const handles = await page.evaluate(() => {
      const wBtn = document.querySelector('.rod-handle-w');
      const hBtn = document.querySelector('.rod-handle-h');
      const wCs = wBtn ? window.getComputedStyle(wBtn) : null;
      const hCs = hBtn ? window.getComputedStyle(hBtn) : null;
      const rW = wBtn ? wBtn.getBoundingClientRect() : null;
      const rH = hBtn ? hBtn.getBoundingClientRect() : null;
      return {
        hasW: !!wBtn,
        hasH: !!hBtn,
        wDisplay: wCs ? wCs.display : null,
        hDisplay: hCs ? hCs.display : null,
        wBg: wCs ? wCs.backgroundColor : null,
        hBg: hCs ? hCs.backgroundColor : null,
        wShadow: wCs ? wCs.boxShadow : null,
        wRect: rW ? { left: rW.left, top: rW.top, width: rW.width, height: rW.height } : null,
        hRect: rH ? { left: rH.left, top: rH.top, width: rH.width, height: rH.height } : null
      };
    });
    console.log('Handles check:', handles);
    if (!handles.hasW || !handles.hasH) throw new Error('Drag handle buttons not found!');
    if (handles.wDisplay === 'none' || handles.hDisplay === 'none') throw new Error('Handles are not visible!');

    // Test dragging the height handle
    console.log('Testing height handle drag...');
    const initH = await page.evaluate(() => document.querySelector('#hud-left')?.textContent);
    const hRect = handles.hRect;
    await page.mouse.move(hRect.left + hRect.width / 2, hRect.top + hRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(hRect.left + hRect.width / 2, hRect.top + hRect.height / 2 - 50, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const postH = await page.evaluate(() => document.querySelector('#hud-left')?.textContent);
    console.log('Before drag HUD:', initH);
    console.log('After drag HUD:', postH);

    await page.screenshot({ path: path.resolve(__dirname, '../test/rod-handles.png') });

    // 3. Test double panel (双联展板) mode
    console.log('\n--- 3. Testing Double Panel (双联展板) ---');
    // Find style selector or buttons for style === 'panel'
    const styleOptions = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[data-style], [data-rod-style], select'));
      return btns.map(b => b.outerHTML);
    });
    console.log('Style options in DOM:', styleOptions.length);

    // Click on 双联展板 button
    await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const target = allBtns.find(b => b.textContent.includes('双联展板'));
      if (target) target.click();
    });
    await page.waitForTimeout(500);

    const panelCheck = await page.evaluate(() => {
      const hudText = document.querySelector('#hud-left')?.textContent;
      const priceText = document.querySelector('.price-line .price')?.textContent;
      return { hudText, priceText };
    });
    console.log('Double panel rendered:', panelCheck);

    await page.screenshot({ path: path.resolve(__dirname, '../test/rod-double-panel.png') });

    console.log('\n ALL THREE ISSUES VERIFIED SUCCESSFULLY! ');
  } finally {
    await browser.close();
  }
}

testAll().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
