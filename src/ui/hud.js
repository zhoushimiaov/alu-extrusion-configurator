// 视口 HUD：左下读数 + 底部居中浮动控件条（型材架 / 光轴展架双形态自适应）
import { PROFILE_SERIES, DECK_TYPES } from '../config/product.js';
import { BACK_TYPES, SHELF_TYPES } from '../config/rodrack.js';

// 细线图标（stroke=currentColor），文字名走 aria-label / title（冒烟测试按名字找按钮）
const svg = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  front: svg('<rect x="5" y="4" width="14" height="16"/>'),
  side: svg('<path d="M5 7h10v13H5z"/><path d="M15 7l4-3v13l-4 3"/>'),
  iso: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>'),
  slot: svg('<rect x="4" y="4" width="16" height="16"/><path d="M10 4v5h4V4"/>'),
  node: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'),
  explode: svg('<rect x="9.5" y="9.5" width="5" height="5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>'),
  spin: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 3.5V8h-4.5"/>'),
};

export function createHud(hudLeft, hudRight, actions) {
  const readout = document.createElement('div');
  hudLeft.appendChild(readout);

  function syncReadout(c, stats) {
    const nodeButton=hudRight.querySelector('[data-view="node"]');
    if(nodeButton) nodeButton.hidden=c.bays===undefined;
    // 窄屏（移动端）：HUD 精简为第一行核心读数（去掉自重/总长第二行），
    // 避免右上角读数块过大压住模型。判断用视口宽（hudLeft 的容器宽）。
    const narrow = (hudLeft.parentElement?.getBoundingClientRect().width || 9999) < 620;
    // 窄屏精简：只生成第一行核心读数（无自重/总长第二行），避免右上角读数块过大
    if (narrow) {
      const w2 = c.width !== undefined ? `宽 <b>${c.width.toFixed(2)} m</b>` : '';
      const d2 = c.depth !== undefined ? ` · 深 <b>${c.depth.toFixed(2)} m</b>` : '';
      const h2 = c.height !== undefined ? ` · 高 <b>${c.height.toFixed(2)} m</b>` : '';
      if (c.drawers !== undefined) { readout.innerHTML = `<div class="rl rl-a">光轴挂衣架 · ${w2}${d2}${h2} · <b>${c.drawers} 层抽屉</b></div>`; return; }
      if (c.cabinetH !== undefined) { readout.innerHTML = `<div class="rl rl-a">光轴木展车 · ${w2}${h2} · ${c.shelves} 层板</div>`; return; }
      if (c.scheme !== undefined) { readout.innerHTML = `<div class="rl rl-a">周转箱收纳架 · <b>${c.tiers} 层</b> · ${w2}${d2}</div>`; return; }
      if (c.midAcrylic !== undefined) { readout.innerHTML = `<div class="rl rl-a">移动边几 · ${w2}${d2}${h2}</div>`; return; }
      if (c.backPanel !== undefined && c.bays === undefined) { readout.innerHTML = `<div class="rl rl-a">柱距 <b>${c.width.toFixed(2)}</b> × 柱长 <b>${c.height.toFixed(2)} m</b></div>`; return; }
      // 型材架
      const counts = {};
      for (const d of c.decks) counts[d] = (counts[d] || 0) + 1;
      const deckText = Object.keys(counts).length === 1 ? DECK_TYPES[c.decks[0]].label : Object.entries(counts).map(([k, n]) => `${DECK_TYPES[k].label}${n}`).join(' / ');
      readout.innerHTML = `<div class="rl rl-a"><b>${c.bays} × ${c.levels}</b> 网格 · ${PROFILE_SERIES[c.series].label} · ${deckText}</div>`;
      return;
    }
    if (c.drawers !== undefined) {
      // 光轴挂衣架
      readout.innerHTML =
        `<div class="rl rl-a">光轴挂衣架 · 宽 <b>${c.width.toFixed(2)} m</b> · 深 <b>${c.depth.toFixed(2)} m</b> · 高 <b>${c.height.toFixed(2)} m</b> · ${c.drawers} 层抽屉 · ${c.wheels ? "滚轮" : "地脚"}</div>` +
        `<div class="rl rl-b">自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 光轴总长 <b>${stats.profileLengthM.toFixed(1)} m</b></div>`;
      return;
    }
    if (c.cabinetH !== undefined) {
      // 光轴木展车
      readout.innerHTML =
        `<div class="rl rl-a">光轴木展车 · 宽 <b>${c.width.toFixed(2)} m</b> · 高 <b>${c.height.toFixed(2)} m</b> · ${c.shelves} 块层板${c.pegboard ? ' · 洞洞板' : ''}${c.topRail ? ' · 顶挂杆' : ''}</div>` +
        `<div class="rl rl-b">自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 光轴总长 <b>${stats.profileLengthM.toFixed(1)} m</b></div>`;
      return;
    }
    if (c.scheme !== undefined) {
      // 周转箱收纳架
      readout.innerHTML =
        `<div class="rl rl-a">周转箱收纳架 · ${c.tiers} 层 · 宽 <b>${c.width.toFixed(2)} m</b> · 深 <b>${c.depth.toFixed(2)} m</b> · ${c.casters ? "滚轮" : "地脚"}</div>` +
        `<div class="rl rl-b">自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 型材总长 <b>${stats.profileLengthM.toFixed(1)} m</b></div>`;
      return;
    }
    if (c.midAcrylic !== undefined) {
      // 移动边几
      readout.innerHTML =
        `<div class="rl rl-a">移动边几 · 宽 <b>${c.width.toFixed(2)} m</b> · 深 <b>${c.depth.toFixed(2)} m</b> · 高 <b>${c.height.toFixed(2)} m</b>` +
        `${c.glassTop ? ' · 玻璃台面' : ''}${c.midAcrylic !== 'none' ? ' · 中板' : ''}${c.rodRails ? ' · 挂杆' : ''}</div>` +
        `<div class="rl rl-b">自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 型材总长 <b>${stats.profileLengthM.toFixed(1)} m</b></div>`;
      return;
    }
    if (c.backPanel !== undefined && c.bays === undefined) {
      // 光轴展架
      const tags = [BACK_TYPES[c.backPanel].label];
      if (c.shelf && c.shelf !== 'none') tags.push(SHELF_TYPES[c.shelf].label);
      if (c.casters) tags.push('滚轮');
      readout.innerHTML =
        `<div class="rl rl-a">光轴展架 · 柱距 <b>${c.width.toFixed(2)} m</b> · 柱长 <b>${c.height.toFixed(2)} m</b> · ${tags.join(' / ')}</div>` +
        `<div class="rl rl-b">自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 光轴总长 <b>${stats.profileLengthM.toFixed(1)} m</b></div>`;
      return;
    }
    // 型材架：三行极简层级——配置 / 体量 / 免责
    const counts = {};
    for (const d of c.decks) counts[d] = (counts[d] || 0) + 1;
    const deckText = Object.keys(counts).length === 1
      ? DECK_TYPES[c.decks[0]].label
      : Object.entries(counts).map(([k, n]) => `${DECK_TYPES[k].label} ×${n}`).join(' / ');
    const backCount = (c.backs || []).filter(x => x !== 'none').length;
    const backText = c.sidePanels ? (backCount === c.levels ? '背板 全' : `背板 ${backCount}/${c.levels}`) : '无背板';
    readout.innerHTML =
      `<div class="rl rl-a"><b>${c.bays} × ${c.levels}</b> 网格 · ${PROFILE_SERIES[c.series].label} 型材 · 层板 ${deckText} · ${backText}</div>` +
      `<div class="rl rl-b">自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 主型材总长 <b>${stats.profileLengthM.toFixed(1)} m</b></div>` +
      `<div class="rl rl-c">节点与隐藏连接为示意 · 不作为加工、采购或承重依据</div>`;
  }

  // 底部居中浮动控件条：视角图标组 + 爆炸 / 自转开关
  const viewGroup = document.createElement('div');
  viewGroup.className = 'chip-group';
  const views = [['front', '正视'], ['side', '侧视'], ['iso', '轴测'], ['slot', '槽口'], ['node', '节点近看']];
  for (const [key, label] of views) {
    const b = document.createElement('button');
    b.className = 'chip' + (key === 'iso' ? ' on' : '');
    b.innerHTML = ICONS[key];
    b.title = label;
    b.setAttribute('aria-label', label);
    b.dataset.view = key;
    b.addEventListener('click', () => {
      viewGroup.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
      actions.setView(key);
    });
    viewGroup.appendChild(b);
  }
  hudRight.appendChild(viewGroup);

  const boom = document.createElement('button');
  boom.className = 'chip-toggle';
  boom.innerHTML = ICONS.explode;
  boom.title = '爆炸';
  boom.setAttribute('aria-label', '爆炸');
  boom.addEventListener('click', () => {
    const on = !boom.classList.contains('on');
    boom.classList.toggle('on', on);
    actions.setExplode(on);
  });
  hudRight.appendChild(boom);

  const spin = document.createElement('button');
  spin.className = 'chip-toggle';
  spin.innerHTML = ICONS.spin;
  spin.title = '自转';
  spin.setAttribute('aria-label', '自转');
  spin.addEventListener('click', () => {
    const on = !spin.classList.contains('on');
    spin.classList.toggle('on', on);
    actions.setSpin(on);
  });
  hudRight.appendChild(spin);

  return { syncReadout };
}
