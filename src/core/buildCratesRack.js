// 周转箱收纳架参数化装配（参考图复刻 v2）
// 结构（真实铝型材）：
//   4×2040 立柱（makeTSlotShape(.04,.02) tall 截面，extrudeUp）—— 槽口朝外
//   底框/顶框：X 梁 extrudeAlongX(makeTSlotShape(.02,.02))，Z 梁 extrudeAlongZ(makeTSlotShape(.02,.02))
//   每层滑轨 ×2：extrudeAlongZ(2020 截面)，箱底滚落沿
//   周转箱：正立方梯台（Box 主体叠台），正交摆放不歪斜；口沿加强圈
//   万向轮 / 调平地脚
import * as THREE from 'three';
import { RAIL_BEAM, DENSITY_ALU, DEFAULT_CRATES_CONFIG, SCHEME_SEQ, CRATE_COLORS, CRATE_SCHEMES } from '../config/crates.js';
import { makeTSlotShape, extrudeUp, extrudeAlongX, extrudeAlongZ } from './profiles.js';
import { getCutMaterial } from './materials.js';

const _m4 = new THREE.Matrix4();

function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, mat.clone(), count) : null;
}

const BEAM = 0.02;
const POST_W = 0.04;

export function buildCratesRack(config) {
  const cfg = { ...DEFAULT_CRATES_CONFIG, ...config };
  const { width, depth, height, tiers, scheme, pullOut, casters } = cfg;
  const matAlu = new THREE.MeshPhysicalMaterial({ color: 0xd4d8dc, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.0 });
  const matCut = getCutMaterial();
  const matClamp = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.45, metalness: 0.7 });
  const matWheel = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.3 });

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width, D = depth, H = height;
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  const yWheel = 0.05;
  const yBottom = yWheel + 0.045;
  const yPost0 = yBottom + BEAM / 2;
  const yPost1 = yPost0 + H;
  const yTop = yPost1 + BEAM / 2;

  const span = yPost1 - yPost0 - BEAM;
  const tierH = span / tiers;

  // ---- 周转箱尺寸约束（必须整体位于层架内，抽出后也不穿立柱/横梁/滑轨）----
  // 立柱内表面：X 向 ±(px - POST_W/2)，Z 向 ±(pz - POST_W/2)
  const innerX = px - POST_W / 2;
  const innerZ = pz - POST_W / 2;
  // 抽出距离（交替抽出）：越小越能给出更大的箱体，同时保证不越出立柱平面
  const pullDist = pullOut ? 0.025 : 0;
  const TAPER = 0.05;          // 箱体上口相对下底的外扩量（梯台侧壁倾斜）
  const WALL_T = 0.008;        // 侧壁厚
  const RIM_OUT = 0.007;       // 口沿加强圈半厚（居中于壁上口外沿）
  const GAP = 0.005;           // 与立柱内表面的装配间隙
  // 滑轨/横梁顶面：轨中心 (ry - BEAM/2 - 0.007) + 半高 BEAM/2
  const railTopOffset = -0.007;
  // 箱高：不穿上一层滑轨底面（上一层轨底 = ry + tierH - BEAM/2 - 0.007 - BEAM/2）
  const crateH = Math.max(0.12, Math.min(tierH - BEAM - 0.03, 0.30));
  // 侧壁倾斜后上口外角在 Z 向的额外外扩（只与箱高/锥度相关）
  const tiltHalf = TAPER / 2;
  const tiltHyp = Math.hypot(tiltHalf, crateH);
  const sinT = tiltHalf / tiltHyp, cosT = crateH / tiltHyp;
  const TILT_PAD = (crateH / 2) * sinT + (WALL_T / 2) * (cosT - 1);
  // 箱宽（Z 向）：抽出、侧壁倾斜、口沿、间隙全部计入后仍在立柱内表面以内
  const crateTopW = Math.max(0.20, Math.min(D + 0.02, 2 * (innerZ - pullDist - TILT_PAD - RIM_OUT - GAP)));
  const crateBotW = crateTopW - TAPER;
  // 箱长（X 向）：钳制到立柱内表面以内（抽出方向在 Z 向、X 向不得穿立柱）
  const crateLen = Math.max(0.24, Math.min(W - 0.02, 2 * (innerX - RIM_OUT - GAP)));

  // ---- 几何（真实 T-slot 铝型材）----
  // 2040 立柱：截面 .04 宽 × .02 厚（tall 双腔），槽口朝 ±X 外侧
  const postGeo = extrudeUp(makeTSlotShape(.04, .02), H + BEAM * 2);
  // 2020 梁：正方截面
  const beamXGeo = extrudeAlongX(makeTSlotShape(BEAM, BEAM), frameLenXOf());
  function frameLenXOf() { return W + POST_W; }
  // Z 向梁：截面旋转（makeTSlotShape(.02,.02) 正方，extrudeAlongZ 沿 Z 拉）
  const beamZGeo = extrudeAlongZ(makeTSlotShape(BEAM, BEAM), frameLenZOf());
  beamZGeo.translate(0, 0, -frameLenZOf() / 2);   // 居中（extrudeAlongZ 从 0 起）
  function frameLenZOf() { return D + POST_W; }
  // 层轨：Z 向 2020
  const railGeo = extrudeAlongZ(makeTSlotShape(BEAM, BEAM), D + POST_W + 0.06);
  railGeo.translate(0, 0, -(D + POST_W + 0.06) / 2);   // 居中

  const frameLenX = W + POST_W;
  const frameLenZ = D + POST_W;

  // ---- 立柱 ×4 ----
  const posts = instanced(postGeo, matAlu, 4);
  let i = 0;
  for (const x of postXs) for (const z of postZs) {
    _m4.identity().setPosition(x, yPost0 - BEAM + (H + BEAM * 2) / 2, z);
    posts.setMatrixAt(i++, _m4);
  }
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 4 * (H + BEAM * 2);

  // ---- 底框 + 顶框（X 梁 + Z 梁）----
  for (const y of [yBottom, yTop]) {
    const fx = instanced(beamXGeo, matAlu, 2);
    setM(fx, 0, -pz - POST_W / 2 + BEAM / 2, y, 'x');
    setM(fx, 1, pz - POST_W / 2 - BEAM / 2 + 0.002, y, 'x');
    group.add(fx);
    const fz = instanced(beamZGeo, matAlu, 2);
    setM(fz, 0, -px - POST_W / 2 + BEAM / 2, y, 'z');
    setM(fz, 1, px - POST_W / 2 - BEAM / 2 + 0.002, y, 'z');
    group.add(fz);
  }
  stats.profileLengthM += 2 * (2 * frameLenX + 2 * frameLenZ);

  function setM(mesh, idx, a, b, axis) {
    // X 梁：a=Z 位置，b=Y；Z 梁：a=X 位置，b=Y
    _m4.identity().setPosition(axis === 'x' ? 0 : a, b, axis === 'x' ? a : 0);
    mesh.setMatrixAt(idx, _m4);
  }

  // ---- 每层滑轨 ×2（Z 向，位于箱底两侧）----
  const railYs = [];
  for (let t = 0; t < tiers; t++) railYs.push(yPost0 + BEAM + tierH * t + tierH / 2);
  const rails = instanced(railGeo, matAlu, tiers * 2);
  let ri = 0;
  for (const ry of railYs) {
    _m4.identity().setPosition(-px * 0.45, ry - BEAM / 2 - 0.007, 0);
    rails.setMatrixAt(ri++, _m4);
    _m4.identity().setPosition(px * 0.45, ry - BEAM / 2 - 0.007, 0);
    rails.setMatrixAt(ri++, _m4);
    stats.profileLengthM += 2 * (D + POST_W + 0.06);
  }
  group.add(rails);
  groups.rails = rails;

  // 每层前后横梁托底（X 向 2020，箱坐梁上）：参考图中每层有横梁
  const tierBeamGeo = extrudeAlongX(makeTSlotShape(BEAM, BEAM), frameLenX);
  const tierBeams = instanced(tierBeamGeo, matAlu, tiers * 2);
  let ti = 0;
  for (const ry of railYs) {
    // 前后各一根，位于箱底下方（与滑轨同高）
    _m4.identity().setPosition(0, ry - BEAM / 2 - 0.007, pz - 0.02);
    tierBeams.setMatrixAt(ti++, _m4);
    _m4.identity().setPosition(0, ry - BEAM / 2 - 0.007, -(pz - 0.02));
    tierBeams.setMatrixAt(ti++, _m4);
    stats.profileLengthM += 2 * frameLenX;
  }
  group.add(tierBeams);
  groups.tierBeams = tierBeams;

  // ---- 周转箱（正立方梯台，正交摆放；交错抽出）----
  const bodyMats = {};
  const rimMats = {};
  for (const key of Object.keys(CRATE_COLORS)) {
    bodyMats[key] = new THREE.MeshPhysicalMaterial({ color: CRATE_COLORS[key].hex, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.7 });
    rimMats[key] = new THREE.MeshStandardMaterial({ color: CRATE_COLORS[key].rib, roughness: 0.5, metalness: 0.05 });
  }

  // 梯台箱体：4 段侧壁独立 Box（下窄上宽，无旋转歪斜）
  const crateGroup = new THREE.Group();
  for (let t = 0; t < tiers; t++) {
    const colorKey = (SCHEME_SEQ[scheme] || SCHEME_SEQ.mix)[t % (SCHEME_SEQ[scheme] || SCHEME_SEQ.mix).length];
    const yBase = railYs[t] + railTopOffset;                    // 箱底落在滑轨/横梁顶面
    const zOff = pullOut ? (t % 2 === 0 ? 1 : -1) * pullDist : 0;   // 交错抽出（不出立柱平面）

    const g = new THREE.Group();
    // 四面侧壁（前/后宽 crateLen；左/右随高度线性内收）
    const wallT = 0.008;
    for (const sz of [1, -1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(crateLen, crateH, wallT), bodyMats[colorKey]);
      wall.position.set(0, crateH / 2, sz * (crateTopW / 2 - wallT / 2));
      wall.rotation.x = -sz * Math.atan((crateTopW - crateBotW) / 2 / crateH);   // 侧壁倾斜（下窄上宽）
      g.add(wall);
    }
    for (const sx of [1, -1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, crateH, crateBotW), bodyMats[colorKey]);
      wall.position.set(sx * (crateLen / 2 - wallT / 2), crateH / 2, 0);
      g.add(wall);
    }
    // 底板
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(crateLen - wallT * 2, wallT, crateBotW - wallT * 2), bodyMats[colorKey]);
    bottom.position.set(0, wallT / 2, 0);
    g.add(bottom);
    // 口沿加强圈（4 条）
    const rimY = crateH - 0.01;
    const rimLong = new THREE.Mesh(new THREE.BoxGeometry(crateLen + 0.012, 0.02, 0.014), rimMats[colorKey]);
    rimLong.position.set(0, rimY, crateTopW / 2);
    const rimLong2 = rimLong.clone(); rimLong2.position.z = -crateTopW / 2;
    const rimShort = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, crateTopW + 0.012), rimMats[colorKey]);
    rimShort.position.set(crateLen / 2, rimY, 0);
    const rimShort2 = rimShort.clone(); rimShort2.position.x = -crateLen / 2;
    g.add(rimLong, rimLong2, rimShort, rimShort2);

    g.position.set(0, yBase, zOff);
    crateGroup.add(g);
  }
  group.add(crateGroup);

  // ---- 角件（底框 + 顶框 8 角）----
  const clampGeo = new THREE.BoxGeometry(0.045, 0.04, 0.045);
  const corners = instanced(clampGeo, matClamp, 8);
  {
    let ci = 0;
    for (const y of [yBottom, yTop]) {
      for (const x of postXs) {
        for (const z of postZs) {
          _m4.identity().setPosition(x, y, z);
          corners.setMatrixAt(ci++, _m4);
        }
      }
    }
  }
  group.add(corners);

  // ---- 万向轮 / 地脚 ----
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.018, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const forkGeo = new THREE.BoxGeometry(0.028, 0.05, 0.03);
  let wheelParts = 0;
  if (casters) {
    const wheels = instanced(wheelGeo, matWheel, 4);
    const forks = instanced(forkGeo, matClamp, 4);
    let wi = 0;
    for (const x of postXs) {
      for (const z of postZs) {
        _m4.identity().setPosition(x, 0.025, z);
        wheels.setMatrixAt(wi, _m4);
        _m4.identity().setPosition(x, 0.05, z);
        forks.setMatrixAt(wi, _m4);
        wi++;
      }
    }
    group.add(wheels);
    group.add(forks);
    wheelParts = 8;
  } else {
    const feet = instanced(forkGeo, matClamp, 4);
    let fi = 0;
    for (const x of postXs) {
      for (const z of postZs) {
        _m4.identity().setPosition(x, 0.015, z);
        feet.setMatrixAt(fi++, _m4);
      }
    }
    group.add(feet);
    wheelParts = 4;
  }

  // ---- 统计 ----
  const postLen = H + BEAM * 2;
  const volAlu = (4 * postLen * POST_W * 0.02
    + 2 * (2 * frameLenX + 2 * frameLenZ) * BEAM * BEAM
    + tiers * 2 * (D + POST_W + 0.06) * BEAM * BEAM
    + tiers * 2 * frameLenX * BEAM * BEAM);
  const crateWallArea = tiers * (2 * crateLen * crateH * 1.02 + 2 * crateBotW * crateH + crateLen * crateBotW);
  stats.weightKg = volAlu * DENSITY_ALU + crateWallArea * 0.006 * 900 + 8 * 0.03 + (casters ? 4 * 0.15 : 4 * 0.05);
  stats.partCount = 4 + 4 + tiers * (2 + 2 + 1) + 8 + wheelParts + 2;

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('立柱 2040（T-slot）', '2040', +postLen.toFixed(3), 4);
  addCut('框梁 2020（T-slot）', '2020', +frameLenX.toFixed(3), 4);
  addCut('框梁 2020（T-slot）', '2020', +frameLenZ.toFixed(3), 4);
  addCut('层轨 2020（T-slot）', '2020', +(D + POST_W + 0.06).toFixed(3), tiers * 2);
  stats.cutList.push({ spec: `物流周转箱（${scheme === 'mix' ? '混搭' : CRATE_SCHEMES[scheme].label}）`, section: '件', len: +crateLen.toFixed(2), qty: tiers });
  stats.panes = [];
  stats.hardware = [
    casters ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '角件', qty: 8 },
    { name: '滑轨垫片', qty: tiers * 4 },
  ];

  return {
    group,
    groups,
    stats,
    bounds: { W: frameLenX + 0.10, H: yTop + BEAM + 0.04, D: frameLenZ + 0.18 },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      [matAlu, matClamp, matWheel].forEach(m => m.dispose());
      Object.values(bodyMats).forEach(m => m.dispose());
      Object.values(rimMats).forEach(m => m.dispose());
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
