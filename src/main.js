// 入口:场景 → 双产品(型材架 / 光轴展架)参数化装配 → UI 接线 → 渲染循环
import * as THREE from 'three';
import './fonts.css';
import './styles.css';
import { createScene } from './core/scene.js';
import { createPostFX } from './core/postfx.js';
import { buildShelf } from './core/buildShelf.js';
import { buildGlbFrame, computeGlbStats } from './core/buildGlbFrame.js';
import { retreatShelfBackPanels } from './core/shelfBackPanel.js';
import './core/backPanelFinishes.js';
import { declutterProps } from './core/propsDeclutter.js';
import { decoratePanel } from './ui/panelDecor.js';
import { initConfigList, addConfigItem } from './ui/configList.js';
import { buildRodRack } from './core/buildRodRack.js';
import { createAnims } from './core/anims.js';
import { createDimensions } from './core/dimensions.js';
import { createHotspots } from './core/hotspots.js';
import { createRodHandles } from './core/rodHandles.js';
import { createSupportMarkers } from './core/supportMarkers.js';
import { createGroundContact } from './core/groundContact.js';
import { store, fmtPrice, calcPrice, setInstallSteps } from './ui/store.js';
import { createPanel } from './ui/panel.js';
import { createRodPanel, rodStore, calcRodPrice } from './ui/rodPanel.js';
import { createCartPanel, cartStore, calcCartPrice } from './ui/cartPanel.js';
import { createWoodCartPanel, woodcartStore, calcWoodCartPrice } from './ui/woodCartPanel.js';
import { createHangerPanel, hangerStore, calcHangerPrice } from './ui/hangerPanel.js';
import { createBookshelfPanel, bookshelfStore, calcBookshelfPrice } from './ui/bookshelfPanel.js';
import { buildWoodCart } from './core/buildWoodCart.js';
import { buildHanger } from './core/buildHanger.js';
import { buildBookshelf } from './core/buildBookshelf.js';
import { createCratesPanel, cratesStore, calcCratesPrice } from './ui/cratesPanel.js';
import { buildCratesRack } from './core/buildCratesRack.js';
import { buildCartTable } from './core/buildCartTable.js';
import { createHud } from './ui/hud.js';
import { installSpecCountUp } from './ui/specCountUp.js';
import { maybeStartTour } from './ui/tour.js';
import { downloadCutlist } from './ui/cutlist.js';
import { registerLabels } from './ui/cutlist.js';
import { printCurrentReport } from './ui/printReport.js';
import { downloadModel } from './ui/modelExport.js';
import { onMarketRefresh } from './ui/marketPrice.js';
import { loadSaved, persist } from './ui/persist.js';
import { INSTALL_STEPS } from './config/product.js';
import { INSTALL_STEPS_ROD, BACK_TYPES, SHELF_TYPES, ROD_COLORS } from './config/rodrack.js';
import { INSTALL_STEPS_CART, ACRYLIC_TYPES, WOOD_FINISHES } from './config/cart.js';
import { INSTALL_STEPS_WOODCART, WOOD_TONES } from './config/woodcart.js';
import { INSTALL_STEPS_CRATES, CRATE_SCHEMES } from './config/crates.js';
import { INSTALL_STEPS_HANGER, HANGER_COLORS, HANGER_STYLES, ATELIER_TONES, ATELIER_MODULES } from './config/hanger.js';
import { INSTALL_STEPS_BOOKSHELF, PANEL_MATERIALS, BOOK_STYLES } from './config/bookshelf.js';
import { PROFILE_SERIES, DECK_TYPES, COLORS } from './config/product.js';

// 算料单标签文案注入（显式注册 API，替代旧的 window.__ALU_LABELS 全局注入）
registerLabels('rodrack', { BACK_TYPES, SHELF_TYPES, ROD_COLORS });
registerLabels('product', { PROFILE_SERIES, DECK_TYPES, COLORS });
registerLabels('cart', { ACRYLIC_TYPES, WOOD_FINISHES });
registerLabels('woodcart', { WOOD_TONES });
registerLabels('crates', { CRATE_SCHEMES });
registerLabels('hanger', { HANGER_COLORS, HANGER_STYLES, ATELIER_TONES, ATELIER_MODULES });
registerLabels('books', { PANEL_MATERIALS, BOOK_STYLES });

const canvas = document.getElementById('gl');
const dimSvg = document.getElementById('dim-layer');
const hotspotLayer = document.getElementById('hotspot-layer');
const hudLeft = document.getElementById('hud-left');
const hudRight = document.getElementById('hud-right');
const panelRoot = document.getElementById('panel');
const loader = document.getElementById('loader');
installSpecCountUp(panelRoot); // 规格数字 count-up（显示层，不触碰 updateStats 写入）
const toast = document.getElementById('toast');

let renderer, scene, camera, controls, fitShadow, postfx;
let webglFailed = false;
try {
  ({ renderer, scene, camera, controls, fitShadow } = createScene(canvas));
  postfx = createPostFX(renderer, scene, camera);
} catch (err) {
  webglFailed = true;
  loader.textContent = '当前环境不支持 WebGL,无法渲染 3D 预览。请使用桌面浏览器打开本页面。';
  console.error('[ALU] WebGL init failed:', err);
}
const anims = webglFailed ? null : createAnims(camera, controls);
const dims = webglFailed ? null : createDimensions(dimSvg, camera, renderer);
const hotspots = webglFailed ? null : createHotspots(hotspotLayer, camera, renderer, store, () => active()?.bounds || { W: 3.4, H: 2.3, D: 0.4 });
hotspotLayer?.addEventListener('touchstart', (e) => {
  const btn = e.target.closest('.hotspot');
  if (btn) {
    btn.classList.add('show-tip');
    setTimeout(() => btn.classList.remove('show-tip'), 1800);
  }
}, { passive: true });
// 光轴展架视口内拖拽箭头（宽 / 高两个方向）
const rodHandles = webglFailed ? null : createRodHandles(canvas, camera, renderer, controls, rodStore, () => (rodCurrent?.bounds) || { W: 1.0, H: 1.4, D: 0.42 });
// 支撑点橙色标记层（配件可视化）：数据来自各 build 的 stats.supports，型材架无支撑件选项自然为空。
// 默认关闭（HUD「支撑点标记」开关按需显示），避免橙色标记常驻抢画面；?supports=1 直达开启（QA）
const supportMarkers = webglFailed ? null : createSupportMarkers();
let supportsOn = /[?&]supports=1/.test(location.search);
if (supportMarkers) { scene.add(supportMarkers.group); supportMarkers.setVisible(supportsOn); }

// 接地接触贴片：预览特性（?ground=1），默认关闭，审美方向待用户确认后决定是否常开
const GROUND_PREVIEW = /[?&]ground=1/.test(location.search);
const groundContact = (webglFailed || !GROUND_PREVIEW) ? null : createGroundContact();
if (groundContact) scene.add(groundContact.group);
let productKind = /^#rod/.test(location.hash) ? 'rod' : /^#cart/.test(location.hash) ? 'cart' : /^#crates/.test(location.hash) ? 'crates' : /^#woodcart/.test(location.hash) ? 'woodcart' : /^#hanger/.test(location.hash) ? 'hanger' : /^#books/.test(location.hash) ? 'books' : 'profile';

// ---- 配置恢复：分享链接（hash ?c=）优先，其次 localStorage ----
// 白名单已由 persist.pickPersisted 按产品 schema 统一过滤，这里只做注入。
// 与 PRODUCT_SUBS 共用注册表定义，新增产品只需登记一次（恢复 + 订阅 + persist 自动接线）。
const PRODUCT_STORES = {
  profile: store, rod: rodStore, cart: cartStore,
  crates: cratesStore, woodcart: woodcartStore, hanger: hangerStore,
  books: bookshelfStore,
};
for (const [kind, s] of Object.entries(PRODUCT_STORES)) {
  const saved = loadSaved(kind);
  if (saved && Object.keys(saved).length) {
    if (kind === 'profile' && saved.frameMode === 'standard') {
      saved.frameMode = 'glb';
    }
    s.set(saved);
  }
}

let current = null;      // 型材架
function syncPriceNote() {
  const note = panelRoot.querySelector('.price-note');
  if (note) {
    // 未计价状态已由价格区「另有 N 项待询价」胶囊承载，这里只保留身份文案
    note.textContent = store.get().frameMode === 'glb' ? '参考估价' : '示例材料估价';
  }
}
let rodCurrent = null;   // 光轴展架
let cartCurrent = null;  // 移动边几
let cratesCurrent = null; // 周转箱收纳架
let woodCartCurrent = null; // 光轴木展车
let hangerCurrent = null;   // 光轴挂衣架
let booksCurrent = null;    // 光轴书架
let panel = null;
const center = new THREE.Vector3(0, 0, 0);
const active = () => (productKind === 'rod' ? rodCurrent : productKind === 'cart' ? cartCurrent : productKind === 'crates' ? cratesCurrent : productKind === 'woodcart' ? woodCartCurrent : productKind === 'hanger' ? hangerCurrent : productKind === 'books' ? booksCurrent : current);

// 场景处理：阴影已全局关闭，此处仅按产品包围盒调整主光位置
function stageProduct(p) {
  if (!p || !p.group) return;
  if (p.bounds) fitShadow(p.bounds);
  if (groundContact) groundContact.sync(p.stats?.envelope || p.bounds);
  if (supportMarkers) supportMarkers.setPoints(p.stats?.supports?.points || []);
  if (xrayOn) applyXrayTo(p.group, true);
}


function rebuild({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'profile') return;
  const t0 = performance.now();
  const cfg = store.get();
  if (current) { scene.remove(current.group); current.dispose(); }
  current = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, cfg.props);
  if (current.groups?.pads && !current.group.children.includes(current.groups.pads)) {
    current.group.add(current.groups.pads);
  }
  retreatShelfBackPanels(current);
  declutterProps(current);
  scene.add(current.group);
  stageProduct(current);
  if (!anims.REDUCED && isEntrance) anims.reveal(current.groups);
  if (anims.exploded && current?.groups) anims.explode(current.groups, true);
  dimObstacleDirty = true; // 读数卡文字变化 → 浮层几何可能变化
  hud.syncReadout(cfg, current.stats);
  panel.updateStats(current.stats);
  panel.lastStats = current.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild profile: ${cost.toFixed(1)}ms`);
}

function rebuildRod({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'rod') return;
  const t0 = performance.now();
  const cfg = rodStore.get();
  if (rodCurrent) { scene.remove(rodCurrent.group); rodCurrent.dispose(); }
  rodCurrent = buildRodRack(cfg);
  scene.add(rodCurrent.group);
  stageProduct(rodCurrent);
  if (!anims.REDUCED && isEntrance) anims.revealGroups(rodCurrent.group.children);
  if (anims.exploded && rodCurrent?.groups) anims.explode(rodCurrent.groups, true);
  dimObstacleDirty = true;
  rodHandles.sync();
  hudRod.syncReadout(cfg, rodCurrent.stats);
  panel.updateStats(rodCurrent.stats);
  panel.lastStats = rodCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild rod: ${cost.toFixed(1)}ms`);
}

function rebuildCart({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'cart') return;
  const t0 = performance.now();
  const cfg = cartStore.get();
  if (cartCurrent) { scene.remove(cartCurrent.group); cartCurrent.dispose(); }
  cartCurrent = buildCartTable(cfg);
  scene.add(cartCurrent.group);
  stageProduct(cartCurrent);
  if (!anims.REDUCED && isEntrance) anims.revealGroups(cartCurrent.group.children);
  if (anims.exploded && cartCurrent?.groups) anims.explode(cartCurrent.groups, true);
  hud.syncReadout(cfg, cartCurrent.stats);
  panel.updateStats(cartCurrent.stats);
  panel.lastStats = cartCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild cart: ${cost.toFixed(1)}ms`);
}

function rebuildCrates({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'crates') return;
  const t0 = performance.now();
  const cfg = cratesStore.get();
  if (cratesCurrent) { scene.remove(cratesCurrent.group); cratesCurrent.dispose(); }
  cratesCurrent = buildCratesRack(cfg);
  scene.add(cratesCurrent.group);
  stageProduct(cratesCurrent);
  if (!anims.REDUCED && isEntrance) anims.revealGroups(cratesCurrent.group.children);
  if (anims.exploded && cratesCurrent?.groups) anims.explode(cratesCurrent.groups, true);
  hud.syncReadout(cfg, cratesCurrent.stats);
  panel.updateStats(cratesCurrent.stats);
  panel.lastStats = cratesCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild crates: ${cost.toFixed(1)}ms`);
}

function rebuildBooks({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'books') return;
  const t0 = performance.now();
  const cfg = bookshelfStore.get();
  if (booksCurrent) { scene.remove(booksCurrent.group); booksCurrent.dispose(); }
  booksCurrent = buildBookshelf(cfg);
  scene.add(booksCurrent.group);
  stageProduct(booksCurrent);
  if (!anims.REDUCED && isEntrance) anims.revealGroups(booksCurrent.group.children);
  if (anims.exploded && booksCurrent?.groups) anims.explode(booksCurrent.groups, true);
  hud.syncReadout(cfg, booksCurrent.stats);
  panel.updateStats(booksCurrent.stats);
  panel.lastStats = booksCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild books: ${cost.toFixed(1)}ms`);
}

function rebuildWoodCart({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'woodcart') return;
  const t0 = performance.now();
  const cfg = woodcartStore.get();
  if (woodCartCurrent) { scene.remove(woodCartCurrent.group); woodCartCurrent.dispose(); }
  woodCartCurrent = buildWoodCart(cfg);
  scene.add(woodCartCurrent.group);
  stageProduct(woodCartCurrent);
  if (!anims.REDUCED && isEntrance) anims.revealGroups(woodCartCurrent.group.children);
  if (anims.exploded && woodCartCurrent?.groups) anims.explode(woodCartCurrent.groups, true);
  hud.syncReadout(cfg, woodCartCurrent.stats);
  panel.updateStats(woodCartCurrent.stats);
  panel.lastStats = woodCartCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild woodcart: ${cost.toFixed(1)}ms`);
}

function rebuildHanger({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'hanger') return;
  const t0 = performance.now();
  const cfg = hangerStore.get();
  if (hangerCurrent) { scene.remove(hangerCurrent.group); hangerCurrent.dispose(); }
  hangerCurrent = buildHanger(cfg);
  scene.add(hangerCurrent.group);
  stageProduct(hangerCurrent);
  if (!anims.REDUCED && isEntrance) anims.revealGroups(hangerCurrent.group.children);
  if (anims.exploded && hangerCurrent?.groups) anims.explode(hangerCurrent.groups, true);
  hud.syncReadout(cfg, hangerCurrent.stats);
  panel.updateStats(hangerCurrent.stats);
  panel.lastStats = hangerCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild hanger: ${cost.toFixed(1)}ms`);
}

// 标注避让：W/H/D 标签压到读数卡/控件条/tabs 等浮层上时整组抬离（dims.js 原封，避让在接线层做）。
// 每帧先复位 transform 再测相交，避免「上移后不相交→复位→又相交」的抖动闭环。
const DIM_AVOID_SELECTORS = ['#hud-left', '#hud-right', '#view-tools', '.product-tabs', '#btn-mobile-fullscreen', '#config-list-btn'];
// obstacle 矩形缓存：每帧 6 次 getBoundingClientRect 是强制回流的源头；
// 浮层只在 resize / 产品切换 / 配置变化时改变几何——500ms 节流刷新 + resize 失效。
let dimObstacles = null;
let dimObstacleStamp = 0;
let dimObstacleDirty = true;
addEventListener('resize', () => { dimObstacleDirty = true; }, { passive: true });
function nudgeDimLabels() {
  if (!dimSvg) return;
  // 读写分离：先批量读（obstacle 走缓存，label 一次性收集），再统一写 transform，
  // 消除「写 transform → 读 rect → 再写」逐标签交替引发的每帧强制回流
  const now = performance.now();
  if (dimObstacleDirty || !dimObstacles || now - dimObstacleStamp > 500) {
    dimObstacles = [];
    for (const sel of DIM_AVOID_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) dimObstacles.push(r);
    }
    dimObstacleStamp = now;
    dimObstacleDirty = false;
  }
  const labels = [];
  for (const t of dimSvg.querySelectorAll('.dim-label')) {
    const r = t.getBoundingClientRect();
    const bg = t.previousElementSibling;
    labels.push({ t, bg, r });
  }
  for (const { t, bg, r } of labels) {
    t.removeAttribute('transform');
    if (bg && bg.tagName === 'rect') bg.removeAttribute('transform');
    const hit = dimObstacles.find((o) => r.left < o.right - 2 && r.right > o.left + 2 && r.top < o.bottom && r.bottom > o.top);
    if (hit) {
      const dy = -(r.bottom - hit.top + 6);
      t.setAttribute('transform', 'translate(0 ' + dy + ')');
      if (bg && bg.tagName === 'rect') bg.setAttribute('transform', 'translate(0 ' + dy + ')');
    }
  }
}

function syncWoodCartStatsOnly() {
  const cfg = woodcartStore.get();
  const b = buildWoodCart(cfg);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

function syncBooksStatsOnly() {
  const cfg = bookshelfStore.get();
  const b = buildBookshelf(cfg);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

function syncHangerStatsOnly() {
  const cfg = hangerStore.get();
  const b = buildHanger(cfg);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

function syncStatsOnly() {
  const cfg = store.get();
  let stats;
  if (cfg.frameMode === 'glb') {
    stats = computeGlbStats(cfg);
  } else {
    const b = buildShelf(cfg, false);
    stats = b.stats;
    b.dispose();
  }
  hud.syncReadout(cfg, stats);
  panel.updateStats(stats);
  panel.lastStats = stats;
}

function syncRodStatsOnly() {
  const cfg = rodStore.get();
  const b = buildRodRack(cfg);
  hudRod.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

function syncCartStatsOnly() {
  const cfg = cartStore.get();
  const b = buildCartTable(cfg);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

function syncCratesStatsOnly() {
  const cfg = cratesStore.get();
  const b = buildCratesRack(cfg);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

// 爆炸态附属层：尺寸线 / ± 热点 / 光轴手柄都锚在装配态，爆炸时一并隐藏、复位时恢复
let explodeAuxHidden = false;
function applyExplodeAux(hidden) {
  explodeAuxHidden = hidden;
  if (rodHandles) rodHandles.setVisible(!hidden);
  if (supportMarkers) supportMarkers.setVisible(supportsOn && !hidden);
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}

// ---- X 光透视：构件材质半透切换（接线层实现；线框/标注保持实显，composer 链兼容半透）----
let xrayOn = false;
const _xrayMats = new WeakMap(); // 原材质 → 共享半透克隆（跨 rebuild 复用，避免拖参反复新建）
function xrayMatOf(orig) {
  let m = _xrayMats.get(orig);
  if (!m) {
    m = orig.clone();
    m.transparent = true;
    m.opacity = 0.15;
    m.depthWrite = false;
    _xrayMats.set(orig, m);
  }
  return m;
}
function applyXrayTo(group, on) {
  if (!group) return;
  group.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    if (on) {
      if (!o.userData.__origMat) o.userData.__origMat = o.material;
      const orig = o.userData.__origMat;
      // 材质数组（多材质网格）逐项半透；不可克隆的材质保持原样退出
      o.material = Array.isArray(orig)
        ? orig.map((m) => (m && typeof m.clone === 'function' ? xrayMatOf(m) : m))
        : (orig && typeof orig.clone === 'function' ? xrayMatOf(orig) : orig);
    } else if (o.userData.__origMat) {
      o.material = o.userData.__origMat;
      delete o.userData.__origMat;
    }
  });
}
function setXray(on) {
  xrayOn = on;
  if (!webglFailed) {
    applyXrayTo(active()?.group, on);
    window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  }
  hud.setXrayUi(on);
}

// ---- HUD(单实例,双形态自适应)----
const hud = createHud(hudLeft, hudRight, {
  setView: (name) => {
    if (webglFailed) return;
    if (name === 'node') {
      controls.autoRotate = false;
      const act = active();
      if (act?.groups) anims.explode(act.groups, false);
      const boom = hudRight.querySelector('[aria-label="爆炸"]');
      if (boom) boom.classList.remove('on');
      applyExplodeAux(false);
    }
    const vp = anims.viewPos(name, active().bounds);
    anims.flyTo(vp.pos, vp.tgt, 900);
  },
  setExplode: (on) => {
    if (!webglFailed) {
      const act = active();
      if (act?.groups) anims.explode(act.groups, on);
      applyExplodeAux(on);
    }
  },
  setSpin: (on) => { if (!webglFailed) controls.autoRotate = on; },
  setXray: (on) => setXray(on),
  setSupports: (on) => {
    supportsOn = on;
    if (supportMarkers) supportMarkers.setVisible(on && !explodeAuxHidden);
    window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  },
});
if (supportsOn) hud.setSupportsUi(true);
const hudRod = hud;

// ---- 视口左侧浮动工具条：缩放 / 全屏 ----
document.getElementById('view-tools')?.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.zoom) {
    if (webglFailed) return;
    const f = btn.dataset.zoom === 'in' ? 0.82 : 1.22;
    camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);
    window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  } else if (btn.dataset.fullscreen != null) {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
});

// ---- 移动端全屏查看 3D 模型模式 ----
const btnMobileFs = document.getElementById('btn-mobile-fullscreen');
const layoutEl = document.getElementById('layout');
if (btnMobileFs && layoutEl) {
  const labelSpan = btnMobileFs.querySelector('.btn-text');
  function toggleMobileFs(force) {
    const isNow = force !== undefined ? force : !layoutEl.classList.contains('mode-fullscreen-model');
    layoutEl.classList.toggle('mode-fullscreen-model', isNow);
    if (labelSpan) labelSpan.textContent = isNow ? '返回编辑' : '全屏看模型';
    btnMobileFs.setAttribute('aria-label', isNow ? '返回编辑面板' : '全屏看模型');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
    }, 40);
  }
  btnMobileFs.addEventListener('click', () => toggleMobileFs());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && layoutEl.classList.contains('mode-fullscreen-model')) {
      toggleMobileFs(false);
    }
  });
}

// ---- 动作 ----
// 打印 / 导出 PDF（各产品共用）：抓当前渲染帧快照 → A4 设计与报价单 iframe 打印
function makePrintAction(kind) {
  return async () => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    showToast('正在生成打印稿 …');
    let snapshot = null;
    if (!webglFailed && window.__ALU_CAPTURE) {
      snapshot = await new Promise((res) => {
        const timer = setTimeout(() => res(null), 1500);
        window.__ALU_CAPTURE((d) => { clearTimeout(timer); res(d); });
      });
    }
    try {
      await printCurrentReport({ kind, cfg: PRODUCT_STORES[kind].get(), stats: s, snapshot });
    } catch (err) {
      console.error('[ALU] print report failed:', err);
      showToast('打印稿生成失败,请重试');
    }
  };
}

const profileActions = {
  onPrint: makePrintAction('profile'),
  onAdd: (cfg) => {
    const p = fmtPrice(calcPrice(cfg, panel.lastStats));
    const summary = `${cfg.bays} 跨 × ${cfg.levels} 层 · ${cfg.series} 系列`;
    const { totalCount } = addConfigItem({
      kind: 'profile',
      title: '工业铝型材置物架',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'profile');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料 · 型材总长 ${s.profileLengthM.toFixed(1)} m`);
  },
  onExportModel: async () => {
    if (!current || !current.group) { showToast('模型生成中,请稍候重试'); return; }
    try {
      const name = await downloadModel(current.group, 'profile', store.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] model export failed:', err);
      showToast('模型导出失败,请重试');
    }
  },
};
const rodActions = {
  onPrint: makePrintAction('rod'),
  onAdd: (cfg) => {
    const p = `¥ ${calcRodPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const styleLabel = { poster: '海报架', panel: '双联展板', acrylic: '亚克力展示屏' }[cfg.style] || '海报架';
    const summary = `柱距 ${cfg.width.toFixed(2)} m · 柱长 ${cfg.height.toFixed(2)} m · ${styleLabel}`;
    const { totalCount } = addConfigItem({
      kind: 'rod',
      title: '光轴展架',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'rod');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料`);
  },
  onExportModel: async () => {
    if (!rodCurrent || !rodCurrent.group) { showToast('模型生成中,请稍候重试'); return; }
    try {
      const name = await downloadModel(rodCurrent.group, 'rod', rodStore.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] rod model export failed:', err);
      showToast('模型导出失败,请重试');
    }
  },
};

const cartActions = {
  onPrint: makePrintAction('cart'),
  onAdd: (cfg) => {
    const p = `¥ ${calcCartPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = `宽 ${cfg.width.toFixed(2)} m × 深 ${cfg.depth.toFixed(2)} m`;
    const { totalCount } = addConfigItem({
      kind: 'cart',
      title: '移动边几',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'cart');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料`);
  },
  onExportModel: async () => {
    if (!cartCurrent || !cartCurrent.group) { showToast('模型生成中,请稍候重试'); return; }
    try {
      const name = await downloadModel(cartCurrent.group, 'cart', cartStore.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] cart model export failed:', err);
      showToast('模型导出失败,请重试');
    }
  },
};

const cratesActions = {
  onPrint: makePrintAction('crates'),
  onAdd: (cfg) => {
    const p = `¥ ${calcCratesPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = `${cfg.tiers} 层周转箱 · 宽 ${cfg.width.toFixed(2)} m`;
    const { totalCount } = addConfigItem({
      kind: 'crates',
      title: '周转箱架',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'crates');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料`);
  },
  onExportModel: async () => {
    if (!cratesCurrent || !cratesCurrent.group) { showToast(`模型生成中,请稍候重试`); return; }
    try {
      const name = await downloadModel(cratesCurrent.group, 'crates', cratesStore.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] crates model export failed:', err);
      showToast(`模型导出失败,请重试`);
    }
  },
};

const woodcartActions = {
  onPrint: makePrintAction('woodcart'),
  onAdd: (cfg) => {
    const p = `¥ ${calcWoodCartPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = `木展车 ${cfg.width.toFixed(2)}×${cfg.depth.toFixed(2)} m`;
    const { totalCount } = addConfigItem({
      kind: 'woodcart',
      title: '木展车',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'woodcart');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料`);
  },
  onExportModel: async () => {
    if (!woodCartCurrent || !woodCartCurrent.group) { showToast('模型生成中,请稍候重试'); return; }
    try {
      const name = await downloadModel(woodCartCurrent.group, 'woodcart', woodcartStore.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] woodcart model export failed:', err);
      showToast('模型导出失败,请重试');
    }
  },
};

const bookActions = {
  onPrint: makePrintAction('books'),
  onAdd: (cfg) => {
    const p = `¥ ${calcBookshelfPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = cfg.style === 'table'
      ? `长桌 ${cfg.tBays} 节 × ${cfg.tBayW.toFixed(2)} m`
      : `展示塔 ${cfg.levels} 层 × ${cfg.bays} 跨 · ${cfg.bayW.toFixed(2)} m`;
    const { totalCount } = addConfigItem({
      kind: 'books',
      title: '光轴书架',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'books');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料`);
  },
  onExportModel: async () => {
    if (!booksCurrent || !booksCurrent.group) { showToast('模型生成中,请稍候重试'); return; }
    try {
      const name = await downloadModel(booksCurrent.group, 'books', bookshelfStore.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] books model export failed:', err);
      showToast('模型导出失败,请重试');
    }
  },
};

const hangerActions = {
  onPrint: makePrintAction('hanger'),
  onAdd: (cfg) => {
    const p = `¥ ${calcHangerPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = cfg.style === 'atelier'
      ? `原木水磨石 ${cfg.width.toFixed(2)}×${cfg.depth.toFixed(2)} m · ${ATELIER_MODULES[cfg.drawers]}`
      : `光轴抽屉柜 ${cfg.width.toFixed(2)}×${cfg.depth.toFixed(2)} m · ${cfg.drawers} 抽屉`;
    const { totalCount } = addConfigItem({
      kind: 'hanger',
      title: '挂衣架',
      summary,
      priceText: p,
      cfg,
    });
    showToast(`已加入配置清单（当前共 ${totalCount} 件）· ${summary} · ${p}`);
  },
  onExport: (cfg) => {
    const s = panel.lastStats;
    if (!s || !s.cutList) { showToast('算料数据生成中,请稍候重试'); return; }
    downloadCutlist(cfg, s, 'hanger');
    showToast(`算料单已导出 · ${s.cutList.length} 项下料`);
  },
  onExportModel: async () => {
    if (!hangerCurrent || !hangerCurrent.group) { showToast('模型生成中,请稍候重试'); return; }
    try {
      const name = await downloadModel(hangerCurrent.group, 'hanger', hangerStore.get());
      showToast(`3D 模型已导出 · ${name}`);
    } catch (err) {
      console.error('[ALU] hanger model export failed:', err);
      showToast('模型导出失败,请重试');
    }
  },
};

// ---- 产品挂载 ----
// panel.dispose() 释放订阅与全局监听；原封的 panel.js 不返回 dispose，
// 由包装对象以「摘除容器」兜底（DOM 摘除后其 root 级监听器不再可达）。
function mountActiveProduct() {
  if (panel && typeof panel.dispose === 'function') panel.dispose();
  panelRoot.innerHTML = '';
  hotspotLayer.style.display = productKind === 'profile' ? '' : 'none';
  hotspots.setHidden(productKind !== 'profile');
  if (productKind === 'rod') {
    setInstallSteps(INSTALL_STEPS_ROD);
    panel = createRodPanel(panelRoot, rodActions);
    if (webglFailed) syncRodStatsOnly(); else { rebuildRod({ isEntrance: true }); if (rodCurrent && !scene.children.includes(rodHandles.group)) scene.add(rodHandles.group); }
  } else if (productKind === 'cart') {
    setInstallSteps(INSTALL_STEPS_CART);
    panel = createCartPanel(panelRoot, cartActions);
    if (webglFailed) syncCartStatsOnly(); else rebuildCart({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else if (productKind === 'crates') {
    setInstallSteps(INSTALL_STEPS_CRATES);
    panel = createCratesPanel(panelRoot, cratesActions);
    if (webglFailed) syncCratesStatsOnly(); else rebuildCrates({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else if (productKind === 'woodcart') {
    setInstallSteps(INSTALL_STEPS_WOODCART);
    panel = createWoodCartPanel(panelRoot, woodcartActions);
    if (webglFailed) syncWoodCartStatsOnly(); else rebuildWoodCart({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else if (productKind === 'books') {
    setInstallSteps(INSTALL_STEPS_BOOKSHELF);
    panel = createBookshelfPanel(panelRoot, bookActions);
    if (webglFailed) syncBooksStatsOnly(); else rebuildBooks({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else if (productKind === 'hanger') {
    setInstallSteps(INSTALL_STEPS_HANGER);
    panel = createHangerPanel(panelRoot, hangerActions);
    if (webglFailed) syncHangerStatsOnly(); else rebuildHanger({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else {
    setInstallSteps(INSTALL_STEPS);
    const inner = createPanel(panelRoot, profileActions);
    decoratePanel(panelRoot, { onPrint: () => profileActions.onPrint() }); // 分区标题/行布局/打印按钮（panel.js 原封，装饰在接线层注入）
    panel = { ...inner, dispose() { /* 原封 panel.js 无显式资源；容器已由上方 innerHTML 清空 */ } };
    syncPriceNote();
    if (webglFailed) syncStatsOnly(); else rebuild({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  }
  dimObstacleDirty = true; // 切换后读数卡/浮层几何变化，标注避让缓存置脏
  // 产品切换转场：面板内容 55ms 错峰淡入上浮（WAAPI 一次性动画，不占常驻 rAF；
  // 衔接 3D 侧 900ms flyTo，消除「面板瞬切 vs 相机飞行」的节奏割裂）
  if (panelRoot.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    [...panelRoot.children].forEach((el, i) => {
      el.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
        { duration: 280, delay: Math.min(i * 55, 440), easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
      );
    });
  }
}

// ---- 产品切换 tab 组（三分支持 #rod / #cart URL 直达）----
const productTabs = document.getElementById('product-tabs');
function unloadAll() {
  if (current) { scene.remove(current.group); current.dispose(); current = null; }
  if (rodCurrent) { scene.remove(rodCurrent.group); rodCurrent.dispose(); rodCurrent = null; }
  if (cartCurrent) { scene.remove(cartCurrent.group); cartCurrent.dispose(); cartCurrent = null; }
  if (cratesCurrent) { scene.remove(cratesCurrent.group); cratesCurrent.dispose(); cratesCurrent = null; }
  if (woodCartCurrent) { scene.remove(woodCartCurrent.group); woodCartCurrent.dispose(); woodCartCurrent = null; }
  if (hangerCurrent) { scene.remove(hangerCurrent.group); hangerCurrent.dispose(); hangerCurrent = null; }
  if (booksCurrent) { scene.remove(booksCurrent.group); booksCurrent.dispose(); booksCurrent = null; }
}
function syncSwitchLabel() {
  productTabs.querySelectorAll('button').forEach(b => {
    const on = b.dataset.kind === productKind;
    b.classList.toggle('on', on);
    if (on) {
      b.setAttribute('aria-selected', 'true');
      b.tabIndex = 0; // roving tabindex：仅激活项可 Tab 聚焦
      b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
    }
  });
}
// 产品深链分享 meta：随 tab 切换更新 og:title / og:description / document.title
// （抓取器不执行 JS，分享落地页仍以 index.html 静态 OG 为准；此处改善应用内与动态标签场景）
const SHARE_META = {
  profile: ['工业铝型材置物架', '逐层逐跨自由规划，实时算料报价，一键导出算料单与 3D 模型。'],
  rod: ['光轴展架', '双光轴立柱移动展示架：海报画面、镀锌背板与滚轮底盘，展陈更轻盈。'],
  books: ['光轴书架', '铬管框架阅读装置：斜面展板逐层陈列，交叉拉索张紧，木箱脚轮基座。'],
  cart: ['移动边几', '光轴 + 玻璃/亚克力台面的极简移动边几，小空间随手移动。'],
  crates: ['周转箱架', '2040 铝架 + 抽拉式物流周转箱：层数可调、箱色自由搭配，满载可推行。'],
  woodcart: ['光轴木展车', '光轴 + 胶合板移动展车：洞洞板展墙、层板与顶台板、卡片挂杆与顶部挂架。'],
  hanger: ['光轴挂衣架', '两种样式：光轴抽屉柜移动挂衣架 / 原木水磨石挂衣架（藤编搁板 + 抽屉柜与收纳箱）。'],
};
function updateShareMeta(kind) {
  const [title, desc] = SHARE_META[kind] || SHARE_META.profile;
  document.title = 'MODULO 模数 · ' + title;
  for (const [sel, attr, val] of [
    ['meta[property="og:title"]', 'content', 'MODULO 模数 · ' + title],
    ['meta[property="og:description"]', 'content', desc],
    ['meta[name="description"]', 'content', desc],
  ]) {
    document.querySelector(sel)?.setAttribute(attr, val);
  }
}

function switchTo(kind) {
  if (kind === productKind) return;
  unloadAll();
  productKind = kind;
  history.replaceState(null, '', kind === 'profile' ? '#' : '#' + kind);
  updateShareMeta(kind);
  // store 查表（与 PRODUCT_SUBS 同源，新增产品只需登记一处）
  const sub = PRODUCT_SUBS.find(p => p.kind === productKind);
  persist(productKind, PRODUCT_STORES[productKind].get());
  syncSwitchLabel();
  mountActiveProduct();
  if (anims.exploded) {
    const act = active();
    if (act?.groups) anims.explode(act.groups, true);
  }
  applyExplodeAux(!webglFailed && !!anims.exploded);
  if (!webglFailed) {
    const vp = anims.viewPos('iso', active().bounds);
    anims.flyTo(vp.pos, vp.tgt, 900);
  }
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}
productTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-kind]');
  if (btn) switchTo(btn.dataset.kind);
});
// 键盘导航（WAI-ARIA tabs 模式）：方向键移动并激活，Home/End 跳两端
productTabs.addEventListener('keydown', (e) => {
  const tabs = [...productTabs.querySelectorAll('button[data-kind]')];
  const idx = tabs.findIndex((b) => b === document.activeElement);
  if (idx === -1) return;
  let next = null;
  if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length];
  else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length];
  else if (e.key === 'Home') next = tabs[0];
  else if (e.key === 'End') next = tabs[tabs.length - 1];
  if (next) {
    e.preventDefault();
    next.focus();
    switchTo(next.dataset.kind);
  }
});
syncSwitchLabel();

// 初始化配置清单系统
initConfigList((kind, cfg) => {
  switchTo(kind);
  const targetStore = PRODUCT_STORES[kind];
  if (targetStore && cfg) targetStore.set(cfg);
});

// 防抖（每个 store 独立定时器，参数微调只重构终态，不触发入场动画）
const debounce = (fn, ms = 60) => {
  let t = 0;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
};

// 订阅注册表：kind → { store, rebuild, statsOnly, extra }
// 新增产品只需在此登记，订阅接线（persist → rebuild → stats 兜底）自动完成，
// 杜绝「数据已写但场景不重建」的假按钮事故（2026-09-15 曾发生 crates/woodcart 漏接）。
const PRODUCT_SUBS = [
  { kind: 'profile', store, rebuild: (opts) => rebuild(opts), statsOnly: () => syncStatsOnly(), extra: () => syncPriceNote() },
  { kind: 'rod', store: rodStore, rebuild: (opts) => rebuildRod(opts), statsOnly: () => syncRodStatsOnly() },
  { kind: 'cart', store: cartStore, rebuild: (opts) => rebuildCart(opts), statsOnly: () => syncCartStatsOnly() },
  { kind: 'crates', store: cratesStore, rebuild: (opts) => rebuildCrates(opts), statsOnly: () => syncCratesStatsOnly() },
  { kind: 'woodcart', store: woodcartStore, rebuild: (opts) => rebuildWoodCart(opts), statsOnly: () => syncWoodCartStatsOnly() },
  { kind: 'hanger', store: hangerStore, rebuild: (opts) => rebuildHanger(opts), statsOnly: () => syncHangerStatsOnly() },
  { kind: 'books', store: bookshelfStore, rebuild: (opts) => rebuildBooks(opts), statsOnly: () => syncBooksStatsOnly() },
];
for (const { kind, store: s, rebuild, statsOnly, extra } of PRODUCT_SUBS) {
  s.subscribe(debounce(() => {
    persist(kind, s.get());
    if (productKind === kind) {
      rebuild({ isEntrance: false });
      if (webglFailed) statsOnly();
      if (extra) extra();
    }
  }, 60));
}

// KV 价格表到达后重刷价格区块（覆盖全部六产品；未配置 KV 时回退内置表也会触发一次，无副作用）
onMarketRefresh(() => {
  if (webglFailed) return;
  const a = active();
  if (a) panel.updateStats(a.stats);
  if (productKind === 'profile') syncPriceNote();
});

// 远端价格表不可用（KV 未配置 / 坏表被 worker 拒绝）时在品牌区露出内置基准标记，
// 避免「页面看起来正常但报价其实是旧内置表」的静默降级（2026-09-17 真实事故）。
function updatePriceSrcBadge(m) {
  const el2 = document.getElementById('price-src-badge');
  if (!el2) return;
  const remote = m && m.remoteUpdated ? `远端价格表 ${m.remoteUpdated}` : null;
  el2.textContent = remote || `内置基准价 · 更新 ${(m && m.updated) || '—'}`;
  el2.classList.toggle('fallback', !remote);
  el2.title = remote
    ? '价格表来自远端（/api/market），人工核验更新'
    : '远端价格表不可用，当前显示内置示例基准价（仅供比价参考）';
}
onMarketRefresh(updatePriceSrcBadge);

let toastTimer = 0;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// 诊断信息一键复制：品牌区「悬停 2s（桌面）或长按 1.5s（触屏）」或点击文末按钮触发，
// 收集 __ALU_ERRORS / __ALU_READY / UA / 配置 hash，供用户把线上问题现场信息发给维护者。
// 不做远程上报（无接收端，避免死代码）。
{
  const fire = () => {
    const diag = [
      '=== MODULO 诊断信息 ===',
      'UA: ' + navigator.userAgent,
      'URL: ' + location.href,
      'READY: ' + JSON.stringify(window.__ALU_READY || null),
      'FX: ' + JSON.stringify(window.__ALU_FX || null),
      'ERRORS: ' + JSON.stringify(window.__ALU_ERRORS || []),
      'TIME: ' + new Date().toISOString(),
    ].join('\n');
    const done = () => showToast('诊断信息已复制，请粘贴发送给维护者');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(diag).then(done).catch(() => { console.info(diag); showToast('复制失败，诊断信息已输出到控制台'); });
    } else {
      console.info(diag);
      showToast('诊断信息已输出到控制台（F12 查看）');
    }
  };
  window.__ALU_COPY_DIAG = fire;
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.style.cursor = 'pointer';
    // 桌面：悬停 2s；触屏：长按 1.5s（touchstart 计时，touchend/touchcancel 取消）
    let hoverTimer = 0, touchTimer = 0;
    brand.addEventListener('mouseenter', () => { hoverTimer = setTimeout(fire, 2000); });
    brand.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
    brand.addEventListener('touchstart', () => { touchTimer = setTimeout(fire, 1500); }, { passive: true });
    brand.addEventListener('touchend', () => clearTimeout(touchTimer));
    brand.addEventListener('touchcancel', () => clearTimeout(touchTimer));
  }
}


// loader 隐藏统一由「首帧渲染完成」驱动（见渲染循环 ready 分支）；
// 不再用固定 700ms 定时器（慢机闪加载层、快机白等）。8s 超时兜底见文件末尾。
function hideLoader() {
  loader.classList.add('hide');
  setTimeout(() => { loader.style.display = 'none'; }, 450);
}

// ---- 渲染循环（按需渲染：静止时零 GPU 负载，只有交互/动画/自动旋转时才出帧）----
if (webglFailed) {
  loader.textContent = '正在生成骨架 …';
  mountActiveProduct();
} else {
  let frames = 0;
  let fpsTime = performance.now();
  let ready = false;
  let rafId = 0;
  let needsRender = true;       // 场景脏标记：配置变更 / 相机运动 / 尺寸变化
  let interactionActive = false; // OrbitControls 拖拽中
  let hotspotsDirty = true;     // 热点/标注需要重投影
  let captureCb = null;         // 打印快照回调（window.__ALU_CAPTURE 注入）
  let lastT = performance.now();

  // WASD/QE 键盘平移（Rhino/游戏式），输入框聚焦时不劫持
  const keys = new Set();
  const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'shift']);
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.has(k)) keys.add(k);
    if (k === 'x' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) setXray(!xrayOn);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _mv = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  function moveByKeys(dt) {
    if (!keys.size) return false;
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) return false;
    _fwd.normalize();
    _right.crossVectors(_fwd, UP);
    _mv.set(0, 0, 0);
    if (keys.has('w')) _mv.add(_fwd);
    if (keys.has('s')) _mv.sub(_fwd);
    if (keys.has('d')) _mv.add(_right);
    if (keys.has('a')) _mv.sub(_right);
    if (keys.has('e')) _mv.y += 1;
    if (keys.has('q')) _mv.y -= 1;
    if (_mv.lengthSq() < 1e-6) return false;
    const speed = (keys.has('shift') ? 2.2 : 0.85) * dt;
    _mv.normalize().multiplyScalar(speed);
    camera.position.add(_mv);
    controls.target.add(_mv);
    return true;
  }

  // 任何动画（tween / 相机飞行）在跑 → 请求下一帧
  const animsActive = () => anims.update() === true;

  function renderOnce() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (moveByKeys(dt)) { needsRender = true; hotspotsDirty = true; }
    const animActive = animsActive(); // tween 按时间推进：空闲时无 tween 为 no-op
    if (animActive || interactionActive || controls.autoRotate) needsRender = true;
    // 心跳帧：空闲时每秒至少出一帧，保证 ready 探测 / drawCalls 统计 / 长时间挂机画面自愈
    if (now - fpsTime >= 1000) needsRender = true;
    if (!needsRender && !hotspotsDirty) {
      rafId = requestAnimationFrame(renderOnce);
      return;
    }
    controls.update();
    // DOM 尺寸线/± 热点没有深度遮挡：转到产品背面时整体隐藏，避免标注像穿在背板里。
    const backView = camera.position.z < controls.target.z - 0.03;
    const auxHidden = backView || explodeAuxHidden;
    dimSvg.style.opacity = auxHidden ? '0' : '';
    hotspotLayer.style.display = auxHidden ? 'none' : '';
    // 层板 LOD：远景（视距超阈值）用板条纹理整板替换亚像素板条几何（根治摩尔纹）。
    // stripsLOD 仅 GLB 模式生成；爆炸态两组都保留各自偏移，可见性切换独立于爆炸。
    postfx.render();
    // 打印报告快照：渲染后同一任务内同步抓帧（无 preserveDrawingBuffer 时合成前抓取有效）
    if (captureCb) {
      const cb = captureCb;
      captureCb = null;
      try { cb(canvas.toDataURL('image/jpeg', 0.88)); } catch { cb(null); }
    }
    const a = active();
    if (a && productKind === 'profile' && a.groups?.stripsLOD) {
      const camDist = camera.position.distanceTo(controls.target);
      window.__ALU_CAM_DIST = +camDist.toFixed(2); // QA：实测视距
      const far = camDist > 4.5;
      if (a.groups.strips.visible === far) {
        a.groups.strips.visible = !far;
        a.groups.stripsLOD.visible = far;
      }
    }
    if (a && !backView) {
      dims.update(a.stats?.envelope || a.bounds, center);
      nudgeDimLabels();
      if (productKind === 'profile') hotspots.sync();
      else rodHandles.sync();
    } else if (a && productKind !== 'profile') {
      rodHandles.sync();
    }
    hotspotsDirty = false;
    needsRender = false;

    frames++;
    const t = performance.now();
    if (t - fpsTime >= 1000) {
      frames = 0;
      fpsTime = t;
      if (!ready) {
        ready = true;
        hideLoader();
        window.__ALU_READY = { drawCalls: renderer.info.render.calls, tris: renderer.info.render.triangles };
        console.info('[ALU] ready', window.__ALU_READY);
        setTimeout(() => maybeStartTour(), 900); // 首访 5 步引导（localStorage 一次）
      }
    }
    rafId = requestAnimationFrame(renderOnce);
  }

  // 交互打脏：拖拽 / 缩放 / 平移
  controls.addEventListener('start', () => { interactionActive = true; });
  controls.addEventListener('end', () => { interactionActive = false; needsRender = true; });
  controls.addEventListener('change', () => { needsRender = true; hotspotsDirty = true; });
  window.addEventListener('resize', () => {
    needsRender = true;
    const el = canvas.parentElement;
    if (postfx && el) postfx.setSize(el.clientWidth, el.clientHeight);
  });

  // 对外暴露：配置变更后调用（rebuild / rebuildRod 内部已调用）
  function invalidateView() { needsRender = true; hotspotsDirty = true; }
  window.__ALU_INVALIDATE = invalidateView;
  // 打印报告用：请求下一渲染帧同步抓取 canvas（dataURL）；WebGL 不可用时不存在
  window.__ALU_CAPTURE = (cb) => { captureCb = cb; needsRender = true; hotspotsDirty = true; };
  // QA：读取当前产品支撑点数据（配件标记层数据源）
  window.__ALU_SUPPORTS = () => active()?.stats?.supports || null;
  // QA 用：读取当前产品装配的场景侧规模（与渲染路径无关，后期链下同样有效）
  window.__ALU_STATS = () => {
    const root = active();
    let meshes = 0, instances = 0, triangles = 0;
    if (root && root.group) root.group.traverse((o) => {
      if (o.isInstancedMesh) { meshes++; instances += o.count; }
      else if (o.isMesh) { meshes++; }
    });
    return { meshes, instances, triangles, drawCalls: renderer.info.render.calls, frameTris: renderer.info.render.triangles };
  };
  // QA 调试：暴露当前产品 group，供浏览器端逐 mesh 包围盒核查（对抗性审查用）
  window.__ALU_GROUP = () => active()?.group || null;
  // QA 调试：静止机位（细节特写截图用），参数为世界坐标 [x,y,z]
  window.__ALU_VIEW = (pos, tgt) => {
    controls.autoRotate = false;
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(tgt[0], tgt[1], tgt[2]);
    controls.update();
    invalidateView();
  };

  loader.textContent = '正在生成骨架 …';
  mountActiveProduct();
  // QA 直达:#rod/side 或 #rod/front 时用对应静止视角替代入场动画
  const viewMatch = location.hash.startsWith('#node')
    ? [null, 'node']
    : location.hash.match(/^#(?:rod|books|cart|crates|woodcart|hanger|profile)\/([a-z]+)/);
  if (viewMatch) {
    const vp = anims.viewPos(viewMatch[1], active().bounds);
    camera.position.copy(vp.pos);
    controls.target.copy(vp.tgt);
  } else {
    anims.intro(active().bounds);
  }
  renderOnce();
}

// ---- 兑底：若 8s 后仍未就绪且页面可见，给出可操作的失败提示而非永久 loading ----
// 仅在 loader 尚未进入隐藏流程时才改写文案（headless 虚拟时间截图不误报）
setTimeout(() => {
  if (!window.__ALU_READY && !webglFailed && document.visibilityState === 'visible' && !loader.classList.contains('hide')) {
    loader.textContent = '加载超时：请改用 dist/index.html 单文件版本，或通过本地服务器（npm run dev）打开。';
  }
}, 8000);
