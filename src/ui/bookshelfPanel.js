// 光轴书架配置面板（Villa Medici 阅读装置：展示塔 / 阅读长桌）
import { PANEL_MATERIALS, FRAME_COLORS, LIMITS as BOOK_LIMITS, DEFAULT_BOOKSHELF_CONFIG, INSTALL_STEPS_BOOKSHELF, BOOK_STYLES } from '../config/bookshelf.js';
import { makeClamp } from '../config/clamp.js';
import { attachDragSlider } from './dragSlider.js';
import { calcMarketPrice } from './marketPrice.js';
import { PRICE_MARKET_HTML, updatePriceBlock } from './priceview.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

const clampCfg = makeClamp(BOOK_LIMITS, DEFAULT_BOOKSHELF_CONFIG);
let state = { ...DEFAULT_BOOKSHELF_CONFIG };
const subs = new Set();
export const bookshelfStore = {
  limits: BOOK_LIMITS,
  installSteps: INSTALL_STEPS_BOOKSHELF,
  get: () => state,
  set(patch) {
    const next = clampCfg({ ...state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

export function calcBookshelfPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}

let dragCleanup = null;
export function createBookshelfPanel(root, actions) {
  const container = el('div');
  root.appendChild(container);
  const mount = container;
  mount.appendChild(el('div', 'panel-title',
    `光轴书架<span class="en">ROD BOOKSHELF</span>`));
  mount.appendChild(el('p', 'panel-lead',
    '铬管框架阅读装置：展示塔以斜面展板逐层陈列，交叉拉索张紧；长桌以木台面配玻璃副层板。木箱脚轮基座可整体推行。'));

  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">宽 W</div><div class="v" data-spec="w">1.00<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-spec="h">1.85<small>m</small></div></div>
    <div class="spec-cell"><div class="k">深 D</div><div class="v" data-spec="d">0.34<small>m</small></div></div>
    <div class="spec-cell"><div class="k">零件</div><div class="v" data-spec="p">0<small>件</small></div></div>`);
  mount.appendChild(spec);
  mount.appendChild(el('hr', 'sec-rule'));

  const mkStepper = (label, key, lo, hi, step, unit) => {
    const f = el('div', null, `
      <div class="field-label"><span>${label}</span></div>
      <div class="stepper">
        <button data-act="${key}-" aria-label="减少">−</button>
        <span class="num" data-num="${key}"></span>
        <button data-act="${key}+" aria-label="增加">＋</button>
      </div>`);
    f.dataset.limits = JSON.stringify([key, lo, hi, step, unit]);
    return f;
  };
  const baysField = mkStepper('跨数 BAYS', 'bays', 1, 2, 1, ' 跨');
  const levelsField = mkStepper('层数 LEVELS', 'levels', 2, 5, 1, ' 层');
  const bayWField = mkStepper('跨宽 BAY WIDTH', 'bayW', 0.8, 1.2, 0.05, ' m');
  const depthField = mkStepper('框架深度 DEPTH', 'depth', 0.28, 0.45, 0.01, ' m');
  const tiltField = mkStepper('展板倾角 TILT', 'tilt', 20, 40, 2, '°');
  const tBaysField = mkStepper('节数 BAYS', 'tBays', 1, 3, 1, ' 节');
  const tBayWField = mkStepper('每节宽 BAY WIDTH', 'tBayW', 0.6, 1.0, 0.05, ' m');
  mount.appendChild(baysField);
  mount.appendChild(levelsField);
  mount.appendChild(bayWField);
  mount.appendChild(tiltField);
  mount.appendChild(tBaysField);
  mount.appendChild(tBayWField);
  mount.appendChild(depthField);

  dragCleanup && dragCleanup();
  dragCleanup = attachDragSlider(mount, {
    get: () => bookshelfStore.get(),
    set: (patch) => bookshelfStore.set(patch),
    limits: BOOK_LIMITS,
  });

  // 型式
  const styleField = el('div', null, `<div class="field-label"><span>型式 STYLE</span></div>`);
  const styleSeg = el('div', 'seg');
  for (const key of ['tower']) { // 长桌形态渲染调试中，暂只上架展示塔
    const b = el('button', null, BOOK_STYLES[key].label);
    b.dataset.seg = 'style'; b.dataset.val = key;
    styleSeg.appendChild(b);
  }
  styleField.appendChild(styleSeg);
  mount.insertBefore(styleField, mount.children[2]); // 紧跟规格卡

  // 展板材质（塔式）
  const matField = el('div', null, `<div class="field-label"><span>展板材质 PANEL</span></div>`);
  const matSeg = el('div', 'seg');
  for (const key of Object.keys(PANEL_MATERIALS)) {
    const b = el('button', null, PANEL_MATERIALS[key].label);
    b.dataset.seg = 'panelMat'; b.dataset.val = key;
    matSeg.appendChild(b);
  }
  matField.appendChild(matSeg);
  mount.appendChild(matField);

  // 开关：交叉拉索 / 木箱基座 / 亚克力前挡 / 玻璃副层板
  const mkSwitch = (label, key) => {
    const row = el('div', 'switch-row', `<span class="label">${label}</span>`);
    const sw = el('div', 'switch');
    sw.setAttribute('role', 'switch');
    sw.tabIndex = 0;
    sw.dataset.sw = key;
    sw.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        sw.click();
      }
    });
    row.appendChild(sw);
    mount.appendChild(row);
    return sw;
  };
  const wiresSw = mkSwitch('交叉拉索 CROSS WIRES', 'wires');
  const baseSw = mkSwitch('木箱基座（含脚轮，取消用调平地脚）', 'base');
  const acrylicSw = mkSwitch('亚克力前挡 ACRYLIC FRONT', 'acrylic');
  const glassSw = mkSwitch('玻璃副层板 GLASS SHELF', 'glassTop');
  const booksSw = mkSwitch('放上书 SAMPLE BOOKS', 'books');

  // 框架表面
  const colorField = el('div', null, `<div class="field-label"><span>框架表面 FINISH</span></div>`);
  const swatches = el('div', 'swatches');
  for (const key of Object.keys(FRAME_COLORS)) {
    const s = el('button', 'swatch');
    s.dataset.color = key;
    s.style.background = '#' + FRAME_COLORS[key].hex.toString(16).padStart(6, '0');
    s.title = FRAME_COLORS[key].label;
    s.setAttribute('aria-label', FRAME_COLORS[key].label);
    swatches.appendChild(s);
  }
  colorField.appendChild(swatches);
  mount.appendChild(colorField);

  // 价格区
  const priceBlock = el('div', 'price-block', `
    <div class="price-line"><span class="price" data-price>¥ 0</span><span class="price-note">示例材料估价</span></div>
    ${PRICE_MARKET_HTML}
    <div class="weight-note" data-weight>自重计算中 …</div>
    <div class="action-row">
      <button class="cta" data-cta>加入配置清单</button>
      <button class="cta-ghost" data-export title="SpreadsheetML 算料单，支持 Excel / WPS 打开">导出算料单</button>
      <button class="cta-ghost" data-model>导出 3D 模型 (.glb)</button>
    </div>
    <div class="panel-disclaimer">承重与报价为演示示例，实际以工程图纸与正式报价单为准。</div>`);
  mount.appendChild(priceBlock);

  // 安装说明
  const install = el('details', 'install');
  install.innerHTML = `
    <summary>安装说明<span class="en">INSTALLATION</span></summary>
    <ol>
      ${INSTALL_STEPS_BOOKSHELF.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  mount.appendChild(install);

  const diagWrap = el('div', 'panel-diag-row', `<button type="button" class="btn-diag" aria-label="一键复制系统诊断信息">复制系统诊断信息</button>`);
  diagWrap.querySelector('.btn-diag').addEventListener('click', () => { window.__ALU_COPY_DIAG && window.__ALU_COPY_DIAG(); });
  mount.appendChild(diagWrap);

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .switch');
    if (!btn) return;
    const c = bookshelfStore.get();
    const lim = bookshelfStore.limits;
    const step = (key, dflt) => {
      for (const f of [baysField, levelsField, bayWField, depthField, tiltField, tBaysField, tBayWField]) {
        const meta = JSON.parse(f.dataset.limits);
        if (meta[0] === key) return { lo: meta[1], hi: meta[2], st: meta[3] };
      }
      return { lo: 0, hi: 999, st: dflt };
    };
    for (const key of ['bays', 'levels', 'tBays']) {
      if (btn.dataset.act === key + '+') { const s = step(key); bookshelfStore.set({ [key]: Math.min(s.hi, c[key] + s.st) }); }
      if (btn.dataset.act === key + '-') { const s = step(key); bookshelfStore.set({ [key]: Math.max(s.lo, c[key] - s.st) }); }
    }
    for (const key of ['bayW', 'tBayW']) {
      if (btn.dataset.act === key + '+') { const s = step(key); bookshelfStore.set({ [key]: Math.min(s.hi, +(c[key] + s.st).toFixed(2)) }); }
      if (btn.dataset.act === key + '-') { const s = step(key); bookshelfStore.set({ [key]: Math.max(s.lo, +(c[key] - s.st).toFixed(2)) }); }
    }
    for (const key of ['depth']) {
      if (btn.dataset.act === key + '+') bookshelfStore.set({ [key]: Math.min(lim.depth[1], +(c[key] + 0.01).toFixed(2)) });
      if (btn.dataset.act === key + '-') bookshelfStore.set({ [key]: Math.max(lim.depth[0], +(c[key] - 0.01).toFixed(2)) });
    }
    for (const key of ['tilt']) {
      if (btn.dataset.act === key + '+') bookshelfStore.set({ [key]: Math.min(lim.tilt[1], c[key] + 2) });
      if (btn.dataset.act === key + '-') bookshelfStore.set({ [key]: Math.max(lim.tilt[0], c[key] - 2) });
    }
    if (btn.dataset.seg === 'style') bookshelfStore.set({ style: btn.dataset.val });
    if (btn.dataset.seg === 'panelMat') bookshelfStore.set({ panelMat: btn.dataset.val });
    if (btn.dataset.color) bookshelfStore.set({ color: btn.dataset.color });
    if (btn.dataset.sw) bookshelfStore.set({ [btn.dataset.sw]: !c[btn.dataset.sw] });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(bookshelfStore.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(bookshelfStore.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(bookshelfStore.get());
  });

  function syncSpecs(c) {
    const tower = c.style === 'tower';
    baysField.style.display = tower ? '' : 'none';
    levelsField.style.display = tower ? '' : 'none';
    bayWField.style.display = tower ? '' : 'none';
    tiltField.style.display = tower ? '' : 'none';
    matField.style.display = tower ? '' : 'none';
    baseSw.parentElement.style.display = tower ? '' : 'none';
    acrylicSw.parentElement.style.display = tower ? '' : 'none';
    tBaysField.style.display = tower ? 'none' : '';
    tBayWField.style.display = tower ? 'none' : '';
    glassSw.parentElement.style.display = tower ? 'none' : '';

    const fmt = (key, unit, digits) => {
      const v = c[key];
      return (digits ? v.toFixed(digits) : v) + unit;
    };
    const bindNum = (field, key, unit, digits, dragStep) => {
      const n = field.querySelector('[data-num]');
      if (!n) return;
      n.textContent = fmt(key, unit, digits);
      n.dataset.drag = key;
      n.dataset.step = dragStep;
    };
    bindNum(baysField, 'bays', ' 跨');
    bindNum(levelsField, 'levels', ' 层');
    bindNum(bayWField, 'bayW', ' m', 2, '0.05');
    bindNum(depthField, 'depth', ' m', 2, '0.01');
    bindNum(tiltField, 'tilt', '°');
    bindNum(tBaysField, 'tBays', ' 节');
    bindNum(tBayWField, 'tBayW', ' m', 2, '0.05');
    const bindBtns = (field, key) => {
      if (!field) return;
      const lim = bookshelfStore.limits[key];
      if (!lim) return;
      const lo = field.querySelector(`[data-act="${key}-"]`);
      const hi = field.querySelector(`[data-act="${key}+"]`);
      if (lo) lo.disabled = c[key] <= lim[0];
      if (hi) hi.disabled = c[key] >= lim[1];
    };
    bindBtns(baysField, 'bays');
    bindBtns(levelsField, 'levels');
    bindBtns(bayWField, 'bayW');
    bindBtns(depthField, 'depth');
    bindBtns(tiltField, 'tilt');
    bindBtns(tBaysField, 'tBays');
    bindBtns(tBayWField, 'tBayW');

    styleSeg.setAttribute('role', 'radiogroup');
    matSeg.setAttribute('role', 'radiogroup');
    styleSeg.querySelectorAll('button').forEach(b => {
      b.setAttribute('role', 'radio');
      const on = b.dataset.val === c.style;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    matSeg.querySelectorAll('button').forEach(b => {
      b.setAttribute('role', 'radio');
      const on = b.dataset.val === c.panelMat;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    booksSw.parentElement.style.display = tower ? '' : 'none';
    booksSw.classList.toggle('on', c.books);
    booksSw.setAttribute('aria-checked', String(c.books));
    wiresSw.classList.toggle('on', c.wires);
    wiresSw.setAttribute('aria-checked', String(c.wires));
    baseSw.classList.toggle('on', c.base);
    baseSw.setAttribute('aria-checked', String(c.base));
    acrylicSw.classList.toggle('on', c.acrylic);
    acrylicSw.setAttribute('aria-checked', String(c.acrylic));
    glassSw.classList.toggle('on', c.glassTop);
    glassSw.setAttribute('aria-checked', String(c.glassTop));
    swatches.querySelectorAll('.swatch').forEach(s => {
      const on = s.dataset.color === c.color;
      s.classList.toggle('on', on);
      s.setAttribute('aria-pressed', String(on));
    });
  }
  syncSpecs(state);
  const unsub = bookshelfStore.subscribe(syncSpecs);

  function updateStats(stats) {
    if (!stats) return;
    updatePriceBlock(priceBlock, stats);
    const env = stats.envelope;
    if (env) {
      spec.querySelector('[data-spec="w"]').innerHTML = env.W.toFixed(2) + '<small>m</small>';
      spec.querySelector('[data-spec="h"]').innerHTML = env.H.toFixed(2) + '<small>m</small>';
      spec.querySelector('[data-spec="d"]').innerHTML = env.D.toFixed(2) + '<small>m</small>';
    }
    spec.querySelector('[data-spec="p"]').innerHTML = stats.partCount.toLocaleString('zh-CN') + '<small>件</small>';
    priceBlock.querySelector('[data-weight]').textContent = `含拉索与基座 · 零件 ${stats.partCount.toLocaleString('zh-CN')} 件`;
  }
  function dispose() {
    unsub();
    if (dragCleanup) { dragCleanup(); dragCleanup = null; }
    container.remove();
  }
  return { updateStats, weightEl: priceBlock.querySelector('[data-weight]'), dispose };
}
