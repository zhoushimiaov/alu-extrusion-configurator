// 支撑点预览标记层（配件可视化）：橙色标记落在当前产品的支撑点（脚轮 / 地脚触地点）。
// 数据源：各 build*.js 返回的 stats.supports = { points:[[x,y,z],...], kind:'casters'|'feet' }；
// 型材架（原封 buildShelf）暂无支撑件选项、不产出 supports，标记层自然为空。
// 与 rodHandles 同模式：场景内独立 group + 显式 setVisible；爆炸/背视时由接线层统一隐藏。
import * as THREE from 'three';

const MARKER_COLOR = 0xff7a1a;

export function createSupportMarkers() {
  const group = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.018, 0.027, 28);
  ringGeo.rotateX(-Math.PI / 2);
  const dotGeo = new THREE.OctahedronGeometry(0.012);
  const mat = new THREE.MeshBasicMaterial({ color: MARKER_COLOR, transparent: true, opacity: 0.95, depthWrite: false });

  let rings = null;
  let dots = null;
  let key = '';

  function setPoints(points) {
    const k = JSON.stringify(points || []);
    if (k === key) return;
    key = k;
    if (rings) { group.remove(rings); rings.dispose(); rings = null; }
    if (dots) { group.remove(dots); dots.dispose(); dots = null; }
    const pts = points || [];
    if (!pts.length) return;
    rings = new THREE.InstancedMesh(ringGeo, mat, pts.length);
    dots = new THREE.InstancedMesh(dotGeo, mat, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => {
      m.makeTranslation(p[0], (p[1] || 0) + 0.004, p[2]);
      rings.setMatrixAt(i, m);
      m.makeTranslation(p[0], (p[1] || 0) + 0.055, p[2]);
      dots.setMatrixAt(i, m);
    });
    rings.instanceMatrix.needsUpdate = true;
    dots.instanceMatrix.needsUpdate = true;
    rings.renderOrder = 998;
    dots.renderOrder = 998;
    group.add(rings);
    group.add(dots);
  }

  function setVisible(v) { group.visible = !!v; }

  return {
    group,
    setPoints,
    setVisible,
    dispose() {
      if (rings) rings.dispose();
      if (dots) dots.dispose();
      ringGeo.dispose();
      dotGeo.dispose();
      mat.dispose();
    },
  };
}
