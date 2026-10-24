import * as THREE from 'three';

// Match the delivered assembly: ancestor visibility applies, and far-view LOD
// never replaces the actual strips when measuring the assembled product.
export function measureAssembly(root) {
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    for (let node = o; node; node = node.parent) {
      if (node.name === 'stripsLOD' || node.userData?.exportSkip === true) return;
      if (!node.visible && node.name !== 'strips') return;
      if (node === root) break;
    }
    const geo = o.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    if (!geo.boundingBox || geo.boundingBox.isEmpty()) return;
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        matrix.premultiply(o.matrixWorld);
        box.union(part.copy(geo.boundingBox).applyMatrix4(matrix));
      }
    } else {
      box.union(part.copy(geo.boundingBox).applyMatrix4(o.matrixWorld));
    }
  });
  if (box.isEmpty()) return { envelope: { W: 0, H: 0, D: 0 }, min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] };
  const size = box.getSize(new THREE.Vector3());
  return {
    envelope: { W: +size.x.toFixed(4), H: +size.y.toFixed(4), D: +size.z.toFixed(4) },
    min: box.min.toArray(), max: box.max.toArray(),
    center: box.getCenter(new THREE.Vector3()).toArray(),
  };
}
