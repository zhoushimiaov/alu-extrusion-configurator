// 右侧配置面板：编辑风 DOM 生成 + store 双向绑定（含逐层/逐跨编辑器）
import { PROFILE_SERIES, DECK_TYPES, COLORS, FRAME_MODES, DEFAULT_BAY_WIDTH, PANEL_COLORS } from '../config/product.js';
import { store } from './store.js';
import { DEPTH } from '../config/product.js';
import { PRICE_MARKET_HTML, updatePriceBlock } from './priceview.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

export function createPanel(root, actions) {
  const cfg = store.get();

  // 标题（双语 + 宋体导语）
  root.appendChild(el('div', 'panel-title',
    `工业铝型材置物架<span class="en">MODULAR ALUMINIUM SHELF SYSTEM</span>`));
  root.appendChild(el('p', 'panel-lead',
    '以 2020 / 2040 型材为骨架，逐层逐跨自由规划；算料、报价与安装说明随配置实时生成。'));

  // 规格读数（项目信息栏式）
  const spec = el('div', 'spec-grid', `
    <div class="spec-cell"><div class="k">宽度 W</div><div class="v" data-spec="w">0.00<small>m</small></div></div>
    <div class="spec-cell"><div class="k">高度 H</div><div class="v" data-spec="h">0.00<small>m</small></div></div>
    <div class="spec-cell"><div class="k">深度 D</div><div class="v" data-spec="d">0.40<small>m</small></div></div>
    <div class="spec-cell"><div class="k">零件</div><div class="v" data-spec="p">0<small>件</small></div></div>`);
  root.appendChild(spec);

  root.appendChild(el('hr', 'sec-rule'));

  // 跨数 / 层数
  const baysField = el('div', null, `
    <div class="field-label"><span>跨数 BAYS</span></div>
    <div class="stepper" data-step="bays">
      <button data-act="bays-" aria-label="减少一跨">−</button>
      <span class="num" data-num="bays">6</span>
      <button data-act="bays+" aria-label="增加一跨">＋</button>
    </div>`);
  root.appendChild(baysField);

  const lvField = el('div', null, `
    <div class="field-label"><span>层数 LEVELS</span></div>
    <div class="stepper" data-step="levels">
      <button data-act="levels-" aria-label="减少一层">−</button>
      <span class="num" data-num="levels">6</span>
      <button data-act="levels+" aria-label="增加一层">＋</button>
    </div>`);
  root.appendChild(lvField);

  // 型材系列
  const seriesField = el('div', null, `<div class="field-label"><span>型材系列 PROFILE</span></div>`);
  const seriesSeg = el('div', 'seg');
  for (const key of Object.keys(PROFILE_SERIES)) {
    const b = el('button', null, PROFILE_SERIES[key].label);
    b.dataset.seg = 'series'; b.dataset.val = key;
    seriesSeg.appendChild(b);
  }
  seriesField.appendChild(seriesSeg);
    root.appendChild(seriesField);

  const frameField = el('div', null, `<div class="field-label"><span>装配模型 ASSEMBLY</span></div>`);
  const frameSeg = el('div', 'seg');
  for (const key of Object.keys(FRAME_MODES)) {
    const b = el('button', null, FRAME_MODES[key].label);
    b.dataset.seg = 'frameMode'; b.dataset.val = key;
    frameSeg.appendChild(b);
  }
  frameField.appendChild(frameSeg);
  root.appendChild(frameField);

  // 逐层层板编辑器
  const deckField = el('div');
  deckField.appendChild(el('div', 'field-label', `<span>逐层层板 DECKS</span><span class="val" data-deck-summary></span>`));
  const levelList = el('div', 'level-list');
  deckField.appendChild(levelList);
  root.appendChild(deckField);

  // 逐跨宽度编辑器
  const bayField = el('div');
  bayField.appendChild(el('div', 'field-label', `<span>逐跨宽度 SPANS</span><span class="val" data-bay-summary></span>`));
  const bayList = el('div', 'bay-list');
  bayField.appendChild(bayList);
  root.appendChild(bayField);

  // 侧挡板
  const sideRow = el('div', 'switch-row', '<span class="label">背板总开关（逐层可选）</span>');
  const sw = el('div', 'switch');
  sw.setAttribute('role', 'switch');
  sideRow.appendChild(sw);
  root.appendChild(sideRow);

  // 背板配色
  const panelColorField = el('div', null, `<div class="field-label"><span>背板颜色 PANEL</span></div>`);
  const pSwatches = el('div', 'swatches');
  for (const key of Object.keys(PANEL_COLORS)) {
    const s = el('button', 'swatch');
    s.dataset.pcolor = key;
    s.style.background = '#' + PANEL_COLORS[key].hex.toString(16).padStart(6, '0');
    s.title = PANEL_COLORS[key].label;
    s.setAttribute('aria-label', '背板颜色' + PANEL_COLORS[key].label);
    pSwatches.appendChild(s);
  }
  panelColorField.appendChild(pSwatches);
  root.appendChild(panelColorField);

  // 摆件示例
  const propsRow = el('div', 'switch-row', '<span class="label">摆件示例（EL 建筑画册 / 极简雕塑 / 设计花器）</span>');
  const swProps = el('div', 'switch');
  swProps.setAttribute('role', 'switch');
  propsRow.appendChild(swProps);
  root.appendChild(propsRow);

  // 色卡
  const colorField = el('div', null, `<div class="field-label"><span>阳极氧化 ANODIZED</span></div>`);
  const swatches = el('div', 'swatches');
  for (const key of Object.keys(COLORS)) {
    const s = el('button', 'swatch');
    s.dataset.color = key;
    s.style.background = '#' + COLORS[key].hex.toString(16).padStart(6, '0');
    s.title = COLORS[key].label;
    s.setAttribute('aria-label', '阳极氧化' + COLORS[key].label);
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
      <button class="cta-ghost" data-export>导出算料单</button>
      <button class="cta-ghost" data-model>导出 3D 模型 (.glb)</button>
    </div>
    <div class="panel-disclaimer">单价为未核验示例，搜索链接不代表卖家报价；未含运费、税费、加工费，禁止据此直接下单。</div>`);
  root.appendChild(priceBlock);

  // 安装说明（文末折叠区）
  const install = el('details', 'install');
  install.innerHTML = `
    <summary>安装说明<span class="en">INSTALLATION</span></summary>
    <ol>
      ${store.installSteps.map(s => `<li><b>${s.t}</b>${s.d}</li>`).join('')}
    </ol>`;
  root.appendChild(install);

  // ---- 逐层编辑器渲染 ----
  function renderLevelList(c) {
    levelList.innerHTML = '';
    c.decks.forEach((d, k) => {
      const row = el('div', 'level-row');
      row.appendChild(el('span', 'lv-name', `第 ${k + 1} 层`));
      const seg = el('div', 'seg');
      for (const key of Object.keys(DECK_TYPES)) {
        const b = el('button', d === key ? 'on' : null, DECK_TYPES[key].label);
        b.dataset.deckIdx = k;
        b.dataset.deckVal = key;
        seg.appendChild(b);
      }
      row.appendChild(seg);
      // 逐层背板开关（背板总开关关闭时禁用）
      const backOn = c.backs && c.backs[k] !== 'none';
      const bk = el('button', 'back-toggle' + (backOn ? ' on' : ''), '背板');
      bk.dataset.backIdx = k;
      bk.title = `第 ${k + 1} 层背板`;
      bk.setAttribute('aria-label', `第 ${k + 1} 层背板`);
      bk.setAttribute('aria-pressed', String(backOn));
      if (!c.sidePanels) bk.disabled = true;
      row.appendChild(bk);
      levelList.appendChild(row);
    });
    const counts = {};
    c.decks.forEach(d => counts[d] = (counts[d] || 0) + 1);
    deckField.querySelector('[data-deck-summary]').textContent =
      Object.entries(counts).map(([k2, n]) => `${DECK_TYPES[k2].label}${n}`).join(' · ');
  }

  // ---- 逐跨编辑器渲染 ----
  function renderBayList(c) {
    bayList.innerHTML = '';
    c.bayWidths.forEach((w, b) => {
      const row = el('div', 'bay-row');
      row.appendChild(el('span', 'bay-name', `第 ${b + 1} 跨`));
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0.3'; input.max = '1.2'; input.step = '0.01';
      input.value = w.toFixed(2);
      input.addEventListener('change', () => {
        let v = parseFloat(input.value);
        if (!isFinite(v)) v = DEFAULT_BAY_WIDTH;
        v = Math.min(1.2, Math.max(0.3, v));
        const bw = [...store.get().bayWidths];
        bw[b] = v;
        store.set({ bayWidths: bw });
      });
      row.appendChild(input);
      row.appendChild(el('span', 'unit', 'm'));
      bayList.appendChild(row);
    });
    bayField.querySelector('[data-bay-summary]').textContent =
      'Σ ' + c.bayWidths.reduce((a, b) => a + b, 0).toFixed(2) + ' m';
  }

  // ---- 交互绑定（stepper / seg / swatch / cta）----
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const c = store.get();
    const lim = store.limits;
    if (btn.dataset.act === 'bays+') store.set({ bays: Math.min(lim.bays[1], c.bays + 1) });
    if (btn.dataset.act === 'bays-') store.set({ bays: Math.max(lim.bays[0], c.bays - 1) });
    if (btn.dataset.act === 'levels+') store.set({ levels: Math.min(lim.levels[1], c.levels + 1) });
    if (btn.dataset.act === 'levels-') store.set({ levels: Math.max(lim.levels[0], c.levels - 1) });
    if (btn.dataset.seg === 'series') store.set({ series: btn.dataset.val });
    if (btn.dataset.seg === 'frameMode') store.set({ frameMode: btn.dataset.val });
    if (btn.dataset.deckVal) {
      const decks = [...store.get().decks];
      decks[+btn.dataset.deckIdx] = btn.dataset.deckVal;
      store.set({ decks });
    }
    if (btn.dataset.backIdx != null) {
      const backs = [...store.get().backs];
      const i = +btn.dataset.backIdx;
      backs[i] = backs[i] === 'none' ? 'panel' : 'none';
      store.set({ backs });
    }
    if (btn.dataset.color) store.set({ color: btn.dataset.color });
    if (btn.dataset.pcolor) store.set({ panelColor: btn.dataset.pcolor });
    if (btn.dataset.cta != null && actions.onAdd) actions.onAdd(store.get());
    if (btn.dataset.export != null && actions.onExport) actions.onExport(store.get());
    if (btn.dataset.model != null && actions.onExportModel) actions.onExportModel(store.get());
  });
  sw.addEventListener('click', () => store.set({ sidePanels: !store.get().sidePanels }));
  swProps.addEventListener('click', () => store.set({ props: !store.get().props }));

  // ---- 同步 ----
  function syncSpecs(c) {
    const W = c.bayWidths.reduce((a, b) => a + b, 0);
    // 高度须与当前装配模式的真实公式一致（否则右栏读数与 3D 尺寸标注对不上）：
    //   GLB 精确节点：levels*0.46+0.03（见 buildGlbFrame.js glbLayout）
    //   标准参数架：levels*0.45+0.05（见 buildShelf.js: LEVEL_PITCH+POST_H_BASE）
    const H = c.frameMode === 'glb' ? c.levels * 0.46 + 0.03 : c.levels * 0.45 + 0.05;
    spec.querySelector('[data-spec="w"]').innerHTML = W.toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="h"]').innerHTML = H.toFixed(2) + '<small>m</small>';
    spec.querySelector('[data-spec="d"]').innerHTML = DEPTH.toFixed(2) + '<small>m</small>';
    baysField.querySelector('[data-num="bays"]').textContent = c.bays;
    lvField.querySelector('[data-num="levels"]').textContent = c.levels;
    baysField.querySelector('[data-act="bays-"]').disabled = c.bays <= store.limits.bays[0];
    baysField.querySelector('[data-act="bays+"]').disabled = c.bays >= store.limits.bays[1];
    lvField.querySelector('[data-act="levels-"]').disabled = c.levels <= store.limits.levels[0];
    lvField.querySelector('[data-act="levels+"]').disabled = c.levels >= store.limits.levels[1];
    seriesSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.series));
    frameSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.val === c.frameMode));
    sw.classList.toggle('on', c.sidePanels);
    sw.setAttribute('aria-checked', String(c.sidePanels));
    swProps.classList.toggle('on', c.props);
    swProps.setAttribute('aria-checked', String(c.props));
    swatches.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.color === c.color));
    pSwatches.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.pcolor === (c.panelColor || 'galv')));
    renderLevelList(c);
    renderBayList(c);
  }

  syncSpecs(cfg);
  store.subscribe(syncSpecs);

  const weightEl = priceBlock.querySelector('[data-weight]');
  function updateStats(stats) {
    if (!stats) return;
    spec.querySelector('[data-spec="p"]').innerHTML = stats.partCount.toLocaleString('zh-CN') + '<small>件</small>';
    weightEl.textContent = `自重 ${stats.weightKg.toFixed(1)} kg`;
    updatePriceBlock(priceBlock, stats); // 报价随算料实时联动（市场价 × 材料量）
  }
  return { weightEl, updateStats };
}
