// 入口:场景 → 双产品(型材架 / 光轴展架)参数化装配 → UI 接线 → 渲染循环
import * as THREE from 'three';
import './fonts.css';
import './styles.css';
import { createScene } from './core/scene.js';
import { createPostFX } from './core/postfx.js';
import { buildShelf } from './core/buildShelf.js';
import { buildGlbFrame, computeGlbStats } from './core/buildGlbFrame.js';
import { retreatShelfBackPanels } from './core/shelfBackPanel.js';
import { declutterProps } from './core/propsDeclutter.js';
import { decoratePanel } from './ui/panelDecor.js';
import { initConfigList, addConfigItem } from './ui/configList.js';
import { buildRodRack } from './core/buildRodRack.js';
import { createAnims } from './core/anims.js';
import { createDimensions } from './core/dimensions.js';
import { createHotspots } from './core/hotspots.js';
import { createRodHandles } from './core/rodHandles.js';
import { store, fmtPrice, calcPrice, setInstallSteps } from './ui/store.js';
import { createPanel } from './ui/panel.js';
import { createRodPanel, rodStore, calcRodPrice } from './ui/rodPanel.js';
import { createCartPanel, cartStore, calcCartPrice } from './ui/cartPanel.js';
import { createWoodCartPanel, woodcartStore, calcWoodCartPrice } from './ui/woodCartPanel.js';
import { createHangerPanel, hangerStore, calcHangerPrice } from './ui/hangerPanel.js';
import { buildWoodCart } from './core/buildWoodCart.js';
import { buildHanger } from './core/buildHanger.js';
import { createCratesPanel, cratesStore, calcCratesPrice } from './ui/cratesPanel.js';
import { buildCratesRack } from './core/buildCratesRack.js';
import { buildCartTable } from './core/buildCartTable.js';
import { createHud } from './ui/hud.js';
import { downloadCutlist } from './ui/cutlist.js';
import { registerLabels } from './ui/cutlist.js';
import { downloadModel } from './ui/modelExport.js';
import { onMarketRefresh } from './ui/marketPrice.js';
import { loadSaved, persist } from './ui/persist.js';
import { INSTALL_STEPS } from './config/product.js';
import { INSTALL_STEPS_ROD, BACK_TYPES, SHELF_TYPES, ROD_COLORS } from './config/rodrack.js';
import { INSTALL_STEPS_CART, ACRYLIC_TYPES, WOOD_FINISHES } from './config/cart.js';
import { INSTALL_STEPS_WOODCART, WOOD_TONES } from './config/woodcart.js';
import { INSTALL_STEPS_CRATES, CRATE_SCHEMES } from './config/crates.js';
import { INSTALL_STEPS_HANGER, HANGER_COLORS } from './config/hanger.js';
import { PROFILE_SERIES, DECK_TYPES, COLORS } from './config/product.js';

// 算料单标签文案注入（显式注册 API，替代旧的 window.__ALU_LABELS 全局注入）
registerLabels('rodrack', { BACK_TYPES, SHELF_TYPES, ROD_COLORS });
registerLabels('product', { PROFILE_SERIES, DECK_TYPES, COLORS });
registerLabels('cart', { ACRYLIC_TYPES, WOOD_FINISHES });
registerLabels('woodcart', { WOOD_TONES });
registerLabels('crates', { CRATE_SCHEMES });
registerLabels('hanger', { HANGER_COLORS });

const canvas = document.getElementById('gl');
const dimSvg = document.getElementById('dim-layer');
const hotspotLayer = document.getElementById('hotspot-layer');
const hudLeft = document.getElementById('hud-left');
const hudRight = document.getElementById('hud-right');
const panelRoot = document.getElementById('panel');
const loader = document.getElementById('loader');
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
// 光轴展架视口内拖拽箭头（宽 / 高两个方向）
const rodHandles = webglFailed ? null : createRodHandles(canvas, camera, renderer, controls, rodStore, () => (rodCurrent?.bounds) || { W: 1.0, H: 1.4, D: 0.42 });

let productKind = /^#rod/.test(location.hash) ? 'rod' : /^#cart/.test(location.hash) ? 'cart' : /^#crates/.test(location.hash) ? 'crates' : /^#woodcart/.test(location.hash) ? 'woodcart' : /^#hanger/.test(location.hash) ? 'hanger' : 'profile';

// ---- 配置恢复：分享链接（hash ?c=）优先，其次 localStorage ----
// 白名单已由 persist.pickPersisted 按产品 schema 统一过滤，这里只做注入。
// 与 PRODUCT_SUBS 共用注册表定义，新增产品只需登记一次（恢复 + 订阅 + persist 自动接线）。
const PRODUCT_STORES = {
  profile: store, rod: rodStore, cart: cartStore,
  crates: cratesStore, woodcart: woodcartStore, hanger: hangerStore,
};
for (const [kind, s] of Object.entries(PRODUCT_STORES)) {
  const saved = loadSaved(kind);
  if (saved && Object.keys(saved).length) s.set(saved);
}

let current = null;      // 型材架
function syncPriceNote() {
  const note = panelRoot.querySelector('.price-note');
  if (note) {
    note.textContent = store.get().frameMode === 'glb'
      ? '参考估价（有未计价项时为已计价小计）'
      : '示例材料估价';
  }
}
let rodCurrent = null;   // 光轴展架
let cartCurrent = null;  // 移动边几
let cratesCurrent = null; // 周转箱收纳架
let woodCartCurrent = null; // 光轴木展车
let hangerCurrent = null;   // 光轴挂衣架
let panel = null;
const center = new THREE.Vector3(0, 0, 0);
const active = () => (productKind === 'rod' ? rodCurrent : productKind === 'cart' ? cartCurrent : productKind === 'crates' ? cratesCurrent : productKind === 'woodcart' ? woodCartCurrent : productKind === 'hanger' ? hangerCurrent : current);

// 场景处理：阴影已全局关闭，此处仅按产品包围盒调整主光位置
function stageProduct(p) {
  if (!p || !p.group) return;
  if (p.bounds) fitShadow(p.bounds);
}


function rebuild({ isEntrance = false } = {}) {
  if (webglFailed || productKind !== 'profile') return;
  const t0 = performance.now();
  const cfg = store.get();
  if (current) { scene.remove(current.group); current.dispose(); }
  current = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, cfg.props);
  retreatShelfBackPanels(current);
  declutterProps(current);
  scene.add(current.group);
  stageProduct(current);
  if (!anims.REDUCED && isEntrance) anims.reveal(current.groups);
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
  hud.syncReadout(cfg, cratesCurrent.stats);
  panel.updateStats(cratesCurrent.stats);
  panel.lastStats = cratesCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild crates: ${cost.toFixed(1)}ms`);
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
  hud.syncReadout(cfg, hangerCurrent.stats);
  panel.updateStats(hangerCurrent.stats);
  panel.lastStats = hangerCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
  const cost = performance.now() - t0;
  if (cost > 10) console.debug(`[ALU] rebuild hanger: ${cost.toFixed(1)}ms`);
}

function syncWoodCartStatsOnly() {
  const cfg = woodcartStore.get();
  const b = buildWoodCart(cfg);
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

// ---- HUD(单实例,双形态自适应)----
const hud = createHud(hudLeft, hudRight, {
  setView: (name) => {
    if (webglFailed) return;
    if(name === 'node') { controls.autoRotate=false; anims.explode(current.groups,false); }
    const vp = anims.viewPos(name, active().bounds);
    anims.flyTo(vp.pos, vp.tgt, 900);
  },
  setExplode: (on) => { if (!webglFailed && current) anims.explode(current.groups, on); },
  setSpin: (on) => { if (!webglFailed) controls.autoRotate = on; },
});
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

// ---- 动作 ----
const profileActions = {
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
  onAdd: (cfg) => {
    const p = `¥ ${calcRodPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = `柱距 ${cfg.width.toFixed(2)} m · 柱长 ${cfg.height.toFixed(2)} m · ${cfg.style === 'poster' ? '海报架' : '挂画架'}`;
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

const hangerActions = {
  onAdd: (cfg) => {
    const p = `¥ ${calcHangerPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`;
    const summary = `挂衣架 ${cfg.width.toFixed(2)}×${cfg.depth.toFixed(2)} m · ${cfg.drawers} 抽屉`;
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
  } else if (productKind === 'hanger') {
    setInstallSteps(INSTALL_STEPS_HANGER);
    panel = createHangerPanel(panelRoot, hangerActions);
    if (webglFailed) syncHangerStatsOnly(); else rebuildHanger({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else {
    setInstallSteps(INSTALL_STEPS);
    const inner = createPanel(panelRoot, profileActions);
    decoratePanel(panelRoot); // 分区标题/行布局（panel.js 原封，装饰在接线层注入）
    panel = { ...inner, dispose() { /* 原封 panel.js 无显式资源；容器已由上方 innerHTML 清空 */ } };
    syncPriceNote();
    if (webglFailed) syncStatsOnly(); else rebuild({ isEntrance: true });
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
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
}
function syncSwitchLabel() {
  productTabs.querySelectorAll('button').forEach(b => {
    const on = b.dataset.kind === productKind;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    if (on) {
      b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });
}
function switchTo(kind) {
  if (kind === productKind) return;
  unloadAll();
  productKind = kind;
  history.replaceState(null, '', kind === 'profile' ? '#' : '#' + kind);
  // store 查表（与 PRODUCT_SUBS 同源，新增产品只需登记一处）
  const sub = PRODUCT_SUBS.find(p => p.kind === productKind);
  persist(productKind, PRODUCT_STORES[productKind].get());
  syncSwitchLabel();
  mountActiveProduct();
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
  mountActiveProduct();
} else {
  let frames = 0;
  let fpsTime = performance.now();
  let ready = false;
  let rafId = 0;
  let needsRender = true;       // 场景脏标记：配置变更 / 相机运动 / 尺寸变化
  let interactionActive = false; // OrbitControls 拖拽中
  let hotspotsDirty = true;     // 热点/标注需要重投影
  let lastT = performance.now();

  // WASD/QE 键盘平移（Rhino/游戏式），输入框聚焦时不劫持
  const keys = new Set();
  const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'shift']);
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.has(k)) keys.add(k);
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
    dimSvg.style.opacity = backView ? '0' : '';
    hotspotLayer.style.display = backView ? 'none' : '';
    postfx.render();
    const a = active();
    if (a && !backView) {
      dims.update(a.bounds, center);
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

  mountActiveProduct();
  // QA 直达:#rod/side 或 #rod/front 时用对应静止视角替代入场动画
  const viewMatch = location.hash.startsWith('#node')
    ? [null, 'node']
    : location.hash.match(/^#(?:rod|cart|crates|woodcart|hanger|profile)\/([a-z]+)/);
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
