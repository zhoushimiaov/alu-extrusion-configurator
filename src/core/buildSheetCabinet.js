// 原版材料柜 GLB 加载器：精确保留用户提供的 58 个几何对象，居中后置于地面。
// V1 只做真实模型展示，禁止从三角片/辅助线推断工程板件清单。
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import { originalGlbBytes } from '../assets/sheetCabinetGlb.js';
import { SHEET_ORIGINAL } from '../config/sheet.js';
import { thickenPlanarSheet, createSheetEdgeDetails } from './sheetDetailGeometry.js';

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

export async function buildSheetCabinet(cfg = {}) {
  const { pivot, bounds, meshCount, guideCount } = await loadTemplate();
  const group = pivot.clone(true);
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
    mesh.material = faceMetal;
  });
  const stats = {
    ...sheetPreviewStats(),
    envelope: { ...bounds }, meshCount, guideCount,
    displayDetails: {
      sheetSurfaces, foldCount, fastenerCount,
      thicknessMm: actualCfg.thicknessMm, finish: useSatin ? 'satin' : 'zinc',
    },
  };
  return {
    group, groups: { model: group }, stats, bounds: { ...bounds },
    dispose() {
      group.removeFromParent();
      ownedGeometries.forEach(g => g.dispose());
      faceMetal.dispose();
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
