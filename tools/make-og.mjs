// OG 分享图生成 → public/og-cover.jpg（2400×1260）
//
// 默认模式（静态主视觉）：直接用 assets_src/og-hero.png（用户提供的产品图）作右侧主视觉，
//   左侧品牌文字区，硬分区零重叠、无遮罩渐变：
//   node tools/make-og.mjs [--src <图片路径>] [--out <路径>]
// 3D 渲染模式（备用）：从 dist 场景按 SHOTS 机位截图合成：
//   node tools/make-og.mjs --render3d [--shot iso|isoLow] [--preview]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = pathToFileURL(path.join(ROOT, 'dist/index.html')).href;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREVIEW = args.includes('--preview');
const OUT_DIR = path.join(ROOT, 'tools/qa-out');
mkdirSync(OUT_DIR, { recursive: true });

const enc = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// 主视觉：6 跨 × 6 层 2040 型材架 + 镀锌背板 + 摆件（品牌旗舰配置；缩略图尺度下素面镀锌比锌花更干净）
const HERO_CFG = {
  schemaVersion: 2, bays: 6, levels: 6, series: '2040', frameMode: 'glb',
  decks: Array(6).fill('rib'), backs: Array(6).fill('panel'), bayWidths: Array(6).fill(0.57),
  sidePanels: true, panelColor: 'galv', props: true, color: 'silver',
};

// 机位：pos / tgt 世界坐标（米），fov 度。架体约 3.42 × 2.79 × 0.40，中心 x=0。
// 轴测主视觉：等测方向（方位 45°、仰角 35.26°）+ 5° 窄视角远机位（slant ≈32m）
// → 竖线平行、无两点透视收敛（近轴测）。noClamp 突破 controls.maxDistance=14 的钳制。
// 目标点放在架体左侧 → 架体落在画面右半，左侧整块留给品牌文字（不重叠）。
const SHOTS = {
  // 等测 iso：经典 35.26° 仰角，三轴等缩短。轴线对准模型投影包围盒中心（而非世界中心），
  // 近角/远角对称留边 → fov 6.2 / slant 33.5m 即可整架入画，近角放大仅 +9%
  iso: { cfg: HERO_CFG, pos: [19.78, 20.48, 19.33], tgt: [0.45, 1.15, 0.0], fov: 6.7, text: 'left' },
  // 低角度轴测：仰角 27°，产品照气质更强，顶面少露一些
  isoLow: { cfg: HERO_CFG, pos: [23.3, 17.64, 22.93], tgt: [0.45, 1.15, 0.0], fov: 6.7, text: 'left' },
};

const HIDE_UI_CSS = `
  body > :not(#app) { display: none !important; }
  #panel { display: none !important; }
  #layout { display: block !important; }
  #viewport { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; }
  #viewport > :not(#gl) { display: none !important; }
  .driver-popover, .driver-overlay { display: none !important; }
`;

async function renderHero(page, shot) {
  await page.goto('about:blank');
  await page.goto(`${DIST}#?c=${enc(shot.cfg)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ALU_READY, null, { timeout: 60000 });
  await page.addStyleTag({ content: HIDE_UI_CSS });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.waitForTimeout(2400); // 入场飞行 1.6s 结束
  await page.evaluate(({ pos, tgt, fov }) => window.__ALU_VIEW(pos, tgt, fov, { noClamp: true }), shot);
  await page.waitForTimeout(1500);
  // 软件渲染（swiftshader）下 2400×1260 + MSAA 单帧较慢：截图超时放宽
  return page.locator('#gl').screenshot({ type: 'png', timeout: 240000 });
}

function composeHtml(heroPng, shot) {
  const fontsCss = readFileSync(path.join(ROOT, 'src/fonts.css'), 'utf8');
  const left = shot.text !== 'right';
  // 静态主视觉：成品图整幅贴右（1024×976 → 661×630，无裁切），左侧文字硬分区；
  // 无任何遮罩盖图，仅图左缘 16px 与底色融合，避免生硬接缝
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontsCss}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; font-family: Montserrat, "Microsoft YaHei", "PingFang SC", sans-serif; }
.stage { position: relative; width: 1200px; height: 630px; background: #f4f5f7; overflow: hidden; }
.hero { position: absolute; top: 0; ${left ? 'right: 0' : 'left: 0'}; height: 630px; width: 661px; object-fit: cover; }
.blend { position: absolute; top: 0; bottom: 0; ${left ? 'right: 661px' : 'left: 661px'}; width: 16px; background: linear-gradient(${left ? '90deg' : '270deg'}, #f4f5f7 0%, rgba(244,245,247,0) 100%); }
.copy { position: absolute; top: 0; bottom: 0; ${left ? 'left: 64px' : 'right: 64px'}; width: 440px; display: flex; flex-direction: column; justify-content: center; color: #16181b; }
.brand { font-weight: 600; font-size: 54px; letter-spacing: .34em; line-height: 1; }
.brand-cn { margin-top: 14px; font-size: 18px; letter-spacing: .5em; color: #5d636b; font-weight: 500; }
.rule { width: 56px; height: 3px; background: #7b8f5a; margin: 30px 0 26px; border-radius: 2px; }
.title { font-size: 34px; font-weight: 700; line-height: 1.32; letter-spacing: .04em; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
.sub { margin-top: 16px; font-size: 16.5px; line-height: 1.7; color: #4a5058; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
.chips { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font-size: 13px; padding: 6px 13px; border-radius: 999px; background: rgba(22,24,27,.06); color: #2c3036; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
.url { position: absolute; ${left ? 'left: 64px' : 'right: 64px'}; bottom: 40px; font-size: 14px; letter-spacing: .18em; color: #6b727a; }
</style></head><body><div class="stage">
<img class="hero" src="data:image/png;base64,${heroPng.toString('base64')}" alt="">
<div class="blend"></div>
<div class="copy">
  <div class="brand">MODULO</div>
  <div class="brand-cn">模 数</div>
  <div class="rule"></div>
  <div class="title">模数化拼装家具<br>实时 3D 配置器</div>
  <div class="sub">逐层逐跨自由规划，算料、报价、安装说明随配置实时生成；一键导出算料单与 3D 模型。</div>
  <div class="chips"><span class="chip">铝型材置物架</span><span class="chip">光轴展架</span><span class="chip">光轴书架</span><span class="chip">移动边几</span><span class="chip">周转箱架</span><span class="chip">木展车</span><span class="chip">挂衣架</span></div>
</div>
<div class="url">RACK.MEANS.GROUP</div>
</div></body></html>`;
}

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem('modulo.tour.v1', '1'); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

const SRC = opt('--src', path.join(ROOT, 'assets_src/og-hero.png'));
const RENDER3D = args.includes('--render3d');

if (!RENDER3D) {
  // 静态主视觉模式（默认）：用户提供的成品图直接合成，无遮罩、零重叠
  const heroPng = readFileSync(SRC);
  const html = composeHtml(heroPng, { text: 'left' });
  const tmp = path.join(OUT_DIR, 'og-compose-hero.html');
  writeFileSync(tmp, html, 'utf8');
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.resolve(opt('--out', path.join(ROOT, 'public/og-cover.jpg')));
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  console.log(`static hero (${path.basename(SRC)}) → ${path.relative(ROOT, out)}`);
} else {
  const names = PREVIEW ? Object.keys(SHOTS) : [opt('--shot', 'iso')];
  for (const name of names) {
    const shot = SHOTS[name];
    if (!shot) throw new Error(`未知机位 ${name}（可选：${Object.keys(SHOTS).join(' / ')}）`);
    const hero = await renderHero(page, shot);
    const html = composeHtml(hero, shot);
    const tmp = path.join(OUT_DIR, `og-compose-${name}.html`);
    writeFileSync(tmp, html, 'utf8');
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const out = PREVIEW ? path.join(OUT_DIR, `og-${name}.jpg`) : path.resolve(opt('--out', path.join(ROOT, 'public/og-cover.jpg')));
    await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log(`${name} → ${path.relative(ROOT, out)}`);
  }
}
if (errors.length) console.log('page errors:', errors);
await browser.close();
