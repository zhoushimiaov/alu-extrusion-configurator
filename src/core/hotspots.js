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

  // 层控制：顶部水平成对 [－ ＋]（间距 0.34m），贴顶框上方
  // 跨控制：右侧水平成对 [－ ＋]（间距 0.34m），位于右侧面中部
  const topAnchor = (dx) => {
    const b = getBounds();
    return new THREE.Vector3(dx, b.H + 0.18, 0);
  };
  const sideAnchor = (dx, yFrac = 0.5) => {
    const b = getBounds();
    return new THREE.Vector3(b.W / 2 + 0.30 + dx, b.H * yFrac, 0);
  };

  addHotspot('level-', () => topAnchor(-0.17), '－', '减少一层', () => store.set({ levels: store.get().levels - 1 }));
  addHotspot('level+', () => topAnchor(0.17), '＋', '增加一层', () => store.set({ levels: store.get().levels + 1 }));
  addHotspot('bay-', () => sideAnchor(0, 0.62), '－', '减少一跨', () => store.set({ bays: store.get().bays - 1 }));
  addHotspot('bay+', () => sideAnchor(0, 0.38), '＋', '增加一跨', () => store.set({ bays: store.get().bays + 1 }));

  function sync() {
    const rect = renderer.domElement.getBoundingClientRect();
    const cfg = store.get();
    const lim = store.limits;
    for (const it of items) {
      const p = it.anchorFn();
      v.copy(p).project(camera);
      const x = (v.x * 0.5 + 0.5) * rect.width;
      const y = (-v.y * 0.5 + 0.5) * rect.height;
      const visible = v.z < 1;
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
