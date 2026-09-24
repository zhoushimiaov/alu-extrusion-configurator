// 周转箱收纳架配置面板（tab 第四产品）
import { CRATE_SCHEMES, LIMITS as CRATES_LIMITS, DEFAULT_CRATES_CONFIG, INSTALL_STEPS_CRATES } from '../config/crates.js';
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

const clampCfg = makeClamp(CRATES_LIMITS, DEFAULT_CRATES_CONFIG);
let state = { ...DEFAULT_CRATES_CONFIG };
const subs = new Set();
export const cratesStore = {
  limits: CRATES_LIMITS,
  installSteps: INSTALL_STEPS_CRATES,
  get: () => state,
  set(patch) {
    const next = clampCfg({ ...state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

export function calcCratesPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}

let dragCleanup = null;
export function createCratesPanel(root, actions) {
  // 面板挂到独立容器：dispose 时整体摘除，旧面板的 root 级监听器随之脱离文档
  const container = el('div');
  root.appendChild(container);
  const mount = container;
  mount.appendChild(el('div', 'panel-title',
    `周转箱收纳架<span class="en">CRATE STORAGE RACK</span>`));
  mount.appendChild(el('p', 'panel-lead',
    '2040 铝架 + 抽拉式物流周转箱：层数可调、箱色自由搭配，满载可推行。'));

  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">宽 W</div><div class="v" data-spec="w">0.66<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-spec="h">1.10<small>m</small></div></div>
    <div class="spec-cell"><div class="k">深 D</div><div class="v" data-spec="d">0.48<small>m</small></div></div>
    <div class="spec-cell"><div class="k">零件</div><div class="v" data-spec="p">0<small>件</small></div></div>`);
  mount.appendChild(spec);
  mount.appendChild(el('hr', 'sec-rule'));

  const mkStepper = (label, key, step) => {
    const f = el('div', null, `
      <div class="field-label"><span>${label}</span></div>
      <div class="stepper">
        <button data-act="${key}-" aria-label="减少">−</button>
        <span class="num" data-num="${key}"></span>
        <button data-act="${key}+" aria-label="增加">＋</button>
      </div>`);
    f.dataset.step = step;
    return f;
  };
  const wField = mkStepper('宽度 WIDTH', 'w', '0.05');
  mount.appendChild(wField);
  const dField = mkStepper('深度 DEPTH', 'd', '0.05');
  mount.appendChild(dField);
  const hField = mkStepper('立柱长度 HEIGHT', 'h', '0.05');
  mount.appendChild(hField);
  const tField = mkStepper('层数 TIERS', 't', '1');
  mount.appendChild(tField);

  dragCleanup && dragCleanup();
  dragCleanup = attachDragSlider(mount, {
    get: () => cratesStore.get(),
    set: (patch) => cratesStore.set(patch),
    limits: CRATES_LIMITS,
  });

  // 配色方案
  const schemeField = el('div', null, `<div class="field-label"><span>箱体配色 SCHEME</span></div>`);
  const schemeSeg = el('div', 'seg');
  for (const key of Object.keys(CRATE_SCHEMES)) {
    const b = el('button', null, CRATE_SCHEMES[key].label);
    b.dataset.seg = 'scheme'; b.dataset.val = key;
    schemeSeg.appendChild(b);
  }
  schemeField.appendChild(schemeSeg);
  mount.appendChild(schemeField);

  // 开关
  const mkSwitch = (label, key) => {
    const rowEl = el('div', 'switch-row', `<span class="label">${label}</span>`);
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
    rowEl.appendChild(sw);
    return { rowEl, sw };
  };
  const pullSw = mkSwitch('抽拉展示（层间交错抽出）', 'pullOut');
  mount.appendChild(pullSw.rowEl);
  const casterSw = mkSwitch('万向轮底盘（取消则用调平地脚）', 'casters');
  mount.appendChild(casterSw.rowEl);

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
      ${INSTALL_STEPS_CRATES.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  mount.appendChild(install);

  const diagWrap = el('div', 'panel-diag-row', `<button type="button" class="btn-diag" aria-label="一键复制系统诊断信息">复制系统诊断信息</button>`);
  diagWrap.querySelector('.btn-diag').addEventListener('click', () => { window.__ALU_COPY_DIAG && window.__ALU_COPY_DIAG(); });
  mount.appendChild(diagWrap);

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .switch');
    if (!btn) return;
    const c = cratesStore.get();
    const lim = cratesStore.limits;
    const bump = (key, act, step, isInt) => {
      const [lo, hi] = lim[key];
      let v = act === '+' ? c[key] + step : c[key] - step;
      v = Math.min(hi, Math.max(lo, +v.toFixed(2)));
      if (isInt) v = Math.round(v);
      cratesStore.set({ [key]: v });
    };
    if (btn.dataset.act === 'w+') bump('width', '+', 0.05);
    if (btn.dataset.act === 'w-') bump('width', '-', 0.05);
    if (btn.dataset.act === 'd+') bump('depth', '+', 0.05);
    if (btn.dataset.act === 'd-') bump('depth', '-', 0.05);
    if (btn.dataset.act === 'h+') bump('height', '+', 0.05);
    if (btn.dataset.act === 'h-') bump('height', '-', 0.05);
    if (btn.dataset.act === 't+') bump('tiers', '+', 1, true);
    if (btn.dataset.act === 't-') bump('tiers', '-', 1, true);
    if (btn.dataset.seg === 'scheme') cratesStore.set({ scheme: btn.dataset.val });
    if (btn.dataset.sw) cratesStore.set({ [btn.dataset.sw]: !c[btn.dataset.sw] });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(cratesStore.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(cratesStore.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(cratesStore.get());
  });

  function markDrag(field, key, step) {
    const n = field.querySelector('[data-num]');
    n.dataset.drag = key;
    n.dataset.step = step;
  }
  markDrag(wField, 'width', '0.05');
  markDrag(dField, 'depth', '0.05');
  markDrag(hField, 'height', '0.05');
  markDrag(tField, 'tiers', '1');

  function syncSpecs(c) {
    spec.querySelector('[data-spec="w"]').innerHTML = (c.width + 0.06).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="h"]').innerHTML = (c.height + 0.20).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="d"]').innerHTML = (c.depth + 0.16).toFixed(2) + '<small>m</small>';
    const conf = [['width', wField, 'w'], ['depth', dField, 'd'], ['height', hField, 'h'], ['tiers', tField, 't']];
    for (const [key, field, act] of conf) {
      const n = field.querySelector('[data-num]');
      n.textContent = key === 'tiers' ? c[key] + ' 层' : c[key].toFixed(2) + ' m';
      const [lo, hi] = cratesStore.limits[key];
      field.querySelector(`[data-act="${act}-"]`).disabled = c[key] <= lo;
      field.querySelector(`[data-act="${act}+"]`).disabled = c[key] >= hi;
    }
    schemeSeg.setAttribute('role', 'radiogroup');
    schemeSeg.querySelectorAll('button').forEach(b => {
      b.setAttribute('role', 'radio');
      const on = b.dataset.val === c.scheme;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    pullSw.sw.classList.toggle('on', c.pullOut);
    pullSw.sw.setAttribute('aria-checked', String(c.pullOut));
    casterSw.sw.classList.toggle('on', c.casters);
    casterSw.sw.setAttribute('aria-checked', String(c.casters));
  }
  syncSpecs(state);
  const unsub = cratesStore.subscribe(syncSpecs);

  function updateStats(stats) {
    if (!stats) return;
    updatePriceBlock(priceBlock, stats);
    spec.querySelector('[data-spec="p"]').innerHTML = stats.partCount.toLocaleString('zh-CN') + '<small>件</small>';
    priceBlock.querySelector('[data-weight]').textContent = `含轮与角件 · 零件 ${stats.partCount.toLocaleString('zh-CN')} 件`;
  }
  function dispose() {
    unsub();
    if (dragCleanup) { dragCleanup(); dragCleanup = null; }
    container.remove();
  }
  return { updateStats, weightEl: priceBlock.querySelector('[data-weight]'), dispose };
}
