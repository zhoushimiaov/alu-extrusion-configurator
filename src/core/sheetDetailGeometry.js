// Rhino 导出的板面只有三角形表皮，不能直接当成带厚度的金属板。
// 对共面三角形焊接顶点、提取真正的外边界，并生成正反两面与封闭侧壁。
// 只用于显示模型；折边/厚度为可调整的设计推演，不能直接当下料工程图。
import * as THREE from 'three';

const KEY_PRECISION = 1e4;
const keyOf = (v) => [v.x, v.y, v.z].map(n => Math.round(n * KEY_PRECISION)).join(':');

export function thickenPlanarSheet(source, thickness = 0.0015) {
  if (!(thickness > 0 && thickness <= 0.01)) throw new Error('Sheet thickness must be within 0–10mm');
  const attr = source.getAttribute('position');
  if (!attr || attr.count < 3) return null;
  const index = source.getIndex();
  const size = index ? index.count : attr.count;
  if (size % 3 !== 0) return null;

  const vertices = [];
  const remap = new Map();
  const triangles = [];
  function vertex(i) {
    const pos = new THREE.Vector3().fromBufferAttribute(attr, i);
    const key = keyOf(pos);
    if (!remap.has(key)) {
      remap.set(key, vertices.length);
      vertices.push(pos);
    }
    return remap.get(key);
  }
  const getIndex = i => index ? index.getX(i) : i;
  for (let i = 0; i < size; i += 3) {
    const a = vertex(getIndex(i));
    const b = vertex(getIndex(i + 1));
    const c = vertex(getIndex(i + 2));
    if (a !== b && b !== c && c !== a) triangles.push([a, b, c]);
  }
  if (!triangles.length) return null;
  const normal = new THREE.Vector3();
  let normalFound = false;
  for (const [a, b, c] of triangles) {
    const e1 = vertices[b].clone().sub(vertices[a]);
    const e2 = vertices[c].clone().sub(vertices[a]);
    normal.crossVectors(e1, e2);
    if (normal.lengthSq() > 1e-12) { normal.normalize(); normalFound = true; break; }
  }
  if (!normalFound) return null;
  const origin = vertices[triangles[0][0]];
  // 不能把立体箱体误判成薄板；原始板面误差在 0.1mm 内。
  if (vertices.some(v => Math.abs(normal.dot(v.clone().sub(origin))) > 0.0001)) return null;

  const edges = new Map();
  for (const [a, b, c] of triangles) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      const old = edges.get(key);
      if (old) old.count++;
      else edges.set(key, { a: u, b: v, count: 1 });
    }
  }
  const boundaries = [...edges.values()].filter(e => e.count === 1);
  if (!boundaries.length) return null;

  // 每个顶点前后各放一个副本；两面三角面相反方向。
  const positions = [];
  for (const p of vertices) {
    const up = p.clone().addScaledVector(normal, thickness / 2);
    const down = p.clone().addScaledVector(normal, -thickness / 2);
    positions.push(up.x, up.y, up.z, down.x, down.y, down.z);
  }
  const faces = [];
  for (const [a, b, c] of triangles) {
    faces.push(2*a, 2*b, 2*c, 2*c+1, 2*b+1, 2*a+1);
  }
  for (const e of boundaries) {
    const a = 2 * e.a, b = 2 * e.b;
    // 顶面三角形反向时同样需要边界法线一致；双面材质兜底。
    faces.push(a, a+1, b, b, a+1, b+1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return {
    geometry, normal,
    boundaries: boundaries.map(e => ({ a: vertices[e.a], b: vertices[e.b] })),
    box: source.boundingBox || (source.computeBoundingBox(), source.boundingBox),
  };
}

/** 可见的翻边只应用到原始板面的轮廓，不对已经闭合的箱体做二次“包厚”。 */
export function createSheetEdgeDetails(sheet, cfg, finish, hardware) {
  const group = new THREE.Group();
  group.name = 'SheetFabricationDetails';
  const createdGeometry = [];
  const t = cfg.thicknessMm / 1000;
  const foldDepth = 0.018;
  let foldCount = 0;
  let fastenerCount = 0;
  const box = sheet.box;
  const isHorizontal = Math.abs(sheet.normal.y) > 0.98;
  const isVertical = Math.abs(sheet.normal.y) < 0.1;
  const metal = finish;
  const boltGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.002, 12);

  if (cfg.folds) {
    for (const { a, b } of sheet.boundaries) {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      if (isHorizontal && Math.abs(dx) > 0.22 && Math.abs(dy) < 0.004 &&
          Math.abs(dz) < 0.004 && Math.max(a.z, b.z) >= box.max.z - 0.004) {
        // 横板正面下折 18mm：可见的镀锌板前边缘，不额外改变板面平面形状。
        const geo = new THREE.BoxGeometry(Math.abs(dx), foldDepth, t);
        createdGeometry.push(geo);
        const part = new THREE.Mesh(geo, metal);
        part.name = 'FrontHem';
        part.position.set((a.x+b.x)/2, (a.y+b.y)/2 - t/2 - foldDepth/2, (a.z+b.z)/2);
        group.add(part);
        foldCount++;
      }
      if (isVertical && Math.abs(dy) > 0.17 && Math.abs(dx) < 0.004 &&
          Math.abs(dz) < 0.004 && Math.max(a.z, b.z) >= box.max.z - 0.004) {
        // 斜向立板在可视前端做 18mm 回折，沿板面法向生成真实厚度的侧边。
        const geo = new THREE.BoxGeometry(foldDepth, Math.abs(dy), t);
        createdGeometry.push(geo);
        const part = new THREE.Mesh(geo, metal);
        part.name = 'DiagonalPanelReturn';
        part.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), sheet.normal);
        part.position.copy(a).add(b).multiplyScalar(0.5)
          .addScaledVector(sheet.normal, -foldDepth / 2);
        group.add(part);
        foldCount++;
      }
    }
  }
  if (cfg.fasteners && isHorizontal && box.max.x - box.min.x > 1) {
    const first = box.min.x + 0.085;
    const last = box.max.x - 0.085;
    const z = box.max.z - 0.045;
    for (const x of [first, last]) {
      const head = new THREE.Mesh(boltGeo, hardware);
      head.name = 'FixingRivet';
      head.position.set(x, (box.min.y+box.max.y)/2 + t/2 + 0.001, z);
      group.add(head);
      fastenerCount++;
    }
  }
  if (!fastenerCount) boltGeo.dispose();
  else createdGeometry.push(boltGeo);
  return { group, createdGeometry, foldCount, fastenerCount };
}
