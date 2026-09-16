// 光轴木展车参数化装配（参考图复刻）
// 结构：底部胶合板柜体（含洞洞板背板）+ 4×⌀16 光轴立柱（穿柜角法兰）
//       + 中间 shelves 层胶合板层板（光轴夹块定位）+ 顶部横挂杆（十字夹块）
//       + 侧向挂杆（选配）+ 4 万向轮
import * as THREE from 'three';
import { ROD_D, RAIL_D, BOARD_T, DENSITY_STEEL, DENSITY_PLY, DEFAULT_WOODCART_CONFIG } from '../config/woodcart.js';
import { getWoodCartMaterials } from './woodcartMaterials.js';

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

function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, mat.clone(), count) : null;
}

const rodYGeo = new THREE.CylinderGeometry(1, 1, 1, 14);

export function buildWoodCart(config) {
  const cfg = { ...DEFAULT_WOODCART_CONFIG, ...config };
  const { width, depth, height, shelves, cabinetH, pegboard, topRail, sideRail, casters, woodTone } = cfg;
  const mat = getWoodCartMaterials(woodTone);

  const group = new THREE.Group();
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width, D = depth, H = height;
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  const yWheel = 0.05;
  const cabTop = cabinetH;                  // 柜体顶面
  const yPost0 = cabTop - 0.02;             // 立柱穿入柜体
  const yPost1 = yPost0 + H;
  const midZones = shelves + 1;             // 层板把柱身上段分成 shelves+1 段
  const zoneH = (yPost1 - cabTop) / midZones;

  // ---- 几何 ----
  const rodGeo = rodYGeo;
  const boardXGeo = new THREE.BoxGeometry(1, BOARD_T, D - 0.04);   // 层板（X 长）
  const cabinetSideGeo = new THREE.BoxGeometry(BOARD_T, cabinetH, D);  // 侧板
  const cabinetBottomGeo = new THREE.BoxGeometry(W + 0.02, BOARD_T, D); // 底板
  const cabinetTopGeo = new THREE.BoxGeometry(W + 0.02, BOARD_T, D);    // 顶板
  const pegGeo = new THREE.BoxGeometry(W - 0.02, cabinetH - BOARD_T, 0.01); // 洞洞板（背面）
  const clampGeo = new THREE.BoxGeometry(0.034, 0.028, 0.034);
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.018, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const forkGeo = new THREE.BoxGeometry(0.028, 0.05, 0.03);
  const flangeGeo = new THREE.BoxGeometry(0.05, 0.012, 0.05);   // 立柱穿柜法兰

  // ---- 柜体（侧板 ×2 + 底板 + 顶板 + 背板洞洞板）----
  const sides = instanced(cabinetSideGeo, mat.wood, 2);
  setMT(0, sides, -px + BOARD_T / 2, cabinetH / 2, 0);
  setMT(1, sides, px - BOARD_T / 2, cabinetH / 2, 0);
  group.add(sides);
  const bottom = instanced(cabinetBottomGeo, mat.wood, 1);
  setMT(0, bottom, 0, BOARD_T / 2 + 0.01, 0);
  group.add(bottom);
  const top = instanced(cabinetTopGeo, mat.wood, 1);
  setMT(0, top, 0, cabTop - BOARD_T / 2, 0);
  group.add(top);
  if (pegboard) {
    const peg = instanced(pegGeo, mat.pegboard, 1);
    setMT(0, peg, 0, cabinetH / 2, -pz + BOARD_T / 2 + 0.005);
    group.add(peg);
  }
  // 柜体内部分隔（中部竖隔板）
  const divider = instanced(new THREE.BoxGeometry(BOARD_T, cabinetH - BOARD_T * 2, D - 0.06), mat.wood, 1);
  setMT(0, divider, 0, cabinetH / 2, 0);
  group.add(divider);

  // ---- 立柱 ×4（⌀16 光轴，穿柜角法兰到顶）----
  const postLen = H + 0.06;
  const posts = instanced(rodGeo, mat.rod, 4);
  let i = 0;
  for (const x of postXs) for (const z of postZs) {
    setMT(i++, posts, x, yPost0 + H / 2, z, ROD_D / 2, postLen, ROD_D / 2);
  }
  group.add(posts);
  stats.profileLengthM += 4 * postLen;
  // 法兰 ×4（柜顶面）
  const flanges = instanced(flangeGeo, mat.clamp, 4);
  let fi = 0;
  for (const x of postXs) for (const z of postZs) {
    setMT(fi++, flanges, x, cabTop + 0.006, z);
  }
  group.add(flanges);

  // ---- 中间层板 ×shelves（套柱，光轴夹块定位）----
  const shelfYs = [];
  for (let s = 1; s <= shelves; s++) {
    shelfYs.push(cabTop + zoneH * s);
  }
  const shelfBoards = instanced(boardXGeo, mat.wood, shelves);
  let si = 0;
  for (const sy of shelfYs) {
    setMT(si++, shelfBoards, 0, sy, 0, W - 0.02, 1, 1);
  }
  group.add(shelfBoards);
  // 层板夹块 ×4/层
  const shelfClamps = instanced(clampGeo, mat.clamp, shelves * 4);
  let sci = 0;
  for (const sy of shelfYs) {
    for (const x of postXs) {
      for (const z of postZs) {
        setMT(sci++, shelfClamps, x, sy - BOARD_T / 2 - 0.012, z);
      }
    }
  }
  group.add(shelfClamps);

  // ---- 顶部挂杆（横跨两前柱 + 两后柱，各 1 根 ⌀12）----
  let railCount = 0;
  if (topRail) {
    const railLen = W + 0.06;
    const rails = instanced(new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2), mat.rod, 2);
    let ri = 0;
    for (const z of postZs) {
      setMT(ri++, rails, 0, yPost1 - 0.05, z, railLen, RAIL_D / 2, RAIL_D / 2);
      stats.profileLengthM += railLen;
      railCount++;
    }
    group.add(rails);
    // 挂杆端夹块（各 2）
    const railClamps = instanced(clampGeo, mat.clamp, 4);
    let rci = 0;
    for (const z of postZs) {
      for (const x of postXs) {
        setMT(rci++, railClamps, x, yPost1 - 0.05, z);
      }
    }
    group.add(railClamps);
  }

  // ---- 侧向挂杆（左右各 1 根，Z 向）----
  if (sideRail) {
    const railLenZ = D + 0.06;
    const sideRails = instanced(new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2), mat.rod, 2);
    let sri = 0;
    for (const x of postXs) {
      setMT(sri++, sideRails, x, yPost1 - 0.05, 0, RAIL_D / 2, RAIL_D / 2, railLenZ);
      stats.profileLengthM += railLenZ;
      railCount++;
    }
    group.add(sideRails);
  }

  // ---- 万向轮 / 地脚 ×4 ----
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
    let fi2 = 0;
    for (const x of postXs) {
      for (const z of postZs) {
        setMT(fi2++, feet, x, 0.015, z);
      }
    }
    group.add(feet);
    wheelParts = 4;
  }

  // ---- 统计 ----
  const volRod = 4 * postLen * Math.PI * (ROD_D / 2) ** 2
    + railCount * ((W + 0.06) * Math.PI * (RAIL_D / 2) ** 2);
  const plyArea = (2 * cabinetH * D + 2 * (W + 0.02) * D + (W - 0.02) * (cabinetH - BOARD_T)
    + shelves * (W - 0.02) * (D - 0.04));
  stats.weightKg = volRod * DENSITY_STEEL
    + plyArea * BOARD_T * DENSITY_PLY
    + 4 * 0.02 + (casters ? 4 * 0.15 : 4 * 0.05)
    + shelves * 4 * 0.01;
  stats.partCount = 4 + 4 + (pegboard ? 1 : 0) + 1 + 2 + shelves * 5 + (topRail ? 6 : 0) + (sideRail ? 2 : 0) + wheelParts;

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('光轴立柱', '16', +postLen.toFixed(3), 4);
  if (topRail) addCut('顶部挂杆', '12', +(W + 0.06).toFixed(3), 2);
  if (sideRail) addCut('侧向挂杆', '12', +(D + 0.06).toFixed(3), 2);
  const plyItems = [
    { spec: '柜体侧板', w: cabinetH, d: D, qty: 2 },
    { spec: '柜体底板', w: W + 0.02, d: D, qty: 1 },
    { spec: '柜体顶板', w: W + 0.02, d: D, qty: 1 },
    ...(pegboard ? [{ spec: '洞洞板背板', w: cabinetH - BOARD_T, d: W - 0.02, qty: 1 }] : []),
    ...Array.from({ length: shelves }, (_, s) => ({ spec: `层板 ${s + 1}`, w: W - 0.02, d: D - 0.04, qty: 1 })),
  ];
  for (const p of plyItems) {
    stats.cutList.push({ spec: `${p.spec}（胶合板 ${Math.round(BOARD_T * 1000)}mm）`, section: '板', len: +p.w.toFixed(2), qty: p.qty });
  }
  stats.panes = [];
  stats.hardware = [
    casters ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '立柱穿柜法兰', qty: 4 },
    { name: '光轴夹块', qty: shelves * 4 + (topRail ? 4 : 0) },
    { name: '角码', qty: 8 },
  ];

  return {
    group,
    stats,
    bounds: { W: W + 0.14, H: yPost1 + 0.06, D: D + 0.14 },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      Object.values(mat).forEach(m => m && m.dispose());
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
