// 悬浮 ± 热点：3D 锚点每帧重投影，点击写入 store
import * as THREE from 'three';

export function createHotspots(layer, camera, renderer, store, getBounds) {
  const items = [];
  const v = new THREE.Vector3();

  function addHotspot(id, anchorFn, glyph, tipText, onClick) {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.dataset.id = id;
    btn.setAttribute('aria-label', tipText);
    btn.innerHTML = `<span>${glyph}</span><span class="tip">${tipText}</span>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    layer.appendChild(btn);
    items.push({ btn, anchorFn, id });
  }

  // ± 按钮贴在对应尺寸轴上（建筑图纸直觉：加哪个方向的量，按钮就在那根轴旁）。
  // 成对置于该轴【中点】两侧、沿轴方向展开，并整体外推离开模型：
  //   跨数（宽度 W）→ 底部前缘宽度标注线上，减号在左、加号在右
  //   层数（高度 H）→ 左侧高度标注线上，加号在上、减号在下
  // 放在中点而非轴端，是为了避开"左下角"——轴端点在 3D 里会重合，按钮会互相压住。
  const PAIR = 0.19;   // 高度轴一对按钮沿轴的间距（米）
  // 跨（宽度 W）：放在底部宽度尺寸线的【两端外侧】——减号在左端、加号在右端，
  // 正好落在端部斜短划之外；中点留给尺寸数字压线，二者不重叠（建筑标注惯例）。
  // z 再往前缘外推，避免右端 + 按钮与右缘的深度标注（0.40 m）在投影上重叠。
  const widthAxisEnd = (sign) => {
    const b = getBounds();
    return new THREE.Vector3(sign * (b.W / 2 + 0.15), 0, b.D / 2 + 0.20);
  };
  // 层（高度 H）：贴左侧高度标注线中段，上下成对；x 外推远离数字，y 居中不碰角部
  const heightAxis = (top) => {
    const b = getBounds();
    return new THREE.Vector3(-b.W / 2 - 0.44, b.H / 2 + (top ? PAIR : -PAIR), b.D / 2 + 0.12);
  };

  // 跨：宽度轴两端（减左加右）
  addHotspot('bay-', () => widthAxisEnd(-1), '－', '减少一跨', () => store.set({ bays: store.get().bays - 1 }));
  addHotspot('bay+', () => widthAxisEnd(1), '＋', '增加一跨', () => store.set({ bays: store.get().bays + 1 }));
  // 层：沿高度轴上下成对
  addHotspot('level+', () => heightAxis(true), '＋', '增加一层', () => store.set({ levels: store.get().levels + 1 }));
  addHotspot('level-', () => heightAxis(false), '－', '减少一层', () => store.set({ levels: store.get().levels - 1 }));

  function sync() {
    const rect = renderer.domElement.getBoundingClientRect();
    const cfg = store.get();
    const lim = store.limits;
    // 窄屏（移动端）下视口被压缩，± 贴轴按钮会与尺寸标注数字重叠，
    // 且触屏点视口小圆点不如用面板 stepper —— 故窄屏隐藏 3D ± 热点，改层跨走面板。
    const narrow = rect.width < 620;
    for (const it of items) {
      const p = it.anchorFn();
      v.copy(p).project(camera);
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const visible = v.z < 1 && !narrow;
      it.btn.style.left = x + 'px';
      it.btn.style.top = y + 'px';
      it.btn.style.opacity = visible ? '' : '0';
      it.btn.style.pointerEvents = visible ? 'auto' : 'none';
      const disabled =
        (it.id === 'level+' && cfg.levels >= lim.levels[1]) ||
        (it.id === 'level-' && cfg.levels <= lim.levels[0]) ||
        (it.id === 'bay+' && cfg.bays >= lim.bays[1]) ||
        (it.id === 'bay-' && cfg.bays <= lim.bays[0]);
      if (disabled) it.btn.setAttribute('disabled', '');
      else it.btn.removeAttribute('disabled');
    }
  }

  function setHidden(h) {
    for (const it of items) {
      it.btn.style.display = h ? 'none' : '';
      if (h) it.btn.style.pointerEvents = 'none';
    }
  }

  return { sync, setHidden };
}
