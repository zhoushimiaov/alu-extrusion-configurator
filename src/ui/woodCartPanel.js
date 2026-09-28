// 光轴木展车配置面板（tab 第五产品）
import { WOOD_TONES, LIMITS as WC_LIMITS, DEFAULT_WOODCART_CONFIG, INSTALL_STEPS_WOODCART } from '../config/woodcart.js';
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

const clampCfg = makeClamp(WC_LIMITS, DEFAULT_WOODCART_CONFIG);
let state = { ...DEFAULT_WOODCART_CONFIG };
const subs = new Set();
export const woodcartStore = {
  limits: WC_LIMITS,
  installSteps: INSTALL_STEPS_WOODCART,
  get: () => state,
  set(patch) {
    const next = clampCfg({ ...state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

export function calcWoodCartPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}

let dragCleanup = null;
export function createWoodCartPanel(root, actions) {
  // 面板挂到独立容器：dispose 时整体摘除，旧面板的 root 级监听器随之脱离文档
  const container = el('div');
  root.appendChild(container);
  const mount = container;
  mount.appendChild(el('div', 'panel-title',
    `光轴木展车<span class="en">ROD & PLYWOOD CART</span>`));
  mount.appendChild(el('p', 'panel-lead',
    '光轴 + 胶合板移动展车：柜体收纳、洞洞板背板、中部层板、顶部挂杆，一车多能。'));

  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">宽 W</div><div class="v" data-spec="w">0.86<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-spec="h">2.21<small>m</small></div></div>
    <div class="spec-cell"><div class="k">深 D</div><div class="v" data-spec="d">0.51<small>m</small></div></div>
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
  const hField = mkStepper('立柱总高 HEIGHT', 'h', '0.1');
  mount.appendChild(hField);
  const sField = mkStepper('层板数 SHELVES', 's', '1');
  mount.appendChild(sField);

  dragCleanup && dragCleanup();
  dragCleanup = attachDragSlider(mount, {
    get: () => woodcartStore.get(),
    set: (patch) => {
      // 外伸四向联动：拖拽任一边时四边同步（联动关闭时按单边处理）
      if (woodcartStore.get().ohLink && ('ohF' in patch || 'ohB' in patch || 'ohL' in patch || 'ohR' in patch)) {
        const v = patch.ohF ?? patch.ohB ?? patch.ohL ?? patch.ohR;
        woodcartStore.set({ ohF: v, ohB: v, ohL: v, ohR: v });
      } else {
        woodcartStore.set(patch);
      }
    },
    limits: WC_LIMITS,
  });

  // 木色
  const woodField = el('div', null, `<div class="field-label"><span>板材色调 WOOD</span></div>`);
  const woodSeg = el('div', 'seg');
  for (const key of Object.keys(WOOD_TONES)) {
    const b = el('button', null, WOOD_TONES[key].label);
    b.dataset.seg = 'woodTone'; b.dataset.val = key;
    woodSeg.appendChild(b);
  }
  woodField.appendChild(woodSeg);
  mount.appendChild(woodField);

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
  const pegSw = mkSwitch('洞洞板背板', 'pegboard');
  mount.appendChild(pegSw.rowEl);
  const topSw = mkSwitch('顶部挂杆', 'topRail');
  mount.appendChild(topSw.rowEl);
  const sideSw = mkSwitch('侧向挂杆', 'sideRail');
  mount.appendChild(sideSw.rowEl);
  const casterSw = mkSwitch('万向轮（取消则用调平地脚）', 'casters');
  mount.appendChild(casterSw.rowEl);

  // 板材四向外伸（正数向外扩、负数向内缩；联动开时改一边四边同步）——参考 Alu Designer 台面延伸
  const ohWrap = el('div', null, `<div class="field-label"><span>板材外伸 OVERHANG</span></div>`);
  const ohGrid = el('div');
  ohGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:2px 0 8px;';
  const mkOh = (label, key) => {
    const f = el('div');
    const lab = el('div', 'field-label', `<span>${label}</span>`);
    const st = el('div', 'stepper', `
      <button data-act="${key}-" aria-label="减少">−</button>
      <span class="num" data-num="${key}"></span>
      <button data-act="${key}+" aria-label="增加">＋</button>`);
    f.append(lab, st);
    return f;
  };
  const ohFField = mkOh('前 FRONT', 'ohF');
  const ohBField = mkOh('后 BACK', 'ohB');
  const ohLField = mkOh('左 LEFT', 'ohL');
  const ohRField = mkOh('右 RIGHT', 'ohR');
  ohGrid.append(ohFField, ohBField, ohLField, ohRField);
  ohWrap.appendChild(ohGrid);
  const ohLinkSw = mkSwitch('四边联动', 'ohLink');
  ohWrap.appendChild(ohLinkSw.rowEl);
  mount.appendChild(ohWrap);

  // 价格区
  const priceBlock = el('div', 'price-block', `
    <div class="price-line"><span class="price" data-price>¥ 0</span><span class="price-note">示例材料估价</span></div>
    ${PRICE_MARKET_HTML}
    <div class="weight-note" data-weight>自重计算中 …</div>
    <div class="action-row">
      <button class="cta" data-cta>加入配置清单</button>
      <button class="cta-ghost" data-export title="SpreadsheetML 算料单，支持 Excel / WPS 打开">导出算料单</button>
      <button class="cta-ghost" data-model>导出 3D 模型 (.glb)</button>
      <button class="cta-ghost" data-print title="生成 A4 设计与报价单（浏览器打印 / 另存 PDF）">打印 / 导出 PDF</button>
    </div>
    <div class="panel-disclaimer">承重与报价为演示示例，实际以工程图纸与正式报价单为准。</div>`);
  mount.appendChild(priceBlock);

  const install = el('details', 'install');
  install.innerHTML = `
    <summary>安装说明<span class="en">INSTALLATION</span></summary>
    <ol>
      ${INSTALL_STEPS_WOODCART.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  mount.appendChild(install);

  const diagWrap = el('div', 'panel-diag-row', `<button type="button" class="btn-diag" aria-label="一键复制系统诊断信息">复制系统诊断信息</button>`);
  diagWrap.querySelector('.btn-diag').addEventListener('click', () => { window.__ALU_COPY_DIAG && window.__ALU_COPY_DIAG(); });
  mount.appendChild(diagWrap);

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .switch');
    if (!btn) return;
    const c = woodcartStore.get();
    const lim = woodcartStore.limits;
    const bump = (key, act, step, isInt) => {
      const [lo, hi] = lim[key];
      let v = act === '+' ? c[key] + step : c[key] - step;
      v = Math.min(hi, Math.max(lo, +v.toFixed(2)));
      if (isInt) v = Math.round(v);
      woodcartStore.set({ [key]: v });
    };
    if (btn.dataset.act === 'w+') bump('width', '+', 0.05);
    if (btn.dataset.act === 'w-') bump('width', '-', 0.05);
    if (btn.dataset.act === 'd+') bump('depth', '+', 0.05);
    if (btn.dataset.act === 'd-') bump('depth', '-', 0.05);
    if (btn.dataset.act === 'h+') bump('height', '+', 0.1);
    if (btn.dataset.act === 'h-') bump('height', '-', 0.1);
    if (btn.dataset.act === 's+') bump('shelves', '+', 1, true);
    if (btn.dataset.act === 's-') bump('shelves', '-', 1, true);
    for (const key of ['ohF', 'ohB', 'ohL', 'ohR']) {
      if (btn.dataset.act === key + '+' || btn.dataset.act === key + '-') {
        const dir = btn.dataset.act.endsWith('+') ? 1 : -1;
        const [lo, hi] = lim[key];
        const v = Math.min(hi, Math.max(lo, +(c[key] + dir * 0.01).toFixed(3)));
        if (c.ohLink) woodcartStore.set({ ohF: v, ohB: v, ohL: v, ohR: v });
        else woodcartStore.set({ [key]: v });
      }
    }
    if (btn.dataset.seg === 'woodTone') woodcartStore.set({ woodTone: btn.dataset.val });
    if (btn.dataset.sw) woodcartStore.set({ [btn.dataset.sw]: !c[btn.dataset.sw] });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(woodcartStore.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(woodcartStore.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(woodcartStore.get());
    if (btn.dataset.print != null && actions.onPrint) actions.onPrint(woodcartStore.get());
  });

  function markDrag(field, key, step) {
    const n = field.querySelector('[data-num]');
    n.dataset.drag = key;
    n.dataset.step = step;
  }
  markDrag(wField, 'width', '0.05');
  markDrag(dField, 'depth', '0.05');
  markDrag(hField, 'height', '0.1');
  markDrag(sField, 'shelves', '1');
  markDrag(ohFField, 'ohF', '0.005');
  markDrag(ohBField, 'ohB', '0.005');
  markDrag(ohLField, 'ohL', '0.005');
  markDrag(ohRField, 'ohR', '0.005');

  function syncSpecs(c) {
    const conf = [['width', wField, 'w'], ['depth', dField, 'd'], ['height', hField, 'h'], ['shelves', sField, 's']];
    for (const [key, field, act] of conf) {
      const n = field.querySelector('[data-num]');
      n.textContent = key === 'shelves' ? c[key] + ' 块' : c[key].toFixed(2) + ' m';
      const [lo, hi] = woodcartStore.limits[key];
      field.querySelector(`[data-act="${act}-"]`).disabled = c[key] <= lo;
      field.querySelector(`[data-act="${act}+"]`).disabled = c[key] >= hi;
    }
    woodSeg.setAttribute('role', 'radiogroup');
    woodSeg.querySelectorAll('button').forEach(b => {
      b.setAttribute('role', 'radio');
      const on = b.dataset.val === c.woodTone;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    pegSw.sw.classList.toggle('on', c.pegboard);
    pegSw.sw.setAttribute('aria-checked', String(c.pegboard));
    topSw.sw.classList.toggle('on', c.topRail);
    topSw.sw.setAttribute('aria-checked', String(c.topRail));
    sideSw.sw.classList.toggle('on', c.sideRail);
    sideSw.sw.setAttribute('aria-checked', String(c.sideRail));
    casterSw.sw.classList.toggle('on', c.casters);
    casterSw.sw.setAttribute('aria-checked', String(c.casters));
    for (const [key, field] of [['ohF', ohFField], ['ohB', ohBField], ['ohL', ohLField], ['ohR', ohRField]]) {
      const n = field.querySelector('[data-num]');
      n.textContent = Math.round(c[key] * 1000) + ' mm';
      const [lo, hi] = woodcartStore.limits[key];
      field.querySelector(`[data-act="${key}-"]`).disabled = c[key] <= lo;
      field.querySelector(`[data-act="${key}+"]`).disabled = c[key] >= hi;
    }
    ohLinkSw.sw.classList.toggle('on', c.ohLink);
    ohLinkSw.sw.setAttribute('aria-checked', String(c.ohLink));
  }
  syncSpecs(state);
  const unsub = woodcartStore.subscribe(syncSpecs);

  function updateStats(stats) {
    if (!stats) return;
    updatePriceBlock(priceBlock, stats);
    // 总尺寸唯一数据源：builder 的真实外轮廓（与 3D 尺寸标注同源），不再手写 +常数
    const env = stats.envelope;
    if (env) {
      spec.querySelector('[data-spec="w"]').innerHTML = env.W.toFixed(2) + '<small>m</small>';
      spec.querySelector('[data-spec="h"]').innerHTML = env.H.toFixed(2) + '<small>m</small>';
      spec.querySelector('[data-spec="d"]').innerHTML = env.D.toFixed(2) + '<small>m</small>';
    }
    spec.querySelector('[data-spec="p"]').innerHTML = stats.partCount.toLocaleString('zh-CN') + '<small>件</small>';
    priceBlock.querySelector('[data-weight]').textContent = `含轮与五金 · 零件 ${stats.partCount.toLocaleString('zh-CN')} 件`;
  }
  function dispose() {
    unsub();
    if (dragCleanup) { dragCleanup(); dragCleanup = null; }
    container.remove();
  }
  return { updateStats, weightEl: priceBlock.querySelector('[data-weight]'), dispose };
}
