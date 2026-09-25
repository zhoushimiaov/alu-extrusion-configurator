// 视口内可拖拽尺寸手柄（光轴展架：宽度 / 高度两个方向）
// 极简工业图纸风：高对比度纯白建筑手柄 + 双向向量指示器 + 实时跟随数值胶囊
import * as THREE from 'three';

const COLOR_TRACK = 0x111111;

export function createRodHandles(canvas, camera, renderer, controls, rodStore, getBounds) {
  const raycaster = new THREE.Raycaster();
  const group = new THREE.Group();
  group.renderOrder = 999;

  // 动态尺寸数值浮动徽标（附在 3D 视口 DOM 树上）
  const badge = document.createElement('div');
  badge.className = 'rod-drag-badge';
  badge.style.display = 'none';
  canvas.parentElement?.appendChild(badge);

  // 2D 高清晰度尺寸拖拽手柄（屏幕空间固定大小，始终面向视口，彻底消灭 3D 视角切片与模糊问题）
  const wBtn = document.createElement('button');
  wBtn.className = 'rod-handle rod-handle-w';
  wBtn.setAttribute('aria-label', '左右拖拽调整宽度');
  wBtn.setAttribute('title', '左右拖拽调整宽度');
  wBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>';
  wBtn.style.display = 'none';

  const hBtn = document.createElement('button');
  hBtn.className = 'rod-handle rod-handle-h';
  hBtn.setAttribute('aria-label', '上下拖拽调整高度');
  hBtn.setAttribute('title', '上下拖拽调整高度');
  hBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/></svg>';
  hBtn.style.display = 'none';

  canvas.parentElement?.appendChild(wBtn);
  canvas.parentElement?.appendChild(hBtn);

  // —— 3D 辅助导轨 ——
  const trackMat = new THREE.MeshBasicMaterial({ color: COLOR_TRACK, depthTest: false, transparent: true, opacity: 0.35 });
  const shaftGeo = new THREE.CylinderGeometry(0.002, 0.002, 1, 8);
  const tickGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 16);

  // 宽度导轨（X 向）
  const wShaft = new THREE.Mesh(shaftGeo, trackMat);
  wShaft.rotation.z = -Math.PI / 2;
  const wStartTick = new THREE.Mesh(tickGeo, trackMat);
  wStartTick.rotation.z = -Math.PI / 2;

  // 高度导轨（Y 向）
  const hShaft = new THREE.Mesh(shaftGeo, trackMat);
  const hStartTick = new THREE.Mesh(tickGeo, trackMat);

  [wShaft, wStartTick, hShaft, hStartTick].forEach(o => {
    o.renderOrder = 999;
  });

  group.add(wShaft, wStartTick, hShaft, hStartTick);

  let dragging = null;       // 'w' | 'h'
  let dragPlane = new THREE.Plane();
  let startVal = 0, startPt = 0;
  let hover = null;
  const ndc = new THREE.Vector2();
  const wHandlePos = new THREE.Vector3();
  const hHandlePos = new THREE.Vector3();
  const tempV = new THREE.Vector3();

  function toNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function updateBadge() {
    const activeKind = dragging || hover;
    if (!activeKind || !group.parent) {
      badge.style.display = 'none';
      return;
    }
    const targetBtn = activeKind === 'w' ? wBtn : hBtn;
    if (!targetBtn || targetBtn.style.display === 'none') {
      badge.style.display = 'none';
      return;
    }
    const c = rodStore.get();
    const val = activeKind === 'w' ? c.width : c.height;
    badge.textContent = activeKind === 'w' ? `宽 ${val.toFixed(2)} m` : `高 ${val.toFixed(2)} m`;
    badge.style.left = targetBtn.style.left;
    badge.style.top = targetBtn.style.top;
    badge.style.display = 'block';
  }

  // 布局：跟随当前模型包围盒与配置值，实时投影 2D 手柄坐标
  function sync() {
    if (!group.parent) {
      wBtn.style.display = 'none';
      hBtn.style.display = 'none';
      badge.style.display = 'none';
      group.visible = false;
      return;
    }

    const b = getBounds();
    const yTop = b.H;
    const zw = b.D / 2 + 0.12;
    const wHalf = (b.W - 0.12) / 2;

    // 宽度导轨（从 -wHalf 指向 +wHalf）
    wShaft.scale.set(1, Math.max(0.2, wHalf * 2), 1);
    wShaft.position.set(0, 0.03, zw);
    wStartTick.position.set(-wHalf, 0.03, zw);
    wHandlePos.set(wHalf, 0.03, zw);

    // 高度导轨（从 0 指向 yTop）
    const xh = -(b.W - 0.12) / 2 - 0.12;
    hShaft.scale.set(1, Math.max(0.2, yTop), 1);
    hShaft.position.set(xh, yTop / 2, 0);
    hStartTick.position.set(xh, 0, 0);
    hHandlePos.set(xh, yTop, 0);

    group.visible = true;

    // 2D 手柄投影定位
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // 宽度手柄
      tempV.copy(wHandlePos).project(camera);
      if (tempV.z <= 1) {
        const sx = (tempV.x * 0.5 + 0.5) * rect.width;
        const sy = (-tempV.y * 0.5 + 0.5) * rect.height;
        wBtn.style.left = `${sx}px`;
        wBtn.style.top = `${sy}px`;
        wBtn.style.display = 'flex';
      } else {
        wBtn.style.display = 'none';
      }

      // 高度手柄
      tempV.copy(hHandlePos).project(camera);
      if (tempV.z <= 1) {
        const sx = (tempV.x * 0.5 + 0.5) * rect.width;
        const sy = (-tempV.y * 0.5 + 0.5) * rect.height;
        hBtn.style.left = `${sx}px`;
        hBtn.style.top = `${sy}px`;
        hBtn.style.display = 'flex';
      } else {
        hBtn.style.display = 'none';
      }
    }

    updateBadge();
  }

  function beginDrag(kind, e) {
    dragging = kind;
    const c = rodStore.get();
    startVal = kind === 'w' ? c.width : c.height;
    toNDC(e);
    raycaster.setFromCamera(ndc, camera);
    if (kind === 'w') {
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
    } else {
      const n = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0, 1, 0)).normalize();
      dragPlane.setFromNormalAndCoplanarPoint(n, new THREE.Vector3(0, 0, 0));
    }
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, pt);
    startPt = kind === 'w' ? pt.x : pt.y;
    controls.enabled = false;
    canvas.style.cursor = kind === 'w' ? 'ew-resize' : 'ns-resize';
    if (kind === 'w') wBtn.classList.add('dragging');
    else hBtn.classList.add('dragging');
    trackMat.opacity = 0.75;
    updateBadge();
  }

  function moveDrag(e) {
    if (!dragging) return;
    toNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const pt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlane, pt)) return;
    const delta = dragging === 'w' ? pt.x - startPt : pt.y - startPt;
    const lim = rodStore.limits;
    if (dragging === 'w') {
      const v = Math.min(lim.width[1], Math.max(lim.width[0], +(startVal + delta).toFixed(2)));
      rodStore.set({ width: v });
    } else {
      const v = Math.min(lim.height[1], Math.max(lim.height[0], +(startVal + delta).toFixed(2)));
      rodStore.set({ height: v });
    }
    updateBadge();
  }

  function endDrag() {
    if (dragging) {
      wBtn.classList.remove('dragging');
      hBtn.classList.remove('dragging');
      dragging = null;
      controls.enabled = true;
      canvas.style.cursor = '';
      trackMat.opacity = 0.35;
      updateBadge();
    }
  }

  // 绑定 2D 手柄事件
  wBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wBtn.setPointerCapture(e.pointerId);
    beginDrag('w', e);
  });
  hBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hBtn.setPointerCapture(e.pointerId);
    beginDrag('h', e);
  });

  wBtn.addEventListener('pointerenter', () => { hover = 'w'; updateBadge(); });
  wBtn.addEventListener('pointerleave', () => { if (!dragging) { hover = null; updateBadge(); } });
  hBtn.addEventListener('pointerenter', () => { hover = 'h'; updateBadge(); });
  hBtn.addEventListener('pointerleave', () => { if (!dragging) { hover = null; updateBadge(); } });

  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  return {
    group,
    sync,
    dispose() {
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      wBtn.remove();
      hBtn.remove();
      badge.remove();
      shaftGeo.dispose();
      tickGeo.dispose();
      trackMat.dispose();
    },
  };
}
