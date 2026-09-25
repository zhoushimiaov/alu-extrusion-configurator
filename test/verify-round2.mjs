import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = path.resolve(__dirname, '../dist/index.html');
const fileUrl = 'file:///' + distHtml.replace(/\\/g, '/');

async function run() {
  console.log('Testing dist/index.html with Playwright under file://...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  try {
    // 1. Desktop 1440x900
    console.log('\n--- 1. Testing Desktop 1440x900 ---');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // P0 #1: Test .config-list-btn hit testing and clicking
    const btnHit = await page.evaluate(() => {
      const btn = document.querySelector('.config-list-btn');
      if (!btn) return { exists: false };
      const r = btn.getBoundingClientRect();
      const elAtPoint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const isButtonOrChild = btn.contains(elAtPoint) || elAtPoint === btn;
      const pe = window.getComputedStyle(btn).pointerEvents;
      return {
        exists: true,
        pointerEvents: pe,
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        hitTag: elAtPoint ? elAtPoint.tagName : null,
        hitClass: elAtPoint ? elAtPoint.className : null,
        hitSuccess: isButtonOrChild
      };
    });
    console.log('P0 #1 .config-list-btn desktop hit test:', btnHit);
    if (!btnHit.hitSuccess) throw new Error('P0 #1 FAIL: .config-list-btn was intercepted by canvas or other element!');

    // Test clicking .config-list-btn opens drawer
    await page.click('.config-list-btn');
    await page.waitForTimeout(300);
    const drawerOpen = await page.evaluate(() => {
      const drawer = document.querySelector('.config-drawer-root');
      const open = drawer && drawer.classList.contains('open');
      const emptyIcon = drawer?.querySelector('.empty-icon svg');
      const closeBtn = drawer?.querySelector('.drawer-close svg');
      return {
        open,
        hasSvgEmptyIcon: !!emptyIcon,
        hasSvgCloseBtn: !!closeBtn
      };
    });
    console.log('P2 #9 & Drawer open test:', drawerOpen);
    if (!drawerOpen.open) throw new Error('Drawer did not open when clicking .config-list-btn!');
    if (!drawerOpen.hasSvgEmptyIcon) throw new Error('P2 #9 FAIL: Drawer empty icon SVG is missing!');
    if (!drawerOpen.hasSvgCloseBtn) throw new Error('Drawer close button SVG is missing!');

    // Close drawer
    await page.click('.drawer-close');
    await page.waitForTimeout(300);

    // P2 #7: Price line height and nowrap
    const priceLayout = await page.evaluate(() => {
      const p = document.querySelector('.price-line .price');
      const note = document.querySelector('.price-note');
      if (!p) return null;
      const rP = p.getBoundingClientRect();
      const rN = note?.getBoundingClientRect();
      return {
        priceHeight: rP.height,
        priceText: p.textContent.trim(),
        priceWhiteSp: window.getComputedStyle(p).whiteSpace,
        noteWidth: rN?.width,
        noteText: note?.textContent.trim()
      };
    });
    console.log('P2 #7 Price element check:', priceLayout);
    if (priceLayout.priceHeight > 42) throw new Error(`P2 #7 FAIL: Price element wrapped into multiple lines! Height: ${priceLayout.priceHeight}`);

    // P2 #10: Deck summary format (型材层板 ×6)
    const deckSummaryText = await page.evaluate(() => {
      return document.querySelector('[data-deck-summary]')?.textContent?.trim();
    });
    console.log('P2 #10 Deck summary text:', deckSummaryText);
    if (deckSummaryText && !deckSummaryText.includes('×')) {
      console.warn('P2 #10 WARNING: deckSummary did not contain ×:', deckSummaryText);
    }

    // Switch to rod rack to check P1 #3 (Desktop HUD overlap)
    await page.click('[data-kind="rod"]');
    await page.waitForTimeout(500);

    const hudDesktopRod = await page.evaluate(() => {
      const left = document.querySelector('#hud-left');
      const right = document.querySelector('#hud-right');
      const rL = left.getBoundingClientRect();
      const rR = right.getBoundingClientRect();
      const gap = rR.left - rL.right;
      return {
        leftRight: rL.right,
        rightLeft: rR.left,
        gap,
        leftText: left.textContent.trim()
      };
    });
    console.log('P1 #3 Desktop Rod HUD Gap:', hudDesktopRod);
    if (hudDesktopRod.gap < 0) throw new Error(`P1 #3 FAIL: HUD overlap on desktop rod rack! Gap: ${hudDesktopRod.gap}px`);

    await page.close();

    // 2. Narrow Desktop 1100x800
    console.log('\n--- 2. Testing Narrow Desktop 1100x800 (P1 #6) ---');
    const page1100 = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    await page1100.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page1100.waitForTimeout(600);

    const tabsCheck = await page1100.evaluate(() => {
      const brand = document.querySelector('.brand');
      const tabs = document.querySelector('.product-tabs');
      const rB = brand.getBoundingClientRect();
      const rT = tabs.getBoundingClientRect();
      const overlap = !(rT.right < rB.left || rT.left > rB.right || rT.bottom < rB.top || rT.top > rB.bottom);
      return {
        brandRight: rB.right,
        tabsLeft: rT.left,
        gap: rT.left - rB.right,
        overlap
      };
    });
    console.log('P1 #6 Tabs vs Brand at 1100px:', tabsCheck);
    if (tabsCheck.overlap) throw new Error('P1 #6 FAIL: .product-tabs overlapped .brand logo at 1100px!');

    await page1100.close();

    // 3. Mobile 390x844 (iPhone 12/13/14 size)
    console.log('\n--- 3. Testing Mobile 390x844 (P0 #2, P1 #4, P1 #5) ---');
    const page390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page390.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page390.waitForTimeout(600);

    // Profile mode checks
    const mobileProfile = await page390.evaluate(() => {
      const bar = document.querySelector('#hud-right');
      const hudL = document.querySelector('#hud-left');
      const fsBtn = document.querySelector('.btn-mobile-fullscreen');
      const spinBtn = document.querySelector('button[aria-label="自动旋转"]');
      const rBar = bar.getBoundingClientRect();
      const rL = hudL.getBoundingClientRect();
      const rFs = fsBtn.getBoundingClientRect();
      const rSpin = spinBtn.getBoundingClientRect();

      const chips = Array.from(bar.querySelectorAll('.chip, .chip-toggle'))
        .filter(el => window.getComputedStyle(el).display !== 'none');

      return {
        hudGap: rBar.left - rL.right,
        barRight: rBar.right,
        viewportWidth: window.innerWidth,
        spinRight: rSpin.right,
        spinOffscreen: rSpin.right > window.innerWidth,
        visibleChipsCount: chips.length,
        fsBtnTop: rFs.top,
        fsBtnRight: rFs.right,
        fsBtnAtTop: rFs.top < 40
      };
    });
    console.log('Mobile Profile Mode Check:', mobileProfile);
    if (mobileProfile.hudGap < 0) throw new Error(`P1 #4 FAIL: Mobile HUD overlap! Gap: ${mobileProfile.hudGap}px`);
    if (mobileProfile.spinOffscreen) throw new Error(`P0 #2 FAIL: Spin button is offscreen! Right: ${mobileProfile.spinRight} > 390`);
    if (!mobileProfile.fsBtnAtTop) throw new Error(`P1 #5 FAIL: .btn-mobile-fullscreen is not positioned at the top! Top: ${mobileProfile.fsBtnTop}`);

    // Switch to crates rack to test P1 #4 specifically on crates
    await page390.click('[data-kind="crates"]');
    await page390.waitForTimeout(500);

    const mobileCrates = await page390.evaluate(() => {
      const bar = document.querySelector('#hud-right');
      const hudL = document.querySelector('#hud-left');
      const rBar = bar.getBoundingClientRect();
      const rL = hudL.getBoundingClientRect();
      return {
        hudGap: rBar.left - rL.right,
        hudLeftRight: rL.right,
        barLeft: rBar.left,
        leftText: hudL.textContent.trim()
      };
    });
    console.log('P1 #4 Mobile Crates Mode HUD Gap:', mobileCrates);
    if (mobileCrates.hudGap < 0) throw new Error(`P1 #4 FAIL: Mobile Crates HUD overlap! Gap: ${mobileCrates.hudGap}px`);

    // Test fullscreen button click
    await page390.click('.btn-mobile-fullscreen');
    await page390.waitForTimeout(300);
    const fsState = await page390.evaluate(() => {
      const isFs = document.querySelector('#layout')?.classList.contains('mode-fullscreen-model');
      const btnText = document.querySelector('.btn-mobile-fullscreen .btn-text')?.textContent?.trim();
      return { isFs, btnText };
    });
    console.log('Mobile Fullscreen Mode Toggle:', fsState);
    if (!fsState.isFs) throw new Error('Mobile fullscreen class not applied!');

    // Toggle back
    await page390.click('.btn-mobile-fullscreen');
    await page390.waitForTimeout(300);

    await page390.close();

    console.log('\n ALL AUDIT TESTS PASSED SUCCESSFULLY! ');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('\n Test Failure:', err);
  process.exit(1);
});
