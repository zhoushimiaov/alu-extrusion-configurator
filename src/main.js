// 入口:场景 → 双产品(型材架 / 光轴展架)参数化装配 → UI 接线 → 渲染循环
import * as THREE from 'three';
import './styles.css';
import { createScene } from './core/scene.js';
import { createPostFX } from './core/postfx.js';
import { buildShelf } from './core/buildShelf.js';
import { buildGlbFrame } from './core/buildGlbFrame.js';
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
import { buildWoodCart } from './core/buildWoodCart.js';
import { createCratesPanel, cratesStore, calcCratesPrice } from './ui/cratesPanel.js';
import { buildCratesRack } from './core/buildCratesRack.js';
import { buildCartTable } from './core/buildCartTable.js';
import { createHud } from './ui/hud.js';
import { downloadCutlist } from './ui/cutlist.js';
import { downloadModel } from './ui/modelExport.js';
import { onMarketRefresh } from './ui/marketPrice.js';
import { loadSaved, persist } from './ui/persist.js';
import { INSTALL_STEPS } from './config/product.js';
import { INSTALL_STEPS_ROD, BACK_TYPES, SHELF_TYPES, ROD_COLORS } from './config/rodrack.js';
import { INSTALL_STEPS_CART, ACRYLIC_TYPES, WOOD_FINISHES } from './config/cart.js';
import { INSTALL_STEPS_WOODCART, WOOD_TONES } from './config/woodcart.js';
import { INSTALL_STEPS_CRATES, CRATE_SCHEMES } from './config/crates.js';
import { PROFILE_SERIES, DECK_TYPES, COLORS } from './config/product.js';

// 算料单标签文案注入(cutlist 内部惰性读取,避免循环依赖)
window.__ALU_LABELS = {
  rodrack: { BACK_TYPES, SHELF_TYPES, ROD_COLORS },
  product: { PROFILE_SERIES, DECK_TYPES, COLORS },
  cart: { ACRYLIC_TYPES, WOOD_FINISHES },
  woodcart: { WOOD_TONES },
  crates: { CRATE_SCHEMES },
};

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

let productKind = /^#rod/.test(location.hash) ? 'rod' : /^#cart/.test(location.hash) ? 'cart' : /^#crates/.test(location.hash) ? 'crates' : /^#woodcart/.test(location.hash) ? 'woodcart' : 'profile';

// ---- 配置恢复：分享链接（hash ?c=）优先，其次 localStorage ----
// 白名单已由 persist.pickPersisted 按产品 schema 统一过滤，这里只做注入
{
  const savedProfile = loadSaved('profile');
  if (savedProfile && Object.keys(savedProfile).length) store.set(savedProfile);
  const savedRod = loadSaved('rod');
  if (savedRod && Object.keys(savedRod).length) rodStore.set(savedRod);
  const savedCart = loadSaved('cart');
  const savedCrates = loadSaved('crates');
  const savedWoodCart = loadSaved('woodcart');
  if (savedWoodCart && Object.keys(savedWoodCart).length) woodcartStore.set(savedWoodCart);
  if (savedCrates && Object.keys(savedCrates).length) cratesStore.set(savedCrates);
  if (savedCart && Object.keys(savedCart).length) cartStore.set(savedCart);
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
let panel = null;
const center = new THREE.Vector3(0, 0, 0);
const active = () => (productKind === 'rod' ? rodCurrent : productKind === 'cart' ? cartCurrent : productKind === 'crates' ? cratesCurrent : productKind === 'woodcart' ? woodCartCurrent : current);

// 场景处理：阴影已全局关闭，此处仅按产品包围盒调整主光位置
function stageProduct(p) {
  if (!p || !p.group) return;
  if (p.bounds) fitShadow(p.bounds);
}

function rebuild() {
  if (webglFailed || productKind !== 'profile') return;
  const cfg = store.get();
  if (current) { scene.remove(current.group); current.dispose(); }
  current = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, cfg.props);
  scene.add(current.group);
  stageProduct(current);
  if (!anims.REDUCED) anims.reveal(current.groups);
  hud.syncReadout(cfg, current.stats);
  panel.updateStats(current.stats);
  panel.lastStats = current.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}

function rebuildRod() {
  if (webglFailed || productKind !== 'rod') return;
  const cfg = rodStore.get();
  if (rodCurrent) { scene.remove(rodCurrent.group); rodCurrent.dispose(); }
  rodCurrent = buildRodRack(cfg);
  scene.add(rodCurrent.group);
  stageProduct(rodCurrent);
  if (!anims.REDUCED) anims.revealGroups(rodCurrent.group.children);
  rodHandles.sync();
  hudRod.syncReadout(cfg, rodCurrent.stats);
  panel.updateStats(rodCurrent.stats);
  panel.lastStats = rodCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}

function rebuildCart() {
  if (webglFailed || productKind !== 'cart') return;
  const cfg = cartStore.get();
  if (cartCurrent) { scene.remove(cartCurrent.group); cartCurrent.dispose(); }
  cartCurrent = buildCartTable(cfg);
  scene.add(cartCurrent.group);
  stageProduct(cartCurrent);
  if (!anims.REDUCED) anims.revealGroups(cartCurrent.group.children);
  hud.syncReadout(cfg, cartCurrent.stats);
  panel.updateStats(cartCurrent.stats);
  panel.lastStats = cartCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}

function rebuildCrates() {
  if (webglFailed || productKind !== 'crates') return;
  const cfg = cratesStore.get();
  if (cratesCurrent) { scene.remove(cratesCurrent.group); cratesCurrent.dispose(); }
  cratesCurrent = buildCratesRack(cfg);
  scene.add(cratesCurrent.group);
  stageProduct(cratesCurrent);
  if (!anims.REDUCED) anims.revealGroups(cratesCurrent.group.children);
  hud.syncReadout(cfg, cratesCurrent.stats);
  panel.updateStats(cratesCurrent.stats);
  panel.lastStats = cratesCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}

function rebuildWoodCart() {
  if (webglFailed || productKind !== 'woodcart') return;
  const cfg = woodcartStore.get();
  if (woodCartCurrent) { scene.remove(woodCartCurrent.group); woodCartCurrent.dispose(); }
  woodCartCurrent = buildWoodCart(cfg);
  scene.add(woodCartCurrent.group);
  stageProduct(woodCartCurrent);
  if (!anims.REDUCED) anims.revealGroups(woodCartCurrent.group.children);
  hud.syncReadout(cfg, woodCartCurrent.stats);
  panel.updateStats(woodCartCurrent.stats);
  panel.lastStats = woodCartCurrent.stats;
  window.__ALU_INVALIDATE && window.__ALU_INVALIDATE();
}

function syncWoodCartStatsOnly() {
  const cfg = woodcartStore.get();
  const b = buildWoodCart(cfg);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
}

function syncStatsOnly() {
  const cfg = store.get();
  const b = cfg.frameMode === 'glb' ? buildGlbFrame(cfg) : buildShelf(cfg, false);
  hud.syncReadout(cfg, b.stats);
  panel.updateStats(b.stats);
  panel.lastStats = b.stats;
  b.dispose();
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

// ---- 动作 ----
const profileActions = {
  onAdd: (cfg) => showToast(`已加入配置清单 · ${cfg.bays} 跨 × ${cfg.levels} 层 · ${fmtPrice(calcPrice(cfg, panel.lastStats))}`),
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
  onAdd: (cfg) => showToast(`已加入配置清单 · 柱距 ${cfg.width.toFixed(2)} m · 柱长 ${cfg.height.toFixed(2)} m · ¥ ${calcRodPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`),
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
  onAdd: (cfg) => showToast(`已加入配置清单 · 宽 ${cfg.width.toFixed(2)} m × 深 ${cfg.depth.toFixed(2)} m · ¥ ${calcCartPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`),
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
  onAdd: (cfg) => showToast(`已加入配置清单 · ${cfg.tiers} 层周转箱 · 宽 ${cfg.width.toFixed(2)} m · ¥ ${calcCratesPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`),
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
  onAdd: (cfg) => showToast(`已加入配置清单 · 木展车 ${cfg.width.toFixed(2)}×${cfg.depth.toFixed(2)} m · ¥ ${calcWoodCartPrice(cfg, panel.lastStats).toLocaleString('zh-CN')}`),
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
    if (webglFailed) syncRodStatsOnly(); else { rebuildRod(); if (rodCurrent && !scene.children.includes(rodHandles.group)) scene.add(rodHandles.group); }
  } else if (productKind === 'cart') {
    setInstallSteps(INSTALL_STEPS_CART);
    panel = createCartPanel(panelRoot, cartActions);
    if (webglFailed) syncCartStatsOnly(); else rebuildCart();
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else if (productKind === 'crates') {
    setInstallSteps(INSTALL_STEPS_CRATES);
    panel = createCratesPanel(panelRoot, cratesActions);
    if (webglFailed) syncCratesStatsOnly(); else rebuildCrates();
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else if (productKind === 'woodcart') {
    setInstallSteps(INSTALL_STEPS_WOODCART);
    panel = createWoodCartPanel(panelRoot, woodcartActions);
    if (webglFailed) syncWoodCartStatsOnly(); else rebuildWoodCart();
    if (rodHandles?.group.parent) scene.remove(rodHandles.group);
  } else {
    setInstallSteps(INSTALL_STEPS);
    const inner = createPanel(panelRoot, profileActions);
    panel = { ...inner, dispose() { /* 原封 panel.js 无显式资源；容器已由上方 innerHTML 清空 */ } };
    syncPriceNote();
    if (webglFailed) syncStatsOnly(); else rebuild();
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
}
function syncSwitchLabel() {
  productTabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.kind === productKind));
}
function switchTo(kind) {
  if (kind === productKind) return;
  unloadAll();
  productKind = kind;
  history.replaceState(null, '', kind === 'profile' ? '#' : '#' + kind);
  persist(productKind, productKind === 'rod' ? rodStore.get() : productKind === 'cart' ? cartStore.get() : productKind === 'crates' ? cratesStore.get() : productKind === 'woodcart' ? woodcartStore.get() : store.get());
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

// ---- 订阅（两个 store 各自独立防抖，避免快速切产品时互相取消重建）----
const debounce = (fn, ms = 80) => {
  let t = 0;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
};
store.subscribe(debounce(() => {
  persist('profile', store.get());
  if (productKind === 'profile') { rebuild(); if (webglFailed) syncStatsOnly(); syncPriceNote(); }
}));
rodStore.subscribe(debounce(() => {
  persist('rod', rodStore.get());
  if (productKind === 'rod') { rebuildRod(); if (webglFailed) syncRodStatsOnly(); }
}));
cartStore.subscribe(debounce(() => {
  persist('cart', cartStore.get());
  if (productKind === 'cart') { rebuildCart(); if (webglFailed) syncCartStatsOnly(); }
}));
cratesStore.subscribe(debounce(() => {
  persist('crates', cratesStore.get());
  if (productKind === 'crates') { rebuildCrates(); if (webglFailed) syncCratesStatsOnly(); }
}));
woodcartStore.subscribe(debounce(() => {
  persist('woodcart', woodcartStore.get());
  if (productKind === 'woodcart') { rebuildWoodCart(); if (webglFailed) syncWoodCartStatsOnly(); }
}));

// KV 价格表到达后重刷价格区块（覆盖全部五产品；未配置 KV 时回退内置表也会触发一次，无副作用）
onMarketRefresh(() => {
  if (webglFailed) return;
  const a = active();
  if (a) panel.updateStats(a.stats);
  if (productKind === 'profile') syncPriceNote();
});

let toastTimer = 0;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
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
    postfx.render();
    const a = active();
    if (a) {
      dims.update(a.bounds, center);
      if (productKind === 'profile') hotspots.sync();
      else rodHandles.sync();
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
        loader.classList.add('hide');
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

  mountActiveProduct();
  // QA 直达:#rod/side 或 #rod/front 时用对应静止视角替代入场动画
  const viewMatch = location.hash.startsWith('#node')
    ? [null, 'node']
    : location.hash.match(/^#(?:rod|cart|crates|woodcart|profile)\/([a-z]+)/);
  if (viewMatch) {
    const vp = anims.viewPos(viewMatch[1], active().bounds);
    camera.position.copy(vp.pos);
    controls.target.copy(vp.tgt);
  } else {
    anims.intro(active().bounds);
  }
  setTimeout(() => { loader.classList.add('hide'); setTimeout(() => { loader.style.display = 'none'; }, 450); }, 700);
  renderOnce();
}

// ---- 兑底：若 8s 后仍未就绪且页面可见，给出可操作的失败提示而非永久 loading ----
// 仅在 loader 尚未进入隐藏流程时才改写文案（headless 虚拟时间截图不误报）
setTimeout(() => {
  if (!window.__ALU_READY && !webglFailed && document.visibilityState === 'visible' && !loader.classList.contains('hide')) {
    loader.textContent = '加载超时：请改用 dist/index.html 单文件版本，或通过本地服务器（npm run dev）打开。';
  }
}, 8000);
