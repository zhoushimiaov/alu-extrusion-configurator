// 材质分层 XRay：保留结构深度与边缘，避免所有零件统一 0.15 透明度变成白雾。
// 不修改源材质；返回常驻共享半透副本，关闭后恢复原引用。
const derived = new WeakMap();

export function xrayMaterialFor(original) {
  if (!original || typeof original.clone !== 'function') return original;
  if (derived.has(original)) return derived.get(original);
  const translucent = (original.transmission ?? 0) > 0.01 || (original.opacity ?? 1) < 0.95;
  const material = original.clone();
  material.transparent = true;
  material.opacity = translucent ? 0.76 : (original.metalness > 0.5 ? 0.48 : 0.58);
  if ('transmission' in material) material.transmission = 0;
  material.depthWrite = false;
  material.depthTest = true;
  material.needsUpdate = true;
  derived.set(original, material);
  return material;
}

export function applyXrayTo(group, enabled) {
  if (!group) return;
  group.traverse(obj => {
    if (!obj.isMesh && !obj.isInstancedMesh) return;
    if (enabled) {
      if (!Object.prototype.hasOwnProperty.call(obj.userData, '__origMat'))
        obj.userData.__origMat = obj.material;
      const orig = obj.userData.__origMat;
      obj.material = Array.isArray(orig) ? orig.map(xrayMaterialFor) : xrayMaterialFor(orig);
    } else if (Object.prototype.hasOwnProperty.call(obj.userData, '__origMat')) {
      obj.material = obj.userData.__origMat;
      delete obj.userData.__origMat;
    }
  });
}
