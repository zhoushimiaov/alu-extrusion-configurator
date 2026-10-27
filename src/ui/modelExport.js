// 3D 模型导出：把当前装配场景导出为 glTF 2.0（.glb 二进制，1 米 = 1 单位）
// 关键：本项目大量零件由 InstancedMesh 承载。GLTFExporter 会把 InstancedMesh 写成
// EXT_mesh_gpu_instancing 扩展，标准查看器不支持时只剩单个零件，导出形体与屏幕不符。
// 因此导出前把整机「展平」为普通 Mesh：每个网格（含每个实例）都把世界矩阵烘焙进自身，
// 保证任何查看器打开的形体都与屏幕一致。
import * as THREE from 'three';
import { isDisplayOnlyNode } from '../core/exportPolicy.js';

const ROOT_NAMES = {
  profile: 'AluShelf',
  rod: 'RodRack',
  cart: 'RollingCart',
  crates: 'CrateRack',
  woodcart: 'WoodCart',
  hanger: 'ClothesHanger',
  books: 'RodBookshelf',
  table: 'ReadingTable',
  sheet: 'GalvanizedCabinet',
};

function clonePlain(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

const MATERIAL_SCALAR_KEYS = [
  'opacity', 'transparent', 'depthWrite', 'depthTest', 'visible', 'alphaTest',
  'alphaHash', 'side', 'blending', 'premultipliedAlpha', 'vertexColors',
  'toneMapped', 'emissiveIntensity', 'metalness', 'roughness', 'transmission',
  'thickness', 'ior', 'reflectivity', 'clearcoat', 'clearcoatRoughness',
  'iridescence', 'iridescenceIOR', 'attenuationDistance',
];
const MATERIAL_COLOR_KEYS = [
  'color', 'emissive', 'specularColor', 'sheenColor', 'attenuationColor',
];

function captureMaterialState(material) {
  if (!material) return null;
  const state = {};
  for (const key of MATERIAL_SCALAR_KEYS) {
    if (key in material) state[key] = material[key];
  }
  for (const key of MATERIAL_COLOR_KEYS) {
    if (material[key]?.isColor) state[key] = material[key].clone();
  }
  return state;
}

function applyMaterialState(material, state) {
  if (!material || !state) return;
  for (const [key, value] of Object.entries(state)) {
    if (value?.isColor) material[key]?.copy?.(value);
    else material[key] = value;
  }
  material.needsUpdate = true;
}

/**
 * Record the finished assembly pose before reveal/explode/XRay can mutate it.
 * The map is intentionally keyed by live objects: downloadModel consumes it
 * synchronously, before a later product switch can dispose those objects.
 */
export function captureAssemblyPose(root) {
  const pose = new Map();
  if (!root) return pose;
  const materialStates = new Map();
  root.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material && !materialStates.has(material)) {
        materialStates.set(material, captureMaterialState(material));
      }
    }
    pose.set(object, {
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
      visible: object.visible,
      material: object.material || null,
    });
  });
  pose.materialStates = materialStates;
  return pose;
}

export function applyAssemblyPose(root, pose) {
  if (!root || !pose) return () => {};
  const restore = [];
  root.traverse((object) => {
    const frozen = pose.get(object);
    if (!frozen) return;
    restore.push({
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
      visible: object.visible,
      material: object.material,
    });
    object.position.copy(frozen.position);
    object.quaternion.copy(frozen.quaternion);
    object.scale.copy(frozen.scale);
    object.visible = frozen.visible;
    object.material = frozen.material;
  });
  const restoreMaterials = [];
  for (const [material, state] of pose.materialStates || []) {
    restoreMaterials.push({ material, state: captureMaterialState(material) });
    applyMaterialState(material, state);
  }
  root.updateMatrixWorld(true);
  return () => {
    for (const state of restore) {
      state.object.position.copy(state.position);
      state.object.quaternion.copy(state.quaternion);
      state.object.scale.copy(state.scale);
      state.object.visible = state.visible;
      state.object.material = state.material;
    }
    for (const { material, state } of restoreMaterials) {
      applyMaterialState(material, state);
    }
    root.updateMatrixWorld(true);
  };
}

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
  } else if (kind === 'table') {
    if (meta.tBays) parts.push(meta.tBays + 'B');
    const w = num(meta.tBayW); if (w) parts.push('W' + w);
  } else if (kind === 'books') {
    if (meta.style === 'table') {
      if (meta.tBays) parts.push(meta.tBays + 'B');
      const w = num(meta.tBayW); if (w) parts.push('W' + w);
    } else {
      if (meta.bays) parts.push(meta.bays + 'b');
      if (meta.levels) parts.push(meta.levels + 'L');
    }
  } else if (kind === 'hanger') {
    const w = num(meta.width); const h = num(meta.height);
    if (w) parts.push('W' + w);
    if (h) parts.push('H' + h);
    if (meta.drawers) parts.push(meta.drawers + 'D');
  } else {
    if (meta.bays) parts.push(meta.bays + 'b');
    if (meta.levels) parts.push(meta.levels + 'L');
  }
  return parts;
}

function cloneTexture(texture, textures) {
  if (!texture?.isTexture) return texture;
  if (textures.has(texture)) return textures.get(texture);
  const clone = texture.clone();
  clone.needsUpdate = true;
  textures.set(texture, clone);
  return clone;
}

function cloneMaterial(material, materials, textures) {
  if (!material) return material;
  if (materials.has(material)) return materials.get(material);
  const clone = material.clone();
  // Material.clone() shares texture instances. Own them explicitly so a
  // product switch after the click cannot dispose the source texture while the
  // asynchronous GLTF encoder is still reading it.
  for (const key of Object.keys(clone)) {
    const value = clone[key];
    if (value?.isTexture) clone[key] = cloneTexture(value, textures);
  }
  clone.needsUpdate = true;
  materials.set(material, clone);
  return clone;
}

function cloneExportResources(geometry, material, geometries, materials, textures) {
  let ownedGeometry = geometries.get(geometry);
  if (!ownedGeometry) {
    ownedGeometry = geometry.clone();
    geometries.set(geometry, ownedGeometry);
  }
  const ownedMaterial = Array.isArray(material)
    ? material.map((entry) => cloneMaterial(entry, materials, textures))
    : cloneMaterial(material, materials, textures);
  return { geometry: ownedGeometry, material: ownedMaterial };
}

/**
 * 把 sourceGroup 展平为世界坐标下的普通 Mesh 集合（InstancedMesh 逐实例展开）。
 * 默认复用几何/材质引用；导出交付时传 cloneResources=true，同步取得独立资源，
 * 并可用 assemblyPose 把动画中的模型还原成装配态。
 */
export function flattenToPlainMeshes(sourceGroup, rootName, {
  assemblyPose = null,
  cloneResources = false,
} = {}) {
  const exportRoot = new THREE.Group();
  exportRoot.name = rootName;

  const restorePose = assemblyPose ? applyAssemblyPose(sourceGroup, assemblyPose) : null;
  sourceGroup.updateMatrixWorld(true);
  const geometries = new Map();
  const materials = new Map();
  const textures = new Map();
  // 展平后的 Mesh 默认可见；导出时必须继承源节点及祖先的可见性。
  // stripsLOD 仅用于远景预览；无论当前距离多远，始终导出高精度 strips。
  // props/displayBooks 和显式 displayOnly 节点属于展示陈设，不进入制造交接模型。
  const isExportable = (mesh) => {
    let node = mesh;
    while (node) {
      if (node.name === 'stripsLOD' || node.userData?.exportSkip === true) return false;
      if (isDisplayOnlyNode(node)) return false;
      if (!node.visible && node.name !== 'strips') return false;
      if (node === sourceGroup) break;
      node = node.parent;
    }
    return true;
  };
  const instMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  let meshCount = 0;
  let instanceCount = 0;

  try {
    sourceGroup.traverse((o) => {
      if (!o.isMesh || !isExportable(o)) return;
      const sourceMaterial = o.userData?.__origMat ?? o.material;
      const resources = cloneResources
        ? cloneExportResources(o.geometry, sourceMaterial, geometries, materials, textures)
        : { geometry: o.geometry, material: sourceMaterial };
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, instMatrix);
          worldMatrix.multiplyMatrices(o.matrixWorld, instMatrix);
          const mesh = new THREE.Mesh(resources.geometry, resources.material);
          mesh.name = `${o.name || 'part'}_${i}`;
          mesh.applyMatrix4(worldMatrix);
          exportRoot.add(mesh);
          meshCount++;
        }
        instanceCount += o.count;
      } else if (o.isMesh) {
        const mesh = new THREE.Mesh(resources.geometry, resources.material);
        mesh.name = o.name || 'part';
        mesh.applyMatrix4(o.matrixWorld);
        exportRoot.add(mesh);
        meshCount++;
      }
    });
  } finally {
    restorePose?.();
  }

  if (!meshCount) {
    throw new Error(`Cannot export an empty model (${rootName})`);
  }
  exportRoot.userData.alExportStats = { meshCount, instanceCount };
  return exportRoot;
}

/** Dispose only resources owned by flattenToPlainMeshes(..., {cloneResources:true}). */
export function disposeFlattenedMeshes(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root?.traverse((object) => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

/**
 * 导出当前产品的装配 group 为 .glb。
 * @param {THREE.Group} sourceGroup 当前装配（current.group / rodCurrent.group / …）
 * @param {string} kind 'profile' | 'rod' | 'cart' | 'crates' | 'woodcart'
 * @param {object} meta 文件名附加信息（bays/levels、width/height、tiers、shelves 等）
 * @returns {Promise<string>} 下载文件名
 */
export async function downloadModel(sourceGroup, kind = 'profile', meta = {}, {
  assemblyPose = null,
} = {}) {
  // Freeze all live inputs synchronously, before the first await. A product
  // switch or animation frame after this point cannot change the delivered GLB.
  const rootName = ROOT_NAMES[kind] || ROOT_NAMES.profile;
  const frozenMeta = clonePlain(meta);
  const exportRoot = flattenToPlainMeshes(sourceGroup, rootName, {
    assemblyPose,
    cloneResources: true,
  });

  try {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const glb = await new Promise((resolve, reject) => {
      exporter.parse(exportRoot, (result) => resolve(result), (err) => reject(err), { binary: true, onlyVisible: true });
    });

    const parts = fileNameParts(kind, frozenMeta);
    const name = `${rootName}${parts.length ? '-' + parts.join('x') : ''}.glb`;

    const blob = new Blob([glb], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    return name;
  } finally {
    disposeFlattenedMeshes(exportRoot);
  }
}
