// 型材架背板防穿模（装配后处理）：buildShelf.js 为原封文件，背板外撤在这里做。
// 目标：背板前面（朝向框架的一侧）距背面框架外缘 z=-0.200 留 4mm 装配间隙。
import * as THREE from 'three';

const REAR_FRAME_Z = -0.20;
const BACK_PANEL_CLEARANCE = 0.004;

export function retreatShelfBackPanels(product) {
  const panels = product?.groups?.panels;
  if (!panels || !panels.isInstancedMesh) return;
  if (!panels.geometry.boundingBox) panels.geometry.computeBoundingBox();
  const localZMax = panels.geometry.boundingBox.max.z;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (let i = 0; i < panels.count; i++) {
    panels.getMatrixAt(i, m);
    m.decompose(p, q, s);
    const targetZ = REAR_FRAME_Z - BACK_PANEL_CLEARANCE - localZMax * s.z;
    if (Math.abs(p.z - targetZ) < 1e-6) continue;
    p.z = targetZ;
    m.compose(p, q, s);
    panels.setMatrixAt(i, m);
  }
  panels.instanceMatrix.needsUpdate = true;
}
