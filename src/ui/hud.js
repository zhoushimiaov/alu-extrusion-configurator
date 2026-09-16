// 视口 HUD：左下读数 + 右下控件（型材架 / 光轴展架双形态自适应）
import { PROFILE_SERIES, DECK_TYPES } from '../config/product.js';
import { BACK_TYPES, SHELF_TYPES } from '../config/rodrack.js';

export function createHud(hudLeft, hudRight, actions) {
  const readout = document.createElement('div');
  hudLeft.appendChild(readout);

  function syncReadout(c, stats) {
    const nodeButton=hudRight.querySelector('[data-view="node"]');
    if(nodeButton) nodeButton.hidden=c.bays===undefined;
    if (c.cabinetH !== undefined) {
      // 光轴木展车
      readout.innerHTML =
        `光轴木展车 · 宽 <b>${c.width.toFixed(2)} m</b> · 高 <b>${c.height.toFixed(2)} m</b> · ${c.shelves} 块层板${c.pegboard ? ' · 洞洞板' : ''}${c.topRail ? ' · 顶挂杆' : ''}<br>` +
        `自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 光轴总长 <b>${stats.profileLengthM.toFixed(1)} m</b>`;
      return;
    }
    if (c.scheme !== undefined) {
      // 周转箱收纳架
      readout.innerHTML =
        `周转箱收纳架 · <b>${c.tiers} 层</b> · 宽 <b>${c.width.toFixed(2)} m</b> · 深 <b>${c.depth.toFixed(2)} m</b> · <b>${c.casters ? "滚轮" : "地脚"}</b><br>` +
        `自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 型材总长 <b>${stats.profileLengthM.toFixed(1)} m</b>`;
      return;
    }
    if (c.midAcrylic !== undefined) {
      // 移动边几
      readout.innerHTML =
        `移动边几 · 宽 <b>${c.width.toFixed(2)} m</b> · 深 <b>${c.depth.toFixed(2)} m</b> · 高 <b>${c.height.toFixed(2)} m</b>` +
        `${c.glassTop ? ' · 玻璃台面' : ''}${c.midAcrylic !== 'none' ? ' · 中板' : ''}${c.rodRails ? ' · 挂杆' : ''}<br>` +
        `自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 型材总长 <b>${stats.profileLengthM.toFixed(1)} m</b>`;
      return;
    }
    if (c.backPanel !== undefined && c.bays === undefined) {
      // 光轴展架
      const tags = [BACK_TYPES[c.backPanel].label];
      if (c.shelf && c.shelf !== 'none') tags.push(SHELF_TYPES[c.shelf].label);
      if (c.casters) tags.push('滚轮');
      readout.innerHTML =
        `光轴展架 · 柱距 <b>${c.width.toFixed(2)} m</b> · 柱长 <b>${c.height.toFixed(2)} m</b> · <b>${tags.join(' / ')}</b><br>` +
        `自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 光轴总长 <b>${stats.profileLengthM.toFixed(1)} m</b>`;
      return;
    }
    // 型材架
    const counts = {};
    for (const d of c.decks) counts[d] = (counts[d] || 0) + 1;
    const deckText = Object.keys(counts).length === 1
      ? DECK_TYPES[c.decks[0]].label
      : Object.entries(counts).map(([k, n]) => `${DECK_TYPES[k].label} ${n} 层`).join(' / ');
    readout.innerHTML =
      `网格 <b>${c.bays} 跨 × ${c.levels} 层</b> · 型材 <b>${PROFILE_SERIES[c.series].label}</b> · 层板 <b>${deckText}</b><br>` +
      `自重 ≈ <b>${stats.weightKg.toFixed(1)} kg</b> · 主型材总长 <b>${stats.profileLengthM.toFixed(1)} m</b><br><span>节点与隐藏连接为示意 · 不作为加工、采购或承重依据</span>`;
  }

  // 右下控件
  const viewGroup = document.createElement('div');
  viewGroup.className = 'chip-group';
  const views = [['front', '正视'], ['side', '侧视'], ['iso', '轴测'], ['slot', '槽口'], ['node', '节点近看']];
  for (const [key, label] of views) {
    const b = document.createElement('button');
    b.className = 'chip' + (key === 'iso' ? ' on' : '');
    b.textContent = label;
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
  boom.textContent = '爆炸';
  boom.addEventListener('click', () => {
    const on = !boom.classList.contains('on');
    boom.classList.toggle('on', on);
    actions.setExplode(on);
  });
  hudRight.appendChild(boom);

  const spin = document.createElement('button');
  spin.className = 'chip-toggle';
  spin.textContent = '自转';
  spin.addEventListener('click', () => {
    const on = !spin.classList.contains('on');
    spin.classList.toggle('on', on);
    actions.setSpin(on);
  });
  hudRight.appendChild(spin);

  return { syncReadout };
}
