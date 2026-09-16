// 光轴展架配置面板（忠实参考模型：单排双柱海报展示架）
// 可调：柱心距、立柱高度、背板形式、底部置物（无/窄托板/镀锌层板）、滚轮、表面
import { BACK_TYPES, SHELF_TYPES, ROD_COLORS, LIMITS as ROD_LIMITS, DEFAULT_ROD_CONFIG, INSTALL_STEPS_ROD, ROD_STYLES } from '../config/rodrack.js';
import { attachDragSlider } from './dragSlider.js';
import { calcMarketPrice } from './marketPrice.js';
import { PRICE_MARKET_HTML, updatePriceBlock } from './priceview.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

let state = { ...DEFAULT_ROD_CONFIG };
const subs = new Set();
export const rodStore = {
  limits: ROD_LIMITS,
  installSteps: INSTALL_STEPS_ROD,
  get: () => state,
  set(patch) {
    const next = { ...state, ...patch };
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

// 报价 = 算料数据 × 市场参考价（淘宝/1688），与型材架同一比价引擎
export function calcRodPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}
const fmt = (n) => '¥ ' + n.toLocaleString('zh-CN');

export function createRodPanel(root, actions) {
  root.appendChild(el('div', 'panel-title',
    `光轴展架<span class="en">CHROME ROD POSTER RACK</span>`));
  root.appendChild(el('p', 'panel-lead',
    '双光轴立柱移动展示架：底部托板或层板、中部背板或海报画面、顶部档杆；滚轮底盘可整体推行。'));

  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">柱距 W</div><div class="v" data-spec="w">0.92<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-spec="h">1.38<small>m</small></div></div>
    <div class="spec-cell"><div class="k">底盘 D</div><div class="v" data-spec="d">0.42<small>m</small></div></div>
    <div class="spec-cell"><div class="k">零件</div><div class="v" data-spec="p">0<small>件</small></div></div>`);
  root.appendChild(spec);
  root.appendChild(el('hr', 'sec-rule'));

  // 柱心距步进
  const mkStepper = (label, plus, minus, numKey, unit) => {
    const f = el('div', null, `
      <div class="field-label"><span>${label}</span></div>
      <div class="stepper">
        <button data-act="${minus}" aria-label="减少">−</button>
        <span class="num" data-num="${numKey}"></span>
        <button data-act="${plus}" aria-label="增加">＋</button>
      </div>`);
    return f;
  };
  const wField = mkStepper('柱心距 WIDTH', 'w+', 'w-', 'w');
  root.appendChild(wField);
  const hField = mkStepper('立柱长度 HEIGHT', 'h+', 'h-', 'h');
  root.appendChild(hField);

  // 数值框水平拖拽（3ds Max 风格）：按住数值左右滑动改值，步长 0.05/0.1
  attachDragSlider(root, {
    get: () => rodStore.get(),
    set: (patch) => rodStore.set(patch),
    limits: ROD_LIMITS,
  });

  // 样式
  const styleField = el('div', null, `<div class="field-label"><span>样式 STYLE</span></div>`);
  const styleSeg = el('div', 'seg');
  for (const key of Object.keys(ROD_STYLES)) {
    const b = el('button', null, ROD_STYLES[key].label);
    b.dataset.seg = 'style'; b.dataset.val = key;
    styleSeg.appendChild(b);
  }
  styleField.appendChild(styleSeg);
  root.appendChild(styleField);

  // 背板
  const backField = el('div', null, `<div class="field-label"><span>背板 BACK PANEL</span></div>`);
  const backSeg = el('div', 'seg');
  for (const key of Object.keys(BACK_TYPES)) {
    const b = el('button', null, BACK_TYPES[key].label);
    b.dataset.seg = 'back'; b.dataset.val = key;
    backSeg.appendChild(b);
  }
  backField.appendChild(backSeg);
  root.appendChild(backField);

  // 底部置物
  const shelfField = el('div', null, `<div class="field-label"><span>底部置物 SHELF</span></div>`);
  const shelfSeg = el('div', 'seg');
  for (const key of Object.keys(SHELF_TYPES)) {
    const b = el('button', null, SHELF_TYPES[key].label);
    b.dataset.seg = 'shelf'; b.dataset.val = key;
    shelfSeg.appendChild(b);
  }
  shelfField.appendChild(shelfSeg);
  root.appendChild(shelfField);

  // 滚轮开关
  const casterRow = el('div', 'switch-row', `<span class="label">滚轮底盘（取消则用调平地脚）</span>`);
  const casterSw = el('div', 'switch');
  casterSw.setAttribute('role', 'switch');
  casterSw.dataset.sw = 'casters';
  casterRow.appendChild(casterSw);
  root.appendChild(casterRow);

  // 配色
  const colorField = el('div', null, `<div class="field-label"><span>表面 FINISH</span></div>`);
  const swatches = el('div', 'swatches');
  for (const key of Object.keys(ROD_COLORS)) {
    const s = el('button', 'swatch');
    s.dataset.color = key;
    s.style.background = '#' + ROD_COLORS[key].hex.toString(16).padStart(6, '0');
    s.title = ROD_COLORS[key].label;
    s.setAttribute('aria-label', ROD_COLORS[key].label);
    swatches.appendChild(s);
  }
  colorField.appendChild(swatches);
  root.appendChild(colorField);

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
      ${INSTALL_STEPS_ROD.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  root.appendChild(install);

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .switch');
    if (!btn) return;
    const c = rodStore.get();
    const lim = rodStore.limits;
    if (btn.dataset.act === 'w+') rodStore.set({ width: Math.min(lim.width[1], +(c.width + 0.05).toFixed(2)) });
    if (btn.dataset.act === 'w-') rodStore.set({ width: Math.max(lim.width[0], +(c.width - 0.05).toFixed(2)) });
    if (btn.dataset.act === 'h+') rodStore.set({ height: Math.min(lim.height[1], +(c.height + 0.1).toFixed(2)) });
    if (btn.dataset.act === 'h-') rodStore.set({ height: Math.max(lim.height[0], +(c.height - 0.1).toFixed(2)) });
    if (btn.dataset.seg === 'style') rodStore.set({ style: btn.dataset.val });
    if (btn.dataset.seg === 'back') rodStore.set({ backPanel: btn.dataset.val });
    if (btn.dataset.seg === 'shelf') rodStore.set({ shelf: btn.dataset.val });
    if (btn.dataset.color) rodStore.set({ color: btn.dataset.color });
    if (btn.dataset.sw) rodStore.set({ [btn.dataset.sw]: !c[btn.dataset.sw] });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(rodStore.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(rodStore.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(rodStore.get());
  });

  // 可拖拽视觉提示
  const style = document.createElement('style');
  style.textContent = '.stepper .num[data-drag] { cursor: ew-resize; } .stepper .num[data-drag]:hover { background: #f7f4ec; }';
  document.head.appendChild(style);

  function syncSpecs(c) {
    spec.querySelector('[data-spec="w"]').innerHTML = (c.width + 0.12).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="h"]').innerHTML = (c.height + 0.18).toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="d"]').innerHTML = '0.42<small>m</small>';
    wField.querySelector('[data-num="w"]').dataset.drag = 'width';
    wField.querySelector('[data-num="w"]').dataset.step = '0.05';
    hField.querySelector('[data-num="h"]').dataset.drag = 'height';
    hField.querySelector('[data-num="h"]').dataset.step = '0.1';
    wField.querySelector('[data-num="w"]').textContent = c.width.toFixed(2) + ' m';
    wField.querySelector('[data-act="w-"]').disabled = c.width <= rodStore.limits.width[0];
    wField.querySelector('[data-act="w+"]').disabled = c.width >= rodStore.limits.width[1];
    hField.querySelector('[data-num="h"]').textContent = c.height.toFixed(2) + ' m';
    hField.querySelector('[data-act="h-"]').disabled = c.height <= rodStore.limits.height[0];
    hField.querySelector('[data-act="h+"]').disabled = c.height >= rodStore.limits.height[1];
    styleSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.style));
    backField.style.display = (c.style === 'poster') ? '' : 'none';
    backSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.backPanel));
    shelfSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.shelf));
    casterSw.classList.toggle('on', c.casters);
    casterSw.setAttribute('aria-checked', String(c.casters));
    swatches.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.color === c.color));
    // 报价由当前算料快照更新。
  }
  syncSpecs(state);
  rodStore.subscribe(syncSpecs);

  function updateStats(stats) {
    if (!stats) return;
    updatePriceBlock(priceBlock, stats);
    spec.querySelector('[data-spec="p"]').innerHTML = stats.partCount.toLocaleString('zh-CN') + '<small>件</small>';
    priceBlock.querySelector('[data-weight]').textContent = `含滚轮与夹块 · 零件 ${stats.partCount.toLocaleString('zh-CN')} 件`;
  }
  return { updateStats, weightEl: priceBlock.querySelector('[data-weight]') };
}
