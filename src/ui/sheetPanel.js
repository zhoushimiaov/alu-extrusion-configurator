// 镀锌板书架：基于真实 GLB 的板金细节预览，不虚构工程 BOM / 报价。
import { DEFAULT_SHEET_CONFIG, SHEET_ORIGINAL, SHEET_THICKNESSES, SHEET_FINISHES } from '../config/sheet.js';

let state = { ...DEFAULT_SHEET_CONFIG };
const subscribers = new Set();
export const sheetStore = {
  get: () => state,
  set(patch) {
    const next = { ...state };
    for (const key of ['showGuides', 'folds', 'fasteners'])
      if (typeof patch?.[key] === 'boolean') next[key] = patch[key];
    if (SHEET_THICKNESSES.includes(patch?.thicknessMm)) next.thicknessMm = patch.thicknessMm;
    if (Object.hasOwn(SHEET_FINISHES, patch?.finish)) next.finish = patch.finish;
    next.schemaVersion = DEFAULT_SHEET_CONFIG.schemaVersion;
    next.kind = 'sheet';
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    subscribers.forEach(fn => fn(state));
  },
  subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSheetPanel(root, actions) {
  const wrapper = el('div');
  root.appendChild(wrapper);
  const title = el('div', 'panel-title');
  title.innerHTML = '镀锌板书架<span class="en">GALVANIZED SHEET SHELVING</span>';
  wrapper.appendChild(title);
  wrapper.appendChild(el('p', 'panel-lead',
    'MEKIT 板金结构研究 · 保留 Rhino 原始造型，增加实体板厚、折边回口与金属连接点。以下为展示级构造深化，非生产下料模型。'));

  const specs = el('div', 'spec-grid');
  specs.innerHTML = `
    <div class="spec-cell"><div class="k">总宽 W</div><div class="v" data-sheet-w>4.30<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-sheet-h>2.35<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总深 D</div><div class="v" data-sheet-d>0.60<small>m</small></div></div>
    <div class="spec-cell"><div class="k">板面网格</div><div class="v" data-sheet-m>44<small>组</small></div></div>`;
  wrapper.appendChild(specs);
  wrapper.appendChild(el('hr', 'sec-rule'));

  const fieldLabel = (text) => {
    const label = el('div', 'field-label');
    const span = el('span', null, text);
    label.appendChild(span);
    wrapper.appendChild(label);
  };
  fieldLabel('板厚 THICKNESS');
  const thicknessButtons = el('div', 'seg');
  thicknessButtons.setAttribute('role', 'group');
  thicknessButtons.setAttribute('aria-label', '板厚');
  for (const mm of SHEET_THICKNESSES) {
    const b = el('button', null, mm.toFixed(1) + ' mm');
    b.type = 'button'; b.dataset.sheetThickness = String(mm);
    thicknessButtons.appendChild(b);
  }
  wrapper.appendChild(thicknessButtons);

  fieldLabel('表面 FINISH');
  const finishButtons = el('div', 'seg');
  finishButtons.setAttribute('role', 'group');
  finishButtons.setAttribute('aria-label', '镀锌板表面');
  for (const [key, value] of Object.entries(SHEET_FINISHES)) {
    const b = el('button', null, value.label);
    b.type = 'button'; b.dataset.sheetFinish = key;
    finishButtons.appendChild(b);
  }
  wrapper.appendChild(finishButtons);

  fieldLabel('构造细节 DETAILS');
  const switches = {};
  for (const [key, name] of [
    ['folds', '板件前缘折边 / 回口（18 mm）'],
    ['fasteners', '金属铆钉与连接点'],
    ['showGuides', '显示 Rhino 辅助线（14 组）'],
  ]) {
    const row = el('div', 'switch-row');
    row.appendChild(el('span', 'label', name));
    const sw = el('div', 'switch');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', name);
    sw.tabIndex = 0; sw.dataset.sheetToggle = key;
    sw.addEventListener('click', () => sheetStore.set({ [key]: !sheetStore.get()[key] }));
    sw.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
    });
    row.appendChild(sw);
    wrapper.appendChild(row);
    switches[key] = sw;
  }

  const notice = el('p', 'panel-lead',
    '原始模型的零厚度曲面已在浏览器中封闭为实体板面；金属折边、铆钉、表面质感是可切换的设计细节，不改变原始 GLB。');
  wrapper.appendChild(notice);

  const block = el('div', 'price-block');
  block.innerHTML = `<div class="price-line">
    <span class="price" data-sheet-status>构造预览</span><span class="price-note">板金细节 · 暂不报价</span></div>
    <div class="weight-note" data-sheet-detail-stats>正在分析板面与连接细节…</div>
    <div class="action-row">
      <button class="cta" data-cta>加入配置清单</button>
      <button class="cta-ghost" data-model>导出深化 3D 模型 (.glb)</button>
      <button class="cta-ghost" data-original>下载原始 GLB</button>
      <button class="cta-ghost" disabled title="须完成板材展开、孔位及连接件校核">导出工程算料单（待开发）</button>
    </div>
    <div class="panel-disclaimer">板厚及折边为展示假设。重量、单价、折弯半径、搭接公差和连接孔位尚未校核，请勿作为加工或采购依据。</div>`;
  wrapper.appendChild(block);

  const detail = el('details', 'install');
  detail.innerHTML = '<summary>后续参数化<span class="en">ROADMAP</span></summary><ol><li>将板件细分为独立立板、层板与折弯件</li><li>准确提取折弯半径与孔位，建立制造节点</li><li>增加板件尺寸、跨数、层数及真实下料统计</li></ol>';
  wrapper.appendChild(detail);

  thicknessButtons.addEventListener('click', e => {
    const mm = Number(e.target.closest('[data-sheet-thickness]')?.dataset.sheetThickness);
    if (SHEET_THICKNESSES.includes(mm)) sheetStore.set({ thicknessMm: mm });
  });
  finishButtons.addEventListener('click', e => {
    const val = e.target.closest('[data-sheet-finish]')?.dataset.sheetFinish;
    if (val && Object.hasOwn(SHEET_FINISHES, val)) sheetStore.set({ finish: val });
  });

  function sync(cfg = sheetStore.get()) {
    for (const [key, sw] of Object.entries(switches)) {
      sw.classList.toggle('on', cfg[key]);
      sw.setAttribute('aria-checked', String(cfg[key]));
    }
    for (const b of thicknessButtons.querySelectorAll('button')) {
      const selected = Number(b.dataset.sheetThickness) === cfg.thicknessMm;
      b.classList.toggle('on', selected); b.setAttribute('aria-pressed', String(selected));
    }
    for (const b of finishButtons.querySelectorAll('button')) {
      const selected = b.dataset.sheetFinish === cfg.finish;
      b.classList.toggle('on', selected); b.setAttribute('aria-pressed', String(selected));
    }
  }
  wrapper.querySelector('[data-cta]').addEventListener('click', () => actions.onAdd(sheetStore.get()));
  wrapper.querySelector('[data-model]').addEventListener('click', actions.onExportModel);
  wrapper.querySelector('[data-original]').addEventListener('click', actions.onExportOriginal);
  const unsubscribe = sheetStore.subscribe(sync);
  sync();
  return {
    lastStats: null,
    updateStats(stats) {
      if (!stats) return;
      const b = stats.envelope || SHEET_ORIGINAL;
      for (const [name, val] of [['w', b.W], ['h', b.H], ['d', b.D]]) {
        const cell = wrapper.querySelector('[data-sheet-' + name + ']');
        if (cell) cell.innerHTML = Number(val).toFixed(2) + '<small>m</small>';
      }
      const count = wrapper.querySelector('[data-sheet-m]');
      if (count) count.innerHTML = (stats.meshCount || SHEET_ORIGINAL.meshCount) + '<small>组</small>';
      const d = stats.displayDetails;
      const stat = wrapper.querySelector('[data-sheet-detail-stats]');
      if (stat) stat.textContent = d
        ? `已实体化 ${d.sheetSurfaces} 组板面 · ${d.thicknessMm.toFixed(1)} mm · 折边 ${d.foldCount} 处 · 铆钉 ${d.fastenerCount} 处`
        : '等待深化模型载入…';
    },
    dispose() { unsubscribe(); },
  };
}
