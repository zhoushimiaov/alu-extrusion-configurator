// 光轴木展车参数化装配（参考图复刻 v2：洞洞板展车）
// 结构（对照参考实拍，前 = +Z）：
//   胶合板底台（四角 3 寸黑色万向轮）+ 后部通高洞洞板展墙（两端胶合板封边立板）
//   + 全进深层板 ×shelves + 顶部台板（cabinetH = 台板高度）
//   + 4×⌀16 光轴立柱（底台 → 顶端，穿板角）+ 板下光轴夹块
//   + 正面卡片挂杆（每格一根 ⌀12，夹块锁立柱）+ 顶部挂架（前后 X 向挂杆）+ 侧向挂杆（左右 Z 向）
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import { ROD_D, RAIL_D, BOARD_T, DENSITY_STEEL, DENSITY_PLY, DEFAULT_WOODCART_CONFIG } from '../config/woodcart.js';
import { getWoodCartMaterials } from './woodcartMaterials.js';
import { buildCasters, buildLevelFeet, outwardYaw } from './casters.js';

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

const DECK_T = 0.018;      // 底台 / 顶台板厚
const PEG_T = 0.009;       // 洞洞板厚
const PEG_PITCH = 0.0254;  // 孔距 1 寸
const CASTER_H = 0.095;    // 3 寸万向轮安装面高
const EDGE = 0.04;         // 板材越出立柱的余量（立柱穿板角）

/** 盒子几何 + 按真实尺寸平铺 UV（洞洞板孔距不随板幅拉伸） */
function tiledBox(w, h, t, tile) {
  const g = new THREE.BoxGeometry(w, h, t);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (h / tile));
  return g;
}

export function buildWoodCart(config) {
  const cfg = { ...DEFAULT_WOODCART_CONFIG, ...config };
  const { width, depth, height, shelves, cabinetH, pegboard, topRail, sideRail, casters, woodTone, ohF, ohB, ohL, ohR } = cfg;
  const mat = getWoodCartMaterials(woodTone);

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width, D = depth, H = height;
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];
  // 板材四向外伸/内缩（正扩负缩），施加于层板与顶台板；底台固定
  const ohFB = Math.max(ohF + ohB, -(D - 0.08));
  const ohLR = Math.max(ohL + ohR, -(W - 0.08));
  const ohOffX = (ohR - ohL) / 2;
  const ohOffZ = (ohF - ohB) / 2;

  // ---- 高度 ----
  const deckY0 = CASTER_H;                         // 底台底面（脚轮安装面）
  const deckTop = deckY0 + DECK_T;
  const yRodTop = deckY0 + H;                      // 立柱顶
  const yPlank = Math.max(deckTop + 0.45, Math.min(cabinetH, yRodTop - 0.5)); // 顶台板中心
  const nZones = shelves + 1;
  const zoneH = (yPlank - deckTop) / nZones;
  const shelfYs = Array.from({ length: shelves }, (_, s) => deckTop + zoneH * (s + 1));

  const boardW = W + 2 * EDGE;                     // 板宽（立柱穿板角）
  const boardD = D + 2 * EDGE;
  const zPeg = -pz + 0.05;                         // 洞洞板展墙（偏后，前部为陈列进深）

  // ---- 底台（胶合板）----
  const deck = instanced(new THREE.BoxGeometry(boardW, DECK_T, boardD), mat.wood, 1);
  setMT(0, deck, 0, deckY0 + DECK_T / 2, 0);
  group.add(deck);
  groups.bottom = deck;

  // ---- 层板 + 顶台板（含外伸）----
  const shelfBoards = instanced(new THREE.BoxGeometry(1, BOARD_T, 1), mat.wood, shelves);
  shelfYs.forEach((y, i) => setMT(i, shelfBoards, ohOffX, y, ohOffZ, boardW + ohLR, 1, boardD + ohFB));
  group.add(shelfBoards);
  groups.shelfBoards = shelfBoards;
  const top = instanced(new THREE.BoxGeometry(1, DECK_T, 1), mat.wood, 1);
  setMT(0, top, ohOffX, yPlank, ohOffZ, boardW + ohLR, 1, boardD + ohFB);
  group.add(top);
  groups.top = top;

  // ---- 洞洞板展墙（分段夹在各层板之间，视觉连续）+ 两端封边立板 ----
  const pegW = boardW - 2 * DECK_T;
  // 分段：[底台顶, 层板1底] [层板1顶, 层板2底] … [层板N顶, 顶台板底]
  const segPairs = [];
  let lo = deckTop;
  for (const y of shelfYs) { segPairs.push([lo, y - BOARD_T / 2]); lo = y + BOARD_T / 2; }
  segPairs.push([lo, yPlank - DECK_T / 2]);
  let pegArea = 0;
  if (pegboard) {
    const pegGroup = new THREE.Group();
    const pegMat = mat.pegboard.clone();
    pegMat.map = mat.pegboard.map.clone();
    pegMat.map.wrapS = pegMat.map.wrapT = THREE.RepeatWrapping;
    pegMat.map.needsUpdate = true;
    pegMat.userData.ownMap = true;
    const tile = PEG_PITCH * (256 / 22);           // 贴图一周期 = 11.6 孔
    for (const [y0, y1] of segPairs) {
      const h = y1 - y0;
      if (h <= 0.01) continue;
      const m = new THREE.Mesh(tiledBox(pegW, h, PEG_T, tile), pegMat);
      m.position.set(0, (y0 + y1) / 2, zPeg);
      pegGroup.add(m);
      pegArea += pegW * h;
    }
    // 两端封边立板（参考图：展墙两侧胶合板立边）
    const stileD = 0.07;
    const stileH = yPlank - DECK_T / 2 - deckTop;
    const stiles = instanced(new THREE.BoxGeometry(DECK_T, stileH, stileD), mat.wood, 2);
    setMT(0, stiles, -(boardW / 2 - DECK_T / 2), deckTop + stileH / 2, zPeg);
    setMT(1, stiles, boardW / 2 - DECK_T / 2, deckTop + stileH / 2, zPeg);
    pegGroup.add(stiles);
    group.add(pegGroup);
    groups.peg = pegGroup;
  }

  // ---- 立柱 ×4（⌀16 光轴，底台 → 顶端）----
  const rodYGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  const postLen = yRodTop - deckY0 + 0.01;
  const posts = instanced(rodYGeo, mat.rod, 4);
  let i = 0;
  for (const x of postXs) for (const z of postZs) setMT(i++, posts, x, deckY0 - 0.01 + postLen / 2, z, ROD_D / 2, postLen, ROD_D / 2);
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 4 * postLen;
  // 立柱顶端镀铬圆帽
  const capGeo = new THREE.SphereGeometry(ROD_D / 2 + 0.0015, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const caps = instanced(capGeo, mat.rod, 4);
  i = 0;
  for (const x of postXs) for (const z of postZs) setMT(i++, caps, x, yRodTop, z);
  group.add(caps);
  groups.flanges = caps;

  // ---- 板下光轴夹块（每块板 × 4 立柱）----
  const clampGeo = new THREE.BoxGeometry(0.034, 0.024, 0.034);
  const boardYs = [...shelfYs.map((y) => y - BOARD_T / 2 - 0.012), yPlank - DECK_T / 2 - 0.012, deckTop + 0.012];
  const shelfClamps = instanced(clampGeo, mat.clamp, boardYs.length * 4);
  let ci = 0;
  for (const y of boardYs) for (const x of postXs) for (const z of postZs) setMT(ci++, shelfClamps, x, y, z);
  group.add(shelfClamps);
  groups.shelfClamps = shelfClamps;

  // ---- 挂杆体系 ----
  const railXGeo = new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2);
  const railZGeo = new THREE.CylinderGeometry(1, 1, 1, 12).rotateX(Math.PI / 2);
  const crossGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
  const railLenX = W + 0.06;
  const railLenZ = D + 0.06;
  let railCount = 0;
  const crossPts = [];
  // 正面卡片挂杆：每格一根，约在格高 62% 处（参考图挂卡片 / 夹子）
  const cardYs = segPairs.map(([a, b]) => a + (b - a) * 0.62);
  const cardRails = instanced(railXGeo, mat.rod, cardYs.length);
  cardYs.forEach((y, k) => { setMT(k, cardRails, 0, y, pz + 0.002, railLenX, RAIL_D / 2, RAIL_D / 2); crossPts.push([-px, y, pz], [px, y, pz]); });
  group.add(cardRails);
  groups.cardRails = cardRails;
  stats.profileLengthM += cardYs.length * railLenX;
  railCount += cardYs.length;

  // 顶部挂架：前后 X 向挂杆 + 台板上方展示挂杆（参考图挂包 / 挂卡）
  const yHang = yRodTop - 0.035;
  const yUpper = yPlank + Math.min(0.42, (yRodTop - yPlank) * 0.4);
  if (topRail) {
    const rails = instanced(railXGeo, mat.rod, 3);
    setMT(0, rails, 0, yHang, pz, railLenX, RAIL_D / 2, RAIL_D / 2);
    setMT(1, rails, 0, yHang, -pz, railLenX, RAIL_D / 2, RAIL_D / 2);
    setMT(2, rails, 0, yUpper, pz + 0.002, railLenX, RAIL_D / 2, RAIL_D / 2);
    crossPts.push([-px, yHang, pz], [px, yHang, pz], [-px, yHang, -pz], [px, yHang, -pz], [-px, yUpper, pz], [px, yUpper, pz]);
    group.add(rails);
    groups.rails = rails;
    stats.profileLengthM += 3 * railLenX;
    railCount += 3;
  }
  // 侧向挂杆：左右 Z 向（顶部一道 + 台板上方一道），连接前后立柱
  if (sideRail) {
    const sideRails = instanced(railZGeo, mat.rod, 4);
    let k = 0;
    for (const x of postXs) {
      setMT(k++, sideRails, x, yHang - 0.04, 0, RAIL_D / 2, RAIL_D / 2, railLenZ);
      setMT(k++, sideRails, x, yUpper - 0.04, 0, RAIL_D / 2, RAIL_D / 2, railLenZ);
      crossPts.push([x, yHang - 0.04, pz], [x, yHang - 0.04, -pz], [x, yUpper - 0.04, pz], [x, yUpper - 0.04, -pz]);
    }
    group.add(sideRails);
    groups.sideRails = sideRails;
    stats.profileLengthM += 4 * railLenZ;
    railCount += 4;
  }
  const crosses = instanced(crossGeo, mat.clamp, crossPts.length);
  crossPts.forEach(([x, y, z], k) => setMT(k, crosses, x, y, z));
  group.add(crosses);
  groups.railClamps = crosses;

  // ---- 万向轮 / 地脚 ×4（底台四角）----
  const footPts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const x = sx * (boardW / 2 - 0.055), z = sz * (boardD / 2 - 0.055);
    return { x, z, yaw: outwardYaw(x, z, 'diag') };
  }));
  if (casters) {
    const wheels = buildCasters(footPts, { H: CASTER_H, wheelD: 0.075, wheelW: 0.024, trail: 0.022, mount: 'plate', plate: 0.06, brake: true, palette: 'black' });
    group.add(wheels);
    groups.wheels = wheels;
  } else {
    const feet = buildLevelFeet(footPts, { H: CASTER_H, palette: 'black' });
    group.add(feet);
    groups.feet = feet;
  }

  // ---- 统计 ----
  const volRod = 4 * postLen * Math.PI * (ROD_D / 2) ** 2
    + (stats.profileLengthM - 4 * postLen) * Math.PI * (RAIL_D / 2) ** 2;
  const shelfArea = (boardW + ohLR) * (boardD + ohFB);
  const plyArea = boardW * boardD * (DECK_T / BOARD_T)           // 底台按板厚折算
    + shelves * shelfArea + shelfArea * (DECK_T / BOARD_T)
    + (pegboard ? pegArea * (PEG_T / BOARD_T) + 2 * 0.07 * (yPlank - deckTop) * (DECK_T / BOARD_T) : 0);
  stats.weightKg = volRod * DENSITY_STEEL
    + plyArea * BOARD_T * DENSITY_PLY
    + (casters ? 4 * 0.32 : 4 * 0.06)
    + (boardYs.length * 4 + crossPts.length) * 0.012;
  stats.partCount = 4 + 4 + 1 + shelves + 1 + (pegboard ? segPairs.length + 2 : 0)
    + boardYs.length * 4 + railCount + crossPts.length + 4;

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('光轴立柱', '16', +postLen.toFixed(3), 4);
  addCut('正面卡片挂杆', '12', +railLenX.toFixed(3), cardYs.length);
  if (topRail) addCut('顶部挂杆', '12', +railLenX.toFixed(3), 3);
  if (sideRail) addCut('侧向挂杆', '12', +railLenZ.toFixed(3), 4);
  const plyItems = [
    { spec: '底台', w: boardW, t: DECK_T, qty: 1 },
    ...Array.from({ length: shelves }, (_, s) => ({ spec: `层板 ${s + 1}`, w: boardW + ohLR, t: BOARD_T, qty: 1 })),
    { spec: '顶台板', w: boardW + ohLR, t: DECK_T, qty: 1 },
    ...(pegboard ? [{ spec: '洞洞板（分段）', w: pegW, t: PEG_T, qty: segPairs.length }, { spec: '展墙封边立板', w: +(yPlank - deckTop).toFixed(2), t: DECK_T, qty: 2 }] : []),
  ];
  for (const p of plyItems) {
    stats.cutList.push({ spec: `${p.spec}（胶合板 ${Math.round(p.t * 1000)}mm）`, section: '板', len: +p.w.toFixed(2), qty: p.qty });
  }
  stats.panes = [];
  stats.hardware = [
    casters ? { name: '万向轮 3 寸 平板式（黑色 · 带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '光轴夹块（板下）', qty: boardYs.length * 4 },
    { name: '十字光轴夹块（挂杆）', qty: crossPts.length },
    { name: '立柱镀铬圆帽', qty: 4 },
  ];

  // 支撑点：轮着地点 = 安装点沿对角外偏拖尾距
  stats.supports = {
    kind: casters ? 'casters' : 'feet',
    points: footPts.map(({ x, z }) => {
      if (!casters) return [x, 0, z];
      const l = Math.hypot(x, z) || 1;
      return [+(x + (x / l) * 0.022).toFixed(4), 0, +(z + (z / l) * 0.022).toFixed(4)];
    }),
  };
  stats.envelope = computeEnvelope(group);
  return {
    group,
    groups,
    stats,
    bounds: { W: boardW + Math.max(0, ohLR) + 0.08, H: yRodTop + 0.06, D: boardD + Math.max(0, ohFB) + 0.08 },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (!m) return;
          // 洞洞板克隆了贴图（独立平铺），随材质一并释放；共享缓存材质的贴图不动
          if (m.userData?.ownMap && m.map) m.map.dispose();
          m.dispose();
        });
      });
      // 材质由 woodcartMaterials.js 按色调缓存共享，不销毁（同 buildCartTable.dispose 的教训）
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
