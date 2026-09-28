// 打印报告版式预览：node 侧直接调 buildReportHtml（不触发打印对话框），
// 生成静态 HTML 后用 Playwright 按 A4 视口截图，供人工核版式。
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

globalThis.document = { createElement: (t) => t === 'canvas' ? { width: 0, height: 0, getContext: () => ({ fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, ellipse(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }) } : {} };

const { buildShelf } = await import('../src/core/buildShelf.js');
const { DEFAULT_CONFIG } = await import('../src/config/product.js');
const { buildReportHtml } = await import('../src/ui/printReport.js');
const { registerLabels } = await import('../src/ui/cutlist.js');
const { PROFILE_SERIES, DECK_TYPES, COLORS } = await import('../src/config/product.js');
const { WOOD_TONES } = await import('../src/config/woodcart.js');

registerLabels('product', { PROFILE_SERIES, DECK_TYPES, COLORS });
registerLabels('woodcart', { WOOD_TONES });

const b1 = buildShelf(DEFAULT_CONFIG, false);
// woodcart 材质需真实 canvas 2D（drawImage 画木纹），node 存根不完整 → 用与 build 公式一致的合成数据验证报告版式
const wcCfg = { width: 0.8, depth: 0.45, height: 2.15, shelves: 2, cabinetH: 0.72, pegboard: true, topRail: true, sideRail: true, casters: true, woodTone: 'birch', ohF: 0.1, ohB: 0.1, ohL: 0.1, ohR: 0.1, ohLink: true };
const wcStats = {
  profileLengthM: 9.9, weightKg: 42.1, partCount: 39, envelope: { W: 1.0, H: 2.21, D: 0.65 },
  cutList: [
    { spec: '光轴立柱', section: '16', len: 2.21, qty: 4 },
    { spec: '顶部挂杆', section: '12', len: 0.86, qty: 2 },
    { spec: '柜体顶板（胶合板 12mm）', section: '板', len: 1.02, qty: 1 },
    { spec: '层板 1（胶合板 12mm）', section: '板', len: 0.98, qty: 1 },
  ],
  hardware: [
    { name: '万向轮 1.5 寸（带刹车）', qty: 4 },
    { name: '立柱穿柜法兰', qty: 4 },
    { name: '光轴夹块', qty: 12 },
    { name: '角码', qty: 8 },
  ],
};

const htmlProfile = buildReportHtml({ kind: 'profile', cfg: DEFAULT_CONFIG, stats: b1.stats, snapshot: null });
const htmlWood = buildReportHtml({ kind: 'woodcart', cfg: wcCfg, stats: wcStats, snapshot: null });
writeFileSync('tools/qa-out/report-profile.html', htmlProfile);
writeFileSync('tools/qa-out/report-woodcart.html', htmlWood);
console.log('report html generated:', htmlProfile.length, htmlWood.length, 'chars');

// 首行摘要（验证 woodcart 外伸摘要与下料数据进入报告）
console.log('profile cut rows:', b1.stats.cutList.length, 'hardware rows:', b1.stats.hardware.length);
console.log('woodcart oh summary present:', htmlWood.includes('板材外伸'));

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
for (const name of ['report-profile', 'report-woodcart']) {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } }); // A4 @96dpi
  await page.goto('file:///D:/.agents/.orca/alu-extrusion-configurator/tools/qa-out/' + name + '.html', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `tools/qa-out/${name}-p1.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `tools/qa-out/${name}-p2.png`, fullPage: false });
  await page.close();
}
await browser.close();
console.log('report previews written to tools/qa-out/');
