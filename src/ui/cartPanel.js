// 移动边几配置面板（tab 第三产品）
// 可调：柱心距 W/D、立柱高度、顶部玻璃、中层亚克力、光轴挂杆、滚轮、木纹饰面
import { ACRYLIC_TYPES, WOOD_FINISHES, LIMITS as CART_LIMITS, DEFAULT_CART_CONFIG, INSTALL_STEPS_CART } from '../config/cart.js';
import { attachDragSlider } from './dragSlider.js';
import { calcMarketPrice } from './marketPrice.js';
import { PRICE_MARKET_HTML, updatePriceBlock } from './priceview.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

let state = { ...DEFAULT_CART_CONFIG };
const subs = new Set();
export const cartStore = {
  limits: CART_LIMITS,
  installSteps: INSTALL_STEPS_CART,
  get: () => state,
  set(patch) {
    const next = { ...state, ...patch };
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

// 报价 = 算料数据 × 市场参考价（与另两个产品同一比价引擎）
export function calcCartPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}

export function createCartPanel(root, actions) {
  root.appendChild(el('div', 'panel-title',
    `移动边几<span class="en">ROLLING CART TABLE</span>`));
  root.appendChild(el('p', 'panel-lead',
    '铝型材移动边几：木纹立柱 + 钢化玻璃台面 + 橙色亚克力中板 + 光轴挂杆，四轮推行。'));

  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">宽 W</div><div class="v" data-spec="w">0.54<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-spec="h">0.70<small>m</small></div></div>
    <div class="spec-cell"><div class="k">深 D</div><div class="v" data-spec="d">0.44<small>m</small></div></div>
    <div class="spec-cell"><div class="k">零件</div><div class="v" data-spec="p">0<small>件</small></div></div>`);
  root.appendChild(spec);
  root.appendChild(el('hr', 'sec-rule'));

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
  root.appendChild(wField);
  const dField = mkStepper('深度 DEPTH', 'd', '0.05');
  root.appendChild(dField);
  const hField = mkStepper('立柱长度 HEIGHT', 'h', '0.05');
  root.appendChild(hField);

  attachDragSlider(root, {
    get: () => cartStore.get(),
    set: (patch) => cartStore.set(patch),
    limits: CART_LIMITS,
  });

  // 中层板
  const acrField = el('div', null, `<div class="field-label"><span>中层板 MID PANEL</span></div>`);
  const acrSeg = el('div', 'seg');
  for (const key of Object.keys(ACRYLIC_TYPES)) {
    const b = el('button', null, ACRYLIC_TYPES[key].label);
    b.dataset.seg = 'midAcrylic'; b.dataset.val = key;
    acrSeg.appendChild(b);
  }
  acrField.appendChild(acrSeg);
  root.appendChild(acrField);

  // 木纹饰面
  const woodField = el('div', null, `<div class="field-label"><span>立柱饰面 FINISH</span></div>`);
  const woodSeg = el('div', 'seg');
  for (const key of Object.keys(WOOD_FINISHES)) {
    const b = el('button', null, WOOD_FINISHES[key].label);
    b.dataset.seg = 'woodFinish'; b.dataset.val = key;
    woodSeg.appendChild(b);
  }
  woodField.appendChild(woodSeg);
  root.appendChild(woodField);

  // 开关：顶部玻璃 / 光轴挂杆 / 滚轮
  const mkSwitch = (label, key) => {
    const rowEl = el('div', 'switch-row', `<span class="label">${label}</span>`);
    const sw = el('div', 'switch');
    sw.setAttribute('role', 'switch');
    sw.dataset.sw = key;
    rowEl.appendChild(sw);
    return { rowEl, sw };
  };
  const glassSw = mkSwitch('顶部钢化玻璃', 'glassTop');
  root.appendChild(glassSw.rowEl);
  const railSw = mkSwitch('前后光轴挂杆', 'rodRails');
  root.appendChild(railSw.rowEl);
  const casterSw = mkSwitch('万向轮底盘（取消则用调平地脚）', 'casters');
  root.appendChild(casterSw.rowEl);

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
  root.appendChild(priceBlock);

  // 安装说明
  const install = el('details', 'install');
  install.innerHTML = `
    <summary>安装说明<span class="en">INSTALLATION</span></summary>
    <ol>
      ${INSTALL_STEPS_CART.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  root.appendChild(install);

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .switch');
    if (!btn) return;
    const c = cartStore.get();
    const lim = cartStore.limits;
    const bump = (key, act, step) => {
      const [lo, hi] = lim[key];
      const v = act === '+' ? Math.min(hi, +(c[key] + step).toFixed(2)) : Math.max(lo, +(c[key] - step).toFixed(2));
      cartStore.set({ [key]: v });
    };
    if (btn.dataset.act === 'w+') bump('width', '+', 0.05);
    if (btn.dataset.act === 'w-') bump('width', '-', 0.05);
    if (btn.dataset.act === 'd+') bump('depth', '+', 0.05);
    if (btn.dataset.act === 'd-') bump('depth', '-', 0.05);
    if (btn.dataset.act === 'h+') bump('height', '+', 0.05);
    if (btn.dataset.act === 'h-') bump('height', '-', 0.05);
    if (btn.dataset.seg === 'midAcrylic') cartStore.set({ midAcrylic: btn.dataset.val });
    if (btn.dataset.seg === 'woodFinish') cartStore.set({ woodFinish: btn.dataset.val });
    if (btn.dataset.sw) cartStore.set({ [btn.dataset.sw]: !c[btn.dataset.sw] });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(cartStore.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(cartStore.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(cartStore.get());
  });

  // 拖拽数值框 data 属性
  function markDrag(field, key, step) {
    const n = field.querySelector('[data-num]');
    n.dataset.drag = key;
    n.dataset.step = step;
  }
  markDrag(wField, 'width', '0.05');
  markDrag(dField, 'depth', '0.05');
  markDrag(hField, 'height', '0.05');

  function syncSpecs(c) {
    spec.querySelector('[data-spec="w"]').innerHTML = (c.width + 0.06).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="h"]').innerHTML = (c.height + 0.16).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="d"]').innerHTML = (c.depth + 0.06).toFixed(2) + '<small>m</small>';
    for (const [key, field] of [['width', wField], ['depth', dField], ['height', hField]]) {
      const n = field.querySelector('[data-num]');
      n.textContent = c[key].toFixed(2) + ' m';
      const [lo, hi] = cartStore.limits[key];
      field.querySelector(`[data-act="${key === 'width' ? 'w' : key === 'depth' ? 'd' : 'h'}-"]`).disabled = c[key] <= lo;
      field.querySelector(`[data-act="${key === 'width' ? 'w' : key === 'depth' ? 'd' : 'h'}+"]`).disabled = c[key] >= hi;
    }
    acrSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.midAcrylic));
    woodSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.woodFinish));
    glassSw.sw.classList.toggle('on', c.glassTop);
    glassSw.sw.setAttribute('aria-checked', String(c.glassTop));
    railSw.sw.classList.toggle('on', c.rodRails);
    railSw.sw.setAttribute('aria-checked', String(c.rodRails));
    casterSw.sw.classList.toggle('on', c.casters);
    casterSw.sw.setAttribute('aria-checked', String(c.casters));
  }
  syncSpecs(state);
  cartStore.subscribe(syncSpecs);

  function updateStats(stats) {
    if (!stats) return;
    updatePriceBlock(priceBlock, stats);
    spec.querySelector('[data-spec="p"]').innerHTML = stats.partCount.toLocaleString('zh-CN') + '<small>件</small>';
    priceBlock.querySelector('[data-weight]').textContent = `含轮与角件 · 零件 ${stats.partCount.toLocaleString('zh-CN')} 件`;
  }
  return { updateStats, weightEl: priceBlock.querySelector('[data-weight]') };
}
