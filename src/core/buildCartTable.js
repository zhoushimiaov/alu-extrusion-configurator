// 移动边几参数化装配（参考图复刻）
// 结构：4×2040 木纹立柱 + 顶/中/底三层 2020 框 + 顶部玻璃 + 中层亚克力
//       + 前后 ⌀12 光轴挂杆（十字夹块固定，双杆/侧）+ 底框 + 4 万向轮
import * as THREE from 'three';
import { CART_D, RAIL_D, DENSITY_ALU, DENSITY_STEEL, DEFAULT_CART_CONFIG } from '../config/cart.js';
import { getCartMaterials } from './cartMaterials.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function setMT(i, mesh, x, y, z, sx = 1, sy = 1, sz = 1) {
  _q.identity();
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m4.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m4);
}

// 入场动画逐 child 改 opacity：每个 child 独立材质
function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, mat.clone(), count) : null;
}

const BEAM = 0.02;   // 2020 梁截面 20mm
const POST_W = 0.04; // 2040 立柱宽 40mm

export function buildCartTable(config) {
  const cfg = { ...DEFAULT_CART_CONFIG, ...config };
  const { width, depth, height, glassTop, midAcrylic, rodRails, casters, woodFinish } = cfg;
  const mat = getCartMaterials(woodFinish);

  const group = new THREE.Group();
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width;    // 柱心距 X
  const D = depth;    // 柱心距 Z
  const H = height;   // 柱长
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  // 高度：轮 0.05 + 底框 0.03 → 柱底 y0；柱顶 y0+H；顶框在柱顶上方
  const yWheel = 0.05;
  const yBottomFrame = yWheel + BEAM / 2 + 0.02;   // 底框中心
  const yPost0 = yBottomFrame + BEAM / 2;          // 柱底
  const yPost1 = yPost0 + H;                       // 柱顶
  const yTopFrame = yPost1 + BEAM / 2;             // 顶框中心
  // 中层框：柱高约 62% 处（参考图中层板在上半段）
  const yMidFrame = yPost0 + H * 0.62;

  // ---- 几何 ----
  const beamXGeo = new THREE.BoxGeometry(1, BEAM, BEAM);                  // X 向梁
  const beamZGeo = new THREE.BoxGeometry(BEAM, BEAM, 1);                  // Z 向梁
  const postGeo = new THREE.BoxGeometry(POST_W, 1, POST_W);               // 2040 柱（简化方柱）
  const railXGeo = new THREE.CylinderGeometry(1, 1, 1, 12); railXGeo.rotateZ(Math.PI / 2);
  const boardGeo = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.018, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const forkGeo = new THREE.BoxGeometry(0.028, 0.05, 0.03);               // 轮叉
  const clampGeo = new THREE.BoxGeometry(0.032, 0.05, 0.032);             // 光轴十字夹块

  // ---- 立柱 ×4（2040 木纹）----
  const posts = instanced(postGeo, mat.post, 4);
  let i = 0;
  for (const x of postXs) for (const z of postZs) {
    setMT(i++, posts, x, yPost0 + H / 2, z, 1, H, 1);
  }
  group.add(posts);

  // ---- 三层方框（每层 2×X 梁 + 2×Z 梁，外沿对齐柱外缘）----
  const frameLenX = W + POST_W;   // X 梁长（覆盖柱外缘）
  const frameLenZ = D + POST_W;
  const frames = [];
  for (const y of [yBottomFrame, yMidFrame, yTopFrame]) {
    const f = instanced(beamXGeo, mat.beam, 2);
    setMT(0, f, 0, y, -pz - POST_W / 2 + BEAM / 2, frameLenX - 0.002, 1, 1);
    setMT(1, f, 0, y, pz - POST_W / 2 - BEAM / 2 + 0.002, frameLenX - 0.002, 1, 1);
    group.add(f);
    const fz = instanced(beamZGeo, mat.beam, 2);
    setMT(0, fz, -px - POST_W / 2 + BEAM / 2, y, 0, 1, 1, frameLenZ - 0.002);
    setMT(1, fz, px - POST_W / 2 - BEAM / 2 + 0.002, y, 0, 1, 1, frameLenZ - 0.002);
    group.add(fz);
    frames.push({ y });
  }
  stats.profileLengthM += 3 * (2 * frameLenX + 2 * frameLenZ);

  // ---- 顶部玻璃（覆盖顶框，微超出）----
  let panes = [];
  if (glassTop) {
    const g = instanced(boardGeo, mat.glass, 1);
    setMT(0, g, 0, yTopFrame + BEAM / 2 + 0.004, 0, frameLenX + 0.05, 0.008, frameLenZ + 0.05);
    group.add(g);
    panes.push({ label: '钢化玻璃台面', areaM2: +(((frameLenX + 0.05) * (frameLenZ + 0.05))).toFixed(3), kind: 'glass' });
  }

  // ---- 中层橙色亚克力板（落于中框，覆盖框内 + 微搭框沿）----
  if (midAcrylic !== 'none') {
    const a = instanced(boardGeo, midAcrylic === 'amber' ? mat.amber : mat.frost, 1);
    setMT(0, a, 0, yMidFrame + BEAM / 2 + 0.003, 0, frameLenX - 0.01, 0.006, frameLenZ - 0.01);
    group.add(a);
    const area = ((frameLenX - 0.01) * (frameLenZ - 0.01));
    panes.push({
      label: midAcrylic === 'amber' ? '橙色亚克力中板' : '磨砂亚克力中板',
      areaM2: +area.toFixed(3),
      kind: 'acrylic',
    });
  }

  // ---- 前后光轴挂杆（每侧 2 根 ⌀12，X 向，穿四角十字夹块）----
  let railCount = 0;
  if (rodRails) {
    // 挂杆高度：参考图前后各两根（中层框上方 + 下方），位于前后面（z=±(pz+POST_W/2+0.012)）
    const zRail = pz + POST_W / 2 + 0.014;
    const railYs = [yMidFrame - BEAM, yMidFrame + BEAM + 0.05];
    const rails = instanced(railXGeo, mat.rod, railYs.length * 2);
    let ri = 0;
    for (const ry of railYs) {
      for (const sz of [1, -1]) {
        setMT(ri++, rails, 0, ry, sz * zRail, frameLenX + 0.06, RAIL_D / 2, RAIL_D / 2);
        stats.profileLengthM += frameLenX + 0.06;
        railCount++;
      }
    }
    group.add(rails);
    // 十字夹块：每根光轴两端 + 与立柱交汇处
    const clamps = instanced(clampGeo, mat.clamp, railYs.length * 2 * 2);
    let ci = 0;
    for (const ry of railYs) {
      for (const sz of [1, -1]) {
        setMT(ci++, clamps, -px - 0.01, ry, sz * zRail);
        setMT(ci++, clamps, px + 0.01, ry, sz * zRail);
      }
    }
    group.add(clamps);
  }

  // ---- 角件（三层框 8 角 × 3 层 = 12 组）----
  const nCorners = 12;
  const corners = instanced(clampGeo, mat.clamp, nCorners);
  {
    let ci = 0;
    for (const y of [yBottomFrame, yMidFrame, yTopFrame]) {
      for (const x of postXs) {
        for (const z of postZs) {
          setMT(ci++, corners, x, y, z);
        }
      }
    }
  }
  group.add(corners);

  // ---- 万向轮 / 地脚 ×4（底框四角下方）----
  let wheelParts = 0;
  if (casters) {
    const wheels = instanced(wheelGeo, mat.clamp, 4);
    const forks = instanced(forkGeo, mat.clamp, 4);
    let wi = 0;
    for (const x of postXs) {
      for (const z of postZs) {
        setMT(wi, wheels, x, 0.025, z);
        setMT(wi, forks, x, 0.05, z);
        wi++;
      }
    }
    group.add(wheels);
    group.add(forks);
    wheelParts = 8;
  } else {
    const feet = instanced(forkGeo, mat.clamp, 4);
    let fi = 0;
    for (const x of postXs) {
      for (const z of postZs) {
        setMT(fi++, feet, x, 0.015, z);
      }
    }
    group.add(feet);
    wheelParts = 4;
  }

  // ---- 统计 ----
  const postLen = H + BEAM * 2; // 立柱贯穿三层框
  stats.profileLengthM += 4 * postLen;

  const volAlu = (4 * postLen * POST_W * POST_W
    + 3 * (2 * frameLenX + 2 * frameLenZ) * BEAM * BEAM
    + railCount * (frameLenX + 0.06) * Math.PI * (RAIL_D / 2) ** 2) * 1.0;
  const glassArea = glassTop ? (frameLenX + 0.05) * (frameLenZ + 0.05) : 0;
  const acrArea = midAcrylic !== 'none' ? (frameLenX - 0.01) * (frameLenZ - 0.01) : 0;
  stats.weightKg = volAlu * DENSITY_ALU
    + glassArea * 0.008 * 2500
    + acrArea * 0.006 * 1190
    + nCorners * 0.02 + (casters ? 4 * 0.15 : 4 * 0.05);

  stats.partCount = 4 + 6 + railCount + (rodRails ? railCount * 2 : 0) + nCorners + wheelParts + (glassTop ? 1 : 0) + (midAcrylic !== 'none' ? 1 : 0);

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('立柱 2040（木纹贴膜）', '2040', +postLen.toFixed(3), 4);
  addCut('框梁 2020', '2020', +frameLenX.toFixed(3), 6);
  addCut('框梁 2020', '2020', +frameLenZ.toFixed(3), 6);
  if (rodRails) addCut('光轴挂杆', '12', +(frameLenX + 0.06).toFixed(3), railCount);
  if (glassTop) stats.cutList.push({ spec: '钢化玻璃台面', section: '板', len: +(frameLenX + 0.05).toFixed(2), qty: 1 });
  if (midAcrylic !== 'none') stats.cutList.push({ spec: midAcrylic === 'amber' ? '橙色亚克力中板' : '磨砂亚克力中板', section: '板', len: +(frameLenX - 0.01).toFixed(2), qty: 1 });
  stats.panes = panes;
  stats.hardware = [
    casters ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '十字光轴夹块', qty: rodRails ? 8 : 0 },
    { name: '角件', qty: nCorners },
    ...(glassTop ? [{ name: '玻璃减震垫片', qty: 4 }] : []),
    ...(midAcrylic !== 'none' ? [{ name: '中板压条', qty: 2 }] : []),
  ].filter(h => h.qty > 0);

  return {
    group,
    stats,
    bounds: { W: frameLenX + 0.14, H: yTopFrame + BEAM + (glassTop ? 0.02 : 0) + 0.05, D: frameLenZ + 0.10 },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      Object.values(mat).forEach(m => m && m.dispose());
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
