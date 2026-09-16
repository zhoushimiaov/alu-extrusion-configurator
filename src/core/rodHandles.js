// 视口内可拖拽尺寸箭头（光轴展架：宽度 / 高度两个方向）
// 交互：Raycaster 拾取锥体 + 拖拽平面投影 → 更新 rodStore → 自动重建
import * as THREE from 'three';

const MAX_W = 1.0, MAX_H = 2.0;   // 与 rodrack LIMITS 一致（上限）
const COLOR_W = 0xc2711d;         // 宽度方向（琥珀）
const COLOR_H = 0x3d7a4f;         // 高度方向（松绿）

export function createRodHandles(canvas, camera, renderer, controls, rodStore, getBounds) {
  const raycaster = new THREE.Raycaster();
  const group = new THREE.Group();
  group.renderOrder = 999;

  // —— 箭头造型：细杆 + 圆锥 ——
  const shaftGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 8);
  const coneGeo = new THREE.ConeGeometry(0.022, 0.06, 12);
  const mkMat = (hex) => new THREE.MeshBasicMaterial({ color: hex, depthTest: false, transparent: true, opacity: 0.95 });

  const wMat = mkMat(COLOR_W), hMat = mkMat(COLOR_H);
  const wShaft = new THREE.Mesh(shaftGeo, wMat);
  const wCone = new THREE.Mesh(coneGeo, wMat);
  const hShaft = new THREE.Mesh(shaftGeo, hMat);
  const hCone = new THREE.Mesh(coneGeo, hMat);
  wShaft.renderOrder = wCone.renderOrder = hShaft.renderOrder = hCone.renderOrder = 999;
  group.add(wShaft, wCone, hShaft, hCone);

  // 高度箭头沿 Y：杆默认沿 Y；宽度箭头沿 X：杆旋转
  wShaft.rotation.z = -Math.PI / 2;

  let dragging = null;       // 'w' | 'h'
  let dragPlane = new THREE.Plane();
  let startVal = 0, startPt = 0;
  let hover = null;
  const ndc = new THREE.Vector2();

  function toNDC(e) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  // 布局：跟随当前模型包围盒与配置值
  function sync() {
    const b = getBounds();
    const c = rodStore.get();
    const yTop = b.H;
    // 宽度箭头：放在模型前方（z = D/2 + 0.12），从 -W/2 指向 +W/2
    const zw = b.D / 2 + 0.12;
    const wHalf = (b.W - 0.12) / 2;
    wShaft.scale.set(1, Math.max(0.3, wHalf * 2 - 0.1), 1);
    wShaft.position.set(0, 0.03, zw);
    wCone.position.set(wHalf + 0.028, 0.03, zw);
    wCone.rotation.z = -Math.PI / 2;
    // 高度箭头：放在模型左侧（x = -W/2 - 0.12），从 0 指向 H
    const xh = -(b.W - 0.12) / 2 - 0.12;
    hShaft.scale.set(1, Math.max(0.3, yTop - 0.12), 1);
    hShaft.position.set(xh, yTop / 2, 0);
    hCone.position.set(xh, yTop + 0.028, 0);
    group.visible = true;
  }

  function pick(e) {
    if (!group.parent) return null;   // 已卸载（型材模式）时不响应
    toNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const hitsW = raycaster.intersectObjects([wCone, wShaft], false);
    const hitsH = raycaster.intersectObjects([hCone, hShaft], false);
    if (hitsW.length) return 'w';
    if (hitsH.length) return 'h';
    return null;
  }

  function beginDrag(kind, e) {
    dragging = kind;
    const c = rodStore.get();
    startVal = kind === 'w' ? c.width : c.height;
    toNDC(e);
    raycaster.setFromCamera(ndc, camera);
    if (kind === 'w') {
      // 沿世界 X 拖拽：法线朝相机但排除 Y 分量 → 用水平面
      dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0));
    } else {
      // 沿世界 Y 拖拽：面向相机的竖直平面
      const n = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0, 1, 0)).normalize();
      dragPlane.setFromNormalAndCoplanarPoint(n, new THREE.Vector3(0, 0, 0));
    }
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane, pt);
    startPt = kind === 'w' ? pt.x : pt.y;
    controls.enabled = false;
    canvas.style.cursor = 'col-resize';
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
  }

  function endDrag() {
    dragging = null;
    controls.enabled = true;
    canvas.style.cursor = '';
  }

  function onHover(e) {
    if (dragging || !group.parent) return;
    const k = pick(e);
    if (k !== hover) {
      hover = k;
      canvas.style.cursor = k ? (k === 'w' ? 'col-resize' : 'row-resize') : '';
      if (k) {
        wCone.material.opacity = k === 'w' ? 1 : 0.55;
        hCone.material.opacity = k === 'h' ? 1 : 0.55;
      } else {
        wCone.material.opacity = hCone.material.opacity = 0.95;
      }
    }
  }

  const onDown = (e) => { const k = pick(e); if (k) beginDrag(k, e); };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onHover);
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);

  return { group, sync, dispose() {
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onHover);
    window.removeEventListener('pointermove', moveDrag);
    window.removeEventListener('pointerup', endDrag);
    shaftGeo.dispose(); coneGeo.dispose(); wMat.dispose(); hMat.dispose();
  } };
}
