// 视口内可拖拽尺寸手柄（光轴展架：宽度 / 高度两个方向）
// 极简工业图纸风：细导轨 + 双向端子指示器 + 实时跟随数值胶囊
import * as THREE from 'three';

const COLOR_TRACK = 0x222222;
const COLOR_HANDLE = 0x111111;
const COLOR_FILL = 0xfcfcfc;

export function createRodHandles(canvas, camera, renderer, controls, rodStore, getBounds) {
  const raycaster = new THREE.Raycaster();
  const group = new THREE.Group();
  group.renderOrder = 999;

  // 动态尺寸数值浮动徽标（附在 3D 视口 DOM 树上）
  const badge = document.createElement('div');
  badge.className = 'rod-drag-badge';
  badge.style.display = 'none';
  canvas.parentElement?.appendChild(badge);

  // —— 材质定义 ——
  const trackMat = new THREE.MeshBasicMaterial({ color: COLOR_TRACK, depthTest: false, transparent: true, opacity: 0.45 });
  const handleMat = new THREE.MeshBasicMaterial({ color: COLOR_HANDLE, depthTest: false, transparent: true, opacity: 0.95 });
  const fillMat = new THREE.MeshBasicMaterial({ color: COLOR_FILL, depthTest: false, transparent: true, opacity: 0.92 });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  // —— 导轨几何 ——
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

  // —— 端部双向箭头与端子 ——
  const discGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.003, 24);
  const ringGeo = new THREE.TorusGeometry(0.018, 0.0018, 8, 24);
  const pointerGeo = new THREE.ConeGeometry(0.006, 0.014, 10);
  const hitGeo = new THREE.SphereGeometry(0.05, 8, 8);

  // 宽度端子手柄
  const wHandleGroup = new THREE.Group();
  const wDisc = new THREE.Mesh(discGeo, fillMat);
  const wRing = new THREE.Mesh(ringGeo, handleMat);
  const wArrowL = new THREE.Mesh(pointerGeo, handleMat);
  const wArrowR = new THREE.Mesh(pointerGeo, handleMat);
  wDisc.rotation.x = Math.PI / 2;
  wRing.rotation.x = Math.PI / 2;
  wArrowL.rotation.z = Math.PI / 2;
  wArrowL.position.x = -0.009;
  wArrowR.rotation.z = -Math.PI / 2;
  wArrowR.position.x = 0.009;
  const wHit = new THREE.Mesh(hitGeo, hitMat);
  wHandleGroup.add(wDisc, wRing, wArrowL, wArrowR, wHit);

  // 高度端子手柄
  const hHandleGroup = new THREE.Group();
  const hDisc = new THREE.Mesh(discGeo, fillMat);
  const hRing = new THREE.Mesh(ringGeo, handleMat);
  const hArrowU = new THREE.Mesh(pointerGeo, handleMat);
  const hArrowD = new THREE.Mesh(pointerGeo, handleMat);
  hArrowU.position.y = 0.009;
  hArrowD.rotation.z = Math.PI;
  hArrowD.position.y = -0.009;
  const hHit = new THREE.Mesh(hitGeo, hitMat);
  hHandleGroup.add(hDisc, hRing, hArrowU, hArrowD, hHit);

  // 设置所有子构件的高优先级渲染层级
  [wShaft, wStartTick, wHandleGroup, hShaft, hStartTick, hHandleGroup].forEach(o => {
    o.renderOrder = 999;
    o.traverse(child => { if (child.isMesh) child.renderOrder = 999; });
  });

  group.add(wShaft, wStartTick, wHandleGroup, hShaft, hStartTick, hHandleGroup);

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
    const pos3 = activeKind === 'w' ? wHandlePos : hHandlePos;
    tempV.copy(pos3).project(camera);
    const r = canvas.getBoundingClientRect();
    const sx = (tempV.x * 0.5 + 0.5) * r.width;
    const sy = (-tempV.y * 0.5 + 0.5) * r.height;
    const c = rodStore.get();
    const val = activeKind === 'w' ? c.width : c.height;
    badge.textContent = activeKind === 'w' ? `宽 ${val.toFixed(2)} m` : `高 ${val.toFixed(2)} m`;
    badge.style.left = `${sx}px`;
    badge.style.top = `${sy}px`;
    badge.style.display = 'block';
  }

  // 布局：跟随当前模型包围盒与配置值
  function sync() {
    const b = getBounds();
    const yTop = b.H;
    const zw = b.D / 2 + 0.12;
    const wHalf = (b.W - 0.12) / 2;

    // 宽度导轨与端子（从 -wHalf 指向 +wHalf）
    wShaft.scale.set(1, Math.max(0.2, wHalf * 2), 1);
    wShaft.position.set(0, 0.03, zw);
    wStartTick.position.set(-wHalf, 0.03, zw);
    wHandleGroup.position.set(wHalf, 0.03, zw);
    wHandlePos.set(wHalf, 0.03, zw);

    // 高度导轨与端子（从 0 指向 yTop）
    const xh = -(b.W - 0.12) / 2 - 0.12;
    hShaft.scale.set(1, Math.max(0.2, yTop), 1);
    hShaft.position.set(xh, yTop / 2, 0);
    hStartTick.position.set(xh, 0, 0);
    hHandleGroup.position.set(xh, yTop, 0);
    hHandlePos.set(xh, yTop, 0);

    group.visible = true;
    updateBadge();
  }

  function pick(e) {
    if (!group.parent) return null;
    toNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const hitsW = raycaster.intersectObjects([wHit, wShaft, wDisc], false);
    const hitsH = raycaster.intersectObjects([hHit, hShaft, hDisc], false);
    if (hitsW.length) return 'w';
    if (hitsH.length) return 'h';
    return null;
  }

  function applyVisualState(k, isActive) {
    wHandleGroup.scale.setScalar(k === 'w' ? (isActive ? 1.25 : 1.15) : 1);
    hHandleGroup.scale.setScalar(k === 'h' ? (isActive ? 1.25 : 1.15) : 1);
    trackMat.opacity = k ? 0.75 : 0.45;
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
    canvas.style.cursor = kind === 'w' ? 'col-resize' : 'row-resize';
    applyVisualState(kind, true);
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
      applyVisualState(hover, false);
      dragging = null;
      controls.enabled = true;
      canvas.style.cursor = '';
      updateBadge();
    }
  }

  function onHover(e) {
    if (dragging || !group.parent) return;
    const k = pick(e);
    if (k !== hover) {
      hover = k;
      canvas.style.cursor = k ? (k === 'w' ? 'col-resize' : 'row-resize') : '';
      applyVisualState(k, false);
      updateBadge();
    } else if (k) {
      updateBadge();
    }
  }

  const onDown = (e) => { const k = pick(e); if (k) beginDrag(k, e); };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onHover);
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);

  return {
    group,
    sync,
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onHover);
      window.removeEventListener('pointermove', moveDrag);
      window.removeEventListener('pointerup', endDrag);
      badge.remove();
      shaftGeo.dispose(); tickGeo.dispose(); discGeo.dispose(); ringGeo.dispose();
      pointerGeo.dispose(); hitGeo.dispose();
      trackMat.dispose(); handleMat.dispose(); fillMat.dispose(); hitMat.dispose();
    },
  };
}
