// 镀锌板书架（GLB 原型）：只提供真实已有的功能，不展示虚构的报价或板件下料。
import { DEFAULT_SHEET_CONFIG, SHEET_ORIGINAL } from '../config/sheet.js';

let state = { ...DEFAULT_SHEET_CONFIG };
const subscribers = new Set();
export const sheetStore = {
  get: () => state,
  set(patch) {
    const next = {
      ...DEFAULT_SHEET_CONFIG,
      showGuides: typeof patch?.showGuides === 'boolean' ? patch.showGuides : state.showGuides,
    };
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
    '第八类结构原型 · 基于上传的「材料柜.glb」展示真实模型。此阶段先保留原有板材形态和构件关系，后续再拆解为可调整的板厚、层数与尺寸。'));

  const specs = el('div', 'spec-grid');
  specs.innerHTML = `
    <div class="spec-cell"><div class="k">总宽 W</div><div class="v" data-sheet-w>4.30<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总高 H</div><div class="v" data-sheet-h>2.35<small>m</small></div></div>
    <div class="spec-cell"><div class="k">总深 D</div><div class="v" data-sheet-d>0.60<small>m</small></div></div>
    <div class="spec-cell"><div class="k">原始网格</div><div class="v" data-sheet-m>44<small>组</small></div></div>`;
  wrapper.appendChild(specs);
  wrapper.appendChild(el('hr', 'sec-rule'));

  const notice = el('p', 'panel-lead',
    '当前为原始模型预览：尺寸来自 GLB 的实际包围盒。原模型含辅助线；暂未完成构件分类、板厚/折边识别与报价规则，因此不能用于加工下料。');
  wrapper.appendChild(notice);
  const label = el('div', 'field-label');
  label.innerHTML = '<span>模型显示 DISPLAY</span>';
  wrapper.appendChild(label);
  const row = el('div', 'switch-row');
  row.appendChild(el('span', 'label', '显示原模型辅助线（14 组）'));
  const sw = el('div', 'switch');
  sw.setAttribute('role', 'switch');
  sw.dataset.sw = 'showGuides';
  sw.tabIndex = 0;
  row.appendChild(sw);
  wrapper.appendChild(row);

  const block = el('div', 'price-block');
  block.innerHTML = `<div class="price-line">
    <span class="price" data-sheet-status>原型预览</span><span class="price-note">暂不报价</span></div>
    <div class="weight-note">原始 GLB 尚未拆件，不能生成可靠的镀锌板下料表、重量或采购估价。</div>
    <div class="action-row">
      <button class="cta" data-cta>加入配置清单</button>
      <button class="cta-ghost" data-model>导出 3D 模型 (.glb)</button>
      <button class="cta-ghost" data-export disabled title="须先完成板件拆解与工程校核">导出算料单（待开发）</button>
    </div>
    <div class="panel-disclaimer">仅为设计原型展示，不构成制造图、加工尺寸或正式报价。</div>`;
  wrapper.appendChild(block);
  const detail = el('details', 'install');
  detail.innerHTML = '<summary>下一阶段<span class="en">ROADMAP</span></summary><ol><li>识别并命名立板、层板、背板和折边节点</li><li>建立板厚、折弯及连接规则</li><li>逐跨、逐层参数化与板材下料</li></ol>';
  wrapper.appendChild(detail);

  function sync(cfg = sheetStore.get()) {
    sw.classList.toggle('on', cfg.showGuides);
    sw.setAttribute('aria-checked', String(cfg.showGuides));
  }
  const toggle = () => sheetStore.set({ showGuides: !sheetStore.get().showGuides });
  sw.addEventListener('click', toggle);
  sw.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  const onAdd = wrapper.querySelector('[data-cta]');
  onAdd.addEventListener('click', () => actions.onAdd(sheetStore.get()));
  wrapper.querySelector('[data-model]').addEventListener('click', actions.onExportModel);
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
    },
    dispose() { unsubscribe(); },
  };
}
