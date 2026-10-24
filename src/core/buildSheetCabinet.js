// 原版材料柜 GLB 加载器：精确保留用户提供的 58 个几何对象，居中后置于地面。
// V1 只做真实模型展示，禁止从三角片/辅助线推断工程板件清单。
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import { originalGlbBytes } from '../assets/sheetCabinetGlb.js';
import { SHEET_ORIGINAL } from '../config/sheet.js';
import { thickenPlanarSheet, createSheetEdgeDetails } from './sheetDetailGeometry.js';
import { getSpangleTexture } from './spangleTexture.js';

let templatePromise;
async function loadTemplate() {
  if (!templatePromise) {
    templatePromise = (async () => {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const bytes = await originalGlbBytes();
      const gltf = await new Promise((resolve, reject) =>
        new GLTFLoader().parse(bytes, '', resolve, reject));
      const original = gltf.scene;
      original.updateMatrixWorld(true);
      const srcBox = new THREE.Box3().setFromObject(original);
      if (srcBox.isEmpty()) throw new Error('材料柜源模型没有有效几何');
      // 源 Rhino 场景坐标约 (-26.5m, +1.2m, -21.7m)：仅平移原模型，不缩放/重建。
      const pivot = new THREE.Group();
      pivot.name = 'GalvanizedCabinet_Original';
      original.position.sub(new THREE.Vector3(
        (srcBox.min.x + srcBox.max.x) / 2,
        srcBox.min.y,
        (srcBox.min.z + srcBox.max.z) / 2,
      ));
      pivot.add(original);
      pivot.updateMatrixWorld(true);
      const bounds = computeEnvelope(pivot);
      if ([bounds.W, bounds.H, bounds.D].some(x => !Number.isFinite(x) || x <= 0))
        throw new Error('材料柜 GLB 尺寸异常');
      let meshes = 0, guides = 0;
      pivot.traverse(o => {
        if (o.isMesh) meshes++;
        else if (o.isLine || o.isLineSegments) guides++;
      });
      return { pivot, bounds, meshCount: meshes, guideCount: guides };
    })().catch(err => { templatePromise = null; throw err; });
  }
  return templatePromise;
}

export function sheetPreviewStats() {
  return {
    profileLengthM: 0, weightKg: 0, partCount: 0,
    cutList: [], hardware: [], panes: [],
    envelope: { W: SHEET_ORIGINAL.W, H: SHEET_ORIGINAL.H, D: SHEET_ORIGINAL.D },
    meshCount: SHEET_ORIGINAL.meshCount,
    guideCount: SHEET_ORIGINAL.guideCount,
    prototypeOnly: true,
  };
}

export function createSheetPlaceholder() {
  const group = new THREE.Group();
  group.name = 'GalvanizedCabinet_Loading';
  return {
    group, groups: {}, stats: sheetPreviewStats(),
    bounds: { ...SHEET_ORIGINAL },
    dispose() { group.removeFromParent(); },
  };
}

// Exported so resource-ownership tests can cover the template clone path even
// when the embedded production GLB happens to contain no textures.
export function cloneSheetGroup(source) {
  const clone = source.clone(true);
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const textureClones = new Map();
  const ownMaterial = (material) => {
    if (!material) return material;
    const owned = material.clone();
    materials.add(owned);
    for (const [slot, value] of Object.entries(owned)) {
      if (!value?.isTexture) continue;
      let texture = textureClones.get(value);
      if (!texture) {
        texture = value.clone();
        textureClones.set(value, texture);
        textures.add(texture);
      }
      owned[slot] = texture;
    }
    return owned;
  };
  clone.traverse((object) => {
    if (!object.isMesh && !object.isLine && !object.isLineSegments) return;
    if (object.geometry) {
      object.geometry = object.geometry.clone();
      geometries.add(object.geometry);
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(ownMaterial)
      : ownMaterial(object.material);
  });
  return {
    group: clone,
    geometries: [...geometries],
    materials: [...materials],
    textures: [...textures],
  };
}

export async function buildSheetCabinet(cfg = {}) {
  const { pivot, bounds, meshCount, guideCount } = await loadTemplate();
  const cloned = cloneSheetGroup(pivot);
  const { group, geometries: templateGeometries, materials: templateMaterials, textures: templateTextures } = cloned;
  group.name = 'GalvanizedCabinet';

  // 永远保留用户的原始 GLB 模板；下方仅对当前场景副本追加展示层。
  const thickness = ([1, 1.5, 2].includes(cfg.thicknessMm) ? cfg.thicknessMm : 1.5) / 1000;
  const actualCfg = {
    thicknessMm: thickness * 1000,
    folds: cfg.folds !== false,
    fasteners: cfg.fasteners !== false,
  };
  const useSatin = cfg.finish === 'satin';
  const faceMetal = new THREE.MeshStandardMaterial({
    name: 'GalvanizedSheetFace',
    color: useSatin ? 0xb6bab9 : 0xc0c8c9,
    metalness: useSatin ? 0.44 : 0.62,
    roughness: useSatin ? 0.56 : 0.39,
    side: THREE.DoubleSide,
  });
  // 锌灰金属叠加微细晶粒：仅用于有效板面UV，不把所有原始封闭几何误贴花纹。
  const zincMetal = faceMetal.clone();
  zincMetal.name = 'GalvanizedFineSpangle';
  if (!useSatin) zincMetal.map = getSpangleTexture();
  const edgeMetal = new THREE.MeshStandardMaterial({
    name: 'GalvanizedFoldedEdge',
    color: useSatin ? 0xa4acae : 0xaab5ba,
    metalness: 0.67, roughness: 0.45,
  });
  const rivetMetal = new THREE.MeshStandardMaterial({
    name: 'GalvanizedFastenerHead',
    color: 0x77868d, metalness: 0.76, roughness: 0.3,
  });
  const ownedGeometries = [];
  let sheetSurfaces = 0, foldCount = 0, fastenerCount = 0;

  // 防止向正在 traverse 的层级追加子节点而导致重复处理。
  const originalMeshes = [];
  group.traverse(o => {
    if (o.isMesh) originalMeshes.push(o);
    if (o.isLine || o.isLineSegments) o.visible = !!cfg.showGuides;
  });
  originalMeshes.forEach((mesh, i) => {
    const thickened = thickenPlanarSheet(mesh.geometry, thickness);
    if (thickened) {
      mesh.geometry = thickened.geometry;
      // Rhino三角面通常没有有效UV；按板面真实尺寸投影，0.48m重复一个晶粒纹理。
      // 做投影后同一零件的相邻薄面UV固定，不会被拉成巨型锌花。
      if (!useSatin) {
        const p = thickened.geometry.getAttribute('position');
        const normal = thickened.normal;
        const dominant = Math.abs(normal.y) > 0.8 ? 'y'
          : Math.abs(normal.x) > 0.8 ? 'x' : 'z';
        const uv = new Float32Array(p.count * 2);
        for (let vi=0;vi<p.count;vi++) {
          const x=p.getX(vi),y=p.getY(vi),z=p.getZ(vi);
          uv[vi*2] = (dominant === 'x' ? z : x) / 0.48;
          uv[vi*2+1] = (dominant === 'y' ? z : y) / 0.48;
        }
        thickened.geometry.setAttribute('uv', new THREE.BufferAttribute(uv,2));
        mesh.material = zincMetal;
      }
      ownedGeometries.push(thickened.geometry);
      sheetSurfaces++;
      mesh.name = `FoldableSheet_${i}`;
      mesh.userData.sheetThicknessMm = actualCfg.thicknessMm;
      const details = createSheetEdgeDetails(thickened, actualCfg, edgeMetal, rivetMetal);
      if (details.group.children.length) mesh.add(details.group);
      ownedGeometries.push(...details.createdGeometry);
      foldCount += details.foldCount;
      fastenerCount += details.fastenerCount;
    }
    // 闭合的原始箱体保留原结构，统一金属视觉语言。
    if (!thickened || useSatin) mesh.material = faceMetal;
  });

  // Rhino 原型右侧是裸露的分格端口。新增独立金属薄板终止面，
  // 位置从源 GLB 整机 bounds 推导，不修改44个源网格，也不冒充可下料工程零件。
  const endCapGroup = new THREE.Group();
  endCapGroup.name = 'RightEndClosure';
  const endT = thickness;
  const endX = bounds.W / 2 + endT / 2;
  const closureHeight = bounds.H;
  const closureDepth = bounds.D;
  const closureGeo = new THREE.BoxGeometry(endT, closureHeight, closureDepth);
  const closure = new THREE.Mesh(closureGeo, useSatin ? faceMetal : zincMetal);
  closure.name = 'RightEndCapThinSheet';
  closure.position.set(endX, bounds.H / 2, 0);
  endCapGroup.add(closure);
  ownedGeometries.push(closureGeo);
  if (actualCfg.folds) {
    // 右端前折回边：板厚不变，只增加12mm宽卷边以遮住原模型的裸露截面。
    const returnGeo = new THREE.BoxGeometry(0.012, closureHeight, endT);
    const returnEdge = new THREE.Mesh(returnGeo, edgeMetal);
    returnEdge.name = 'RightEndReturnFold';
    returnEdge.position.set(bounds.W / 2 + endT - 0.006, bounds.H / 2, closureDepth / 2 - endT / 2);
    endCapGroup.add(returnEdge);
    ownedGeometries.push(returnGeo);
    foldCount++;
  }
  group.add(endCapGroup);
  const stats = {
    ...sheetPreviewStats(),
    envelope: computeEnvelope(group), meshCount, guideCount,
    displayDetails: {
      sheetSurfaces, foldCount, fastenerCount, rightEndClosure: true,
      thicknessMm: actualCfg.thicknessMm, finish: useSatin ? 'satin' : 'zinc',
    },
  };
  return {
    group, groups: { model: group, rightEndClosure: endCapGroup }, stats, bounds: { ...bounds },
    dispose() {
      group.removeFromParent();
      ownedGeometries.forEach(g => g.dispose());
      templateTextures.forEach(t => t.dispose());
      templateMaterials.forEach(m => m.dispose());
      templateGeometries.forEach(g => g.dispose());
      faceMetal.dispose();
      zincMetal.dispose();
      edgeMetal.dispose();
      rivetMetal.dispose();
    },
  };
}

export async function downloadOriginalSheetGlb() {
  const bytes = await originalGlbBytes();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'MEKIT-Galvanized-Cabinet-Original.glb';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return a.download;
}
