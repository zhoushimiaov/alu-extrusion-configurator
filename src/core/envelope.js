// 真实外轮廓计算：轴对齐包围盒，正确展开 InstancedMesh 的实例矩阵。
// 这是「3D 尺寸标注 + 面板规格卡」共用的总尺寸唯一数据源；
// 各 builder 的 bounds 是相机取景包围盒（含刻意留白），不得用于显示。
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _box = new THREE.Box3();
const _child = new THREE.Box3();

export function computeEnvelope(root) {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (o.visible === false) return;
    const geo = o.geometry;
    if (!geo) return;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, _m);
        _m.premultiply(o.matrixWorld);
        _child.copy(geo.boundingBox).applyMatrix4(_m);
        box.union(_child);
      }
    } else if (o.isMesh || o.isLine || o.isPoints) {
      _child.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(_child);
    }
  });
  if (box.isEmpty()) return { W: 0, H: 0, D: 0 };
  return {
    W: +(box.max.x - box.min.x).toFixed(4),
    H: +(box.max.y - box.min.y).toFixed(4),
    D: +(box.max.z - box.min.z).toFixed(4),
  };
}
