// 光轴挂衣架配置面板（tab 第六产品）
// 可调：宽 W / 深 D / 总高 H、抽屉层数、滚轮、表面配色
import { HANGER_COLORS, LIMITS as HANGER_LIMITS, DEFAULT_HANGER_CONFIG, INSTALL_STEPS_HANGER } from '../config/hanger.js';
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

const clampCfg = makeClamp(HANGER_LIMITS, DEFAULT_HANGER_CONFIG);
let state = { ...DEFAULT_HANGER_CONFIG };
const subs = new Set();
export const hangerStore = {
  limits: HANGER_LIMITS,
  installSteps: INSTALL_STEPS_HANGER,
  get: () => state,
  set(patch) {
    const next = clampCfg({ ...state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

export function calcHangerPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}

let dragCleanup = null;
export function createHangerPanel(root, actions) {
  // 面板挂到独立容器：dispose 时整体摘除，旧面板的 root 级监听器随之脱离文档
  const container = el('div');
  root.appendChild(container);
  const mount = container;

  mount.appendChild(el('div', 'panel-title',
    `光轴挂衣架<span class="en">ROD CLOTHES HANGER</span>`));
  mount.appendChild(el('p', 'panel-lead',
    '光轴移动挂衣架：四角立柱 + 底柜 + 三层挂杆横杆，抽屉层数可调，滚轮底盘可整体推行。'));

  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">宽 W</div><div class="v" data-spec="w">0.60<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-spec="h">1.90<small>m</small></div></div>
    <div class="spec-cell"><div class="k">深 D</div><div class="v" data-spec="d">0.50<small>m</small></div></div>
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
  const hField = mkStepper('总高 HEIGHT', 'h', '0.1');
  mount.appendChild(hField);
  const drField = mkStepper('抽屉层数 DRAWERS', 't', '1');
  mount.appendChild(drField);

  dragCleanup && dragCleanup();
  dragCleanup = attachDragSlider(mount, {
    get: () => hangerStore.get(),
    set: (patch) => hangerStore.set(patch),
    limits: HANGER_LIMITS,
  });

  // 滚轮开关
  const wheelRow = el('div', 'switch-row', `<span class="label">万向轮底盘（取消则用调平地脚）</span>`);
  const wheelSw = el('div', 'switch');
  wheelSw.setAttribute('role', 'switch');
  wheelSw.dataset.sw = 'wheels';
  wheelRow.appendChild(wheelSw);
  mount.appendChild(wheelRow);

  // 配色
  const colorField = el('div', null, `<div class="field-label"><span>表面 FINISH</span></div>`);
  const swatches = el('div', 'swatches');
  for (const key of Object.keys(HANGER_COLORS)) {
    const s = el('button', 'swatch');
    s.dataset.color = key;
    s.style.background = '#' + HANGER_COLORS[key].hex.toString(16).padStart(6, '0');
    s.title = HANGER_COLORS[key].label;
    s.setAttribute('aria-label', HANGER_COLORS[key].label);
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
      <button class="cta-ghost" data-export>导出算料单 Excel</button>
      <button class="cta-ghost" data-model>导出 3D 模型 (.glb)</button>
    </div>
    <div class="panel-disclaimer">承重与报价为演示示例，实际以工程图纸与正式报价单为准。</div>`);
  mount.appendChild(priceBlock);

  // 安装说明
  const install = el('details', 'install');
  install.innerHTML = `
    <summary>安装说明<span class="en">INSTALLATION</span></summary>
    <ol>
      ${INSTALL_STEPS_HANGER.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  mount.appendChild(install);

  mount.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .switch');
    if (!btn) return;
    const c = hangerStore.get();
    const lim = hangerStore.limits;
    const bump = (key, act, step, isInt) => {
      const [lo, hi] = lim[key];
      let v = act === '+' ? c[key] + step : c[key] - step;
      v = Math.min(hi, Math.max(lo, +v.toFixed(2)));
      if (isInt) v = Math.round(v);
      hangerStore.set({ [key]: v });
    };
    if (btn.dataset.act === 'w+') bump('width', '+', 0.05);
    if (btn.dataset.act === 'w-') bump('width', '-', 0.05);
    if (btn.dataset.act === 'd+') bump('depth', '+', 0.05);
    if (btn.dataset.act === 'd-') bump('depth', '-', 0.05);
    if (btn.dataset.act === 'h+') bump('height', '+', 0.1);
    if (btn.dataset.act === 'h-') bump('height', '-', 0.1);
    if (btn.dataset.act === 't+') bump('drawers', '+', 1, true);
    if (btn.dataset.act === 't-') bump('drawers', '-', 1, true);
    if (btn.dataset.color) hangerStore.set({ color: btn.dataset.color });
    if (btn.dataset.sw) hangerStore.set({ [btn.dataset.sw]: !c[btn.dataset.sw] });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(hangerStore.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(hangerStore.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(hangerStore.get());
  });

  function markDrag(field, key, step) {
    const n = field.querySelector('[data-num]');
    n.dataset.drag = key;
    n.dataset.step = step;
  }
  markDrag(wField, 'width', '0.05');
  markDrag(dField, 'depth', '0.05');
  markDrag(hField, 'height', '0.1');
  markDrag(drField, 'drawers', '1');

  function syncSpecs(c) {
    spec.querySelector('[data-spec="w"]').innerHTML = (c.width + 0.03).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="h"]').innerHTML = (c.height + 0.10).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="d"]').innerHTML = (c.depth + 0.03).toFixed(2) + '<small>m</small>';
    const conf = [['width', wField, 'w'], ['depth', dField, 'd'], ['height', hField, 'h'], ['drawers', drField, 't']];
    for (const [key, field, act] of conf) {
      const n = field.querySelector('[data-num]');
      n.textContent = key === 'drawers' ? c[key] + ' 层' : c[key].toFixed(2) + ' m';
      const [lo, hi] = hangerStore.limits[key];
      field.querySelector(`[data-act="${act}-"]`).disabled = c[key] <= lo;
      field.querySelector(`[data-act="${act}+"]`).disabled = c[key] >= hi;
    }
    wheelSw.classList.toggle('on', c.wheels);
    wheelSw.setAttribute('aria-checked', String(c.wheels));
    swatches.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.color === c.color));
  }
  syncSpecs(state);
  const unsub = hangerStore.subscribe(syncSpecs);

  function updateStats(stats) {
    if (!stats) return;
    updatePriceBlock(priceBlock, stats);
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
