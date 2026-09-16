// 3D 模型导出：把当前装配场景导出为 glTF 2.0（.glb 二进制，1 米 = 1 单位）
// 关键：本项目大量零件由 InstancedMesh 承载。GLTFExporter 会把 InstancedMesh 写成
// EXT_mesh_gpu_instancing 扩展，标准查看器不支持时只剩单个零件，导出形体与屏幕不符。
// 因此导出前把整机「展平」为普通 Mesh：每个网格（含每个实例）都把世界矩阵烘焙进自身，
// 保证任何查看器打开的形体都与屏幕一致。
import * as THREE from 'three';

const ROOT_NAMES = {
  profile: 'AluShelf',
  rod: 'RodRack',
  cart: 'RollingCart',
  crates: 'CrateRack',
  woodcart: 'WoodCart',
};

function fileNameParts(kind, meta = {}) {
  const parts = [];
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v.toFixed(2) : null);
  if (kind === 'rod') {
    const w = num(meta.width); const h = num(meta.height);
    if (w) parts.push('W' + w);
    if (h) parts.push('H' + h);
  } else if (kind === 'cart') {
    const w = num(meta.width); const d = num(meta.depth); const h = num(meta.height);
    if (w) parts.push('W' + w);
    if (d) parts.push('D' + d);
    if (h) parts.push('H' + h);
  } else if (kind === 'crates') {
    if (meta.tiers) parts.push(meta.tiers + 'L');
    const w = num(meta.width);
    if (w) parts.push('W' + w);
  } else if (kind === 'woodcart') {
    const w = num(meta.width); const h = num(meta.height);
    if (w) parts.push('W' + w);
    if (h) parts.push('H' + h);
    if (meta.shelves) parts.push(meta.shelves + 'S');
  } else {
    if (meta.bays) parts.push(meta.bays + 'b');
    if (meta.levels) parts.push(meta.levels + 'L');
  }
  return parts;
}

/**
 * 把 sourceGroup 展平为世界坐标下的普通 Mesh 集合（InstancedMesh 逐实例展开）。
 * 只复制每个网格的几何/材质引用并按世界矩阵烘焙，不改动原场景对象。
 */
function flattenToPlainMeshes(sourceGroup, rootName) {
  const exportRoot = new THREE.Group();
  exportRoot.name = rootName;

  sourceGroup.updateMatrixWorld(true);
  const instMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  let meshCount = 0;
  let instanceCount = 0;

  sourceGroup.traverse((o) => {
    if (o.isInstancedMesh) {
      sourceGroup.updateMatrixWorld(true);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, instMatrix);
        worldMatrix.multiplyMatrices(o.matrixWorld, instMatrix);
        const mesh = new THREE.Mesh(o.geometry, o.material);
        mesh.name = `${o.name || 'part'}_${i}`;
        mesh.applyMatrix4(worldMatrix);
        exportRoot.add(mesh);
        meshCount++;
      }
      instanceCount += o.count;
    } else if (o.isMesh) {
      const mesh = new THREE.Mesh(o.geometry, o.material);
      mesh.name = o.name || 'part';
      mesh.applyMatrix4(o.matrixWorld);
      exportRoot.add(mesh);
      meshCount++;
    }
  });

  exportRoot.userData.alExportStats = { meshCount, instanceCount };
  return exportRoot;
}

/**
 * 导出当前产品的装配 group 为 .glb。
 * @param {THREE.Group} sourceGroup 当前装配（current.group / rodCurrent.group / …）
 * @param {string} kind 'profile' | 'rod' | 'cart' | 'crates' | 'woodcart'
 * @param {object} meta 文件名附加信息（bays/levels、width/height、tiers、shelves 等）
 * @returns {Promise<string>} 下载文件名
 */
export async function downloadModel(sourceGroup, kind = 'profile', meta = {}) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();

  const rootName = ROOT_NAMES[kind] || ROOT_NAMES.profile;
  const exportRoot = flattenToPlainMeshes(sourceGroup, rootName);

  const glb = await new Promise((resolve, reject) => {
    exporter.parse(exportRoot, (result) => resolve(result), (err) => reject(err), { binary: true, onlyVisible: true });
  });

  const parts = fileNameParts(kind, meta);
  const name = `${rootName}${parts.length ? '-' + parts.join('x') : ''}.glb`;

  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return name;
}
