// 面板分区装饰（接线层后处理）：panel.js 为原封文件，分区标题 / 行布局类名在这里注入。
// 只做 DOM 搬家与 class 加注，不删改任何带数据绑定的节点（spec/stepper/seg/list 的引用
// 仍由原封 panel.js 持有，移动节点不影响其查询与订阅）。
export function decoratePanel(root) {
  if (!root || root.dataset.decorated) return;
  root.dataset.decorated = '1';

  const head = (text, en) => {
    const h = document.createElement('div');
    h.className = 'sec-head';
    h.innerHTML = `<span class="t">${text}</span><span class="en">${en}</span>`;
    return h;
  };
  const rule = () => {
    const r = document.createElement('hr');
    r.className = 'sec-rule';
    return r;
  };
  const before = (node, ...els) => {
    if (!node || !node.parentNode) return;
    for (const e of els) node.parentNode.insertBefore(e, node);
  };

  // 跨数 / 层数：label 与 stepper 同行（左文右控件）
  for (const key of ['bays', 'levels']) {
    const st = root.querySelector(`.stepper[data-step="${key}"]`);
    if (st && st.parentElement) st.parentElement.classList.add('field-row');
  }

  // 基本尺寸（规格读数）
  before(root.querySelector('.spec-grid'), head('基本尺寸', 'DIMENSIONS'));

  // 层级配置（panel.js 已在 spec-grid 后放了一条 sec-rule，此处只补标题）
  const baysField = root.querySelector('.stepper[data-step="bays"]')?.parentElement;
  before(baysField, head('层级配置', 'GRID'));

  // 型材系列 / 装配模型：原标题与分区标题重复，移除原 field-label
  for (const [segKey, text, en] of [['series', '型材系列', 'PROFILE'], ['frameMode', '装配模型', 'ASSEMBLY']]) {
    const field = root.querySelector(`[data-seg="${segKey}"]`)?.closest('.seg')?.parentElement;
    if (!field) continue;
    before(field, rule(), head(text, en));
    field.querySelector(':scope > .field-label')?.remove();
  }

  // 层板 / 跨度：分区标题接管 field-label；标题插入字段内部首位，
  // 摘要 .val 挪进标题行（仍留在字段子树内，panel.js 的 querySelector 可达）
  for (const [listSel, text, en] of [['.level-list', '层板配置', 'DECKS'], ['.bay-list', '跨度配置', 'SPANS']]) {
    const field = root.querySelector(listSel)?.parentElement;
    if (!field) continue;
    const label = field.querySelector(':scope > .field-label');
    const val = label?.querySelector('.val');
    const h = head(text, en);
    if (val) h.appendChild(val);
    before(field, rule());
    field.insertBefore(h, field.firstChild);
    label?.remove();
  }

  // 外观与配件（侧挡板 / 背板颜色 / 摆件 / 阳极氧化）
  before(root.querySelector('.switch-row'), rule(), head('外观与配件', 'FINISH'));

  // 价格
  before(root.querySelector('.price-block'), rule(), head('价格', 'PRICE'));

  // ---- 键盘可访问性与语义注入（panel.js 原封，在装饰层统一增强）----
  const switches = root.querySelectorAll('.switch[role="switch"]');
  switches.forEach(sw => {
    sw.tabIndex = 0;
    const syncChecked = () => sw.setAttribute('aria-checked', String(sw.classList.contains('on')));
    syncChecked();
    sw.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        sw.click();
        syncChecked();
      }
    });
  });

  const segs = root.querySelectorAll('.seg');
  segs.forEach(seg => {
    seg.setAttribute('role', 'radiogroup');
    const syncRadio = () => {
      seg.querySelectorAll('button').forEach(btn => {
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(btn.classList.contains('on')));
      });
    };
    syncRadio();
    seg.addEventListener('click', () => setTimeout(syncRadio, 0));
  });

  // 系统诊断信息按钮挂入文末
  if (!root.querySelector('#btn-diag-copy')) {
    const diagWrap = document.createElement('div');
    diagWrap.className = 'panel-diag-row';
    diagWrap.innerHTML = `<button type="button" class="btn-diag" id="btn-diag-copy" aria-label="一键复制系统诊断信息">复制系统诊断信息</button>`;
    diagWrap.querySelector('#btn-diag-copy').addEventListener('click', () => {
      window.__ALU_COPY_DIAG && window.__ALU_COPY_DIAG();
    });
    root.appendChild(diagWrap);
  }
}
