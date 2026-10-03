// 移动边几参数化装配（参考图复刻 v3 · 细节版）
// 对照参考实拍（ref/…1690）逐处还原：
//   腿 ×4：2020 T 槽型材居中，左右两侧各夹一块 60×18 木纹板（正面看「木边 | 型材槽面 | 木边」，侧面看整幅木板）
//          侧框 Z 梁端头插进两板之间顶住型材；木板外露沉头螺丝（每层梁一颗）
//   框：顶框 / 中框 / 底框（底框为 2020 双层叠梁）—— 全部真实 T 槽截面
//   台面：钢化玻璃外挑 3cm，绿边（浮法玻璃侧边色），四只镀铬广告钉落在腿心正上方
//   中层：亚克力托板坐在中框上
//   前后：⌀12 光轴挂杆两根（杆头出腿约 6cm）—— L 型光轴支座锁在型材正面 T 槽里；
//         杆后挂竖向亚克力立板，板面两只光轴支座（内六角 + 外六角螺丝）锁杆
//   底盘：镀铬平板刹车万向轮（轮体沿对角外偏）/ 调平地脚
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import { RAIL_D, DENSITY_ALU, DEFAULT_CART_CONFIG } from '../config/cart.js';
import { getCartMaterials } from './cartMaterials.js';
import { makeTSlotShape, extrudeUp, extrudeAlongX, extrudeAlongZ } from './profiles.js';
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

const BEAM = 0.02;    // 2020 型材截面
const WT = 0.018;     // 腿木板厚
const WW = 0.06;      // 腿木板宽（Z 向）
const PT = 0.006;     // 亚克力立板厚
const GLASS_T = 0.008;

export function buildCartTable(config) {
  const cfg = { ...DEFAULT_CART_CONFIG, ...config };
  const { width, depth, height, glassTop, midAcrylic, rodRails, hangPanels, casters, woodFinish } = cfg;
  const mat = getCartMaterials(woodFinish);

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width;    // 柱心距 X
  const D = depth;    // 柱心距 Z
  const H = height;   // 立柱有效长（底框顶 → 柱顶）
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  // ---- 高度（自下而上）----
  const CASTER_H = 0.068;                         // 脚轮平板安装面 = 型材底面（地脚同高）
  const yLeg0 = CASTER_H;
  const yBotLow = yLeg0 + 0.022 + BEAM / 2;       // 底框下层梁（型材露底 22mm，参考图）
  const yBotHigh = yBotLow + BEAM;                // 底框上层叠梁
  const yPost1 = yBotHigh + BEAM / 2 + H;         // 柱顶 = 顶框顶面 = 玻璃承托面
  const yTop = yPost1 - BEAM / 2;                 // 顶框中心
  const yMid = yBotHigh + BEAM / 2 + H * 0.5;     // 中框：柱身中部（参考图约 48%）
  const levels = [yBotLow, yBotHigh, yMid, yTop];
  const frameSpan = yTop - yBotHigh;

  // ---- 共用几何（真实 T 槽截面，单位长度挤出 + 实例缩放长度）----
  const slot = makeTSlotShape(BEAM, BEAM);
  const legGeo = extrudeUp(slot, 1);                       // y ∈ [0,1]
  const beamXGeo = extrudeAlongX(slot, 1);                 // 居中
  const beamZGeo = extrudeAlongZ(slot, 1); beamZGeo.translate(0, 0, -0.5);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const railXGeo = new THREE.CylinderGeometry(1, 1, 1, 16); railXGeo.rotateZ(Math.PI / 2);

  // ---- 1. 腿：型材 + 左右木板 ----
  const legLen = yPost1 - yLeg0;
  const aluPosts = instanced(legGeo, mat.beam, 4);
  {
    let k = 0;
    for (const x of postXs) for (const z of postZs) setMT(k++, aluPosts, x, yLeg0, z, 1, legLen, 1);
  }
  group.add(aluPosts);
  groups.aluPosts = aluPosts;

  const boardY0 = yLeg0 + 0.006, boardLen = yPost1 - boardY0;
  const woodPosts = instanced(unitBox, mat.post, 8);
  {
    let k = 0;
    for (const x of postXs) for (const z of postZs) {
      for (const side of [-1, 1]) {
        setMT(k++, woodPosts, x + side * (BEAM / 2 + WT / 2), boardY0 + boardLen / 2, z, WT, boardLen, WW);
      }
    }
  }
  group.add(woodPosts);
  groups.woodPosts = woodPosts;

  // 木板沉头螺丝：每条腿 × 每层梁 × 两板外侧面，位于 Z 梁端头插入段（参考图板面黑色螺丝孔）
  {
    const screwGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.0016, 12); screwGeo.rotateZ(Math.PI / 2);
    const screws = instanced(screwGeo, mat.screw, 4 * levels.length * 2);
    let k = 0;
    for (const x of postXs) for (const z of postZs) {
      const sx = Math.sign(x), sz = Math.sign(z);
      for (const y of levels) {
        for (const side of [-1, 1]) {
          setMT(k++, screws, x + side * (BEAM / 2 + WT + 0.0006), y, z - sz * 0.02);
        }
      }
    }
    group.add(screws);
    groups.bolts = screws;
  }

  // ---- 2. 四层框：X 梁顶住内侧木板，Z 梁插进两板之间顶住型材 ----
  const lenX = W - BEAM - 2 * WT;
  const lenZ = D - BEAM;
  const beamsXGroup = new THREE.Group();
  const beamsZGroup = new THREE.Group();
  {
    const bx = instanced(beamXGeo, mat.beam, levels.length * 2);
    const bz = instanced(beamZGeo, mat.beam, levels.length * 2);
    let a = 0, b = 0;
    for (const y of levels) {
      for (const z of postZs) setMT(a++, bx, 0, y, z, lenX, 1, 1);
      for (const x of postXs) setMT(b++, bz, x, y, 0, 1, 1, lenZ);
    }
    beamsXGroup.add(bx);
    beamsZGroup.add(bz);
  }
  group.add(beamsXGroup, beamsZGroup);
  groups.beamsX = beamsXGroup;
  groups.beamsZ = beamsZGroup;

  // ---- 3. 顶部钢化玻璃：外挑 3cm、绿边、腿心正上方四只镀铬广告钉 ----
  const panes = [];
  const glassW = W + BEAM + 2 * WT + 0.06;
  const glassD = D + WW + 0.06;
  if (glassTop) {
    const gGroup = new THREE.Group();
    const yG = yPost1 + 0.002 + GLASS_T / 2;          // 2mm 透明减震垫
    const g = instanced(unitBox, mat.glass, 1);
    setMT(0, g, 0, yG, 0, glassW, GLASS_T, glassD);
    gGroup.add(g);
    // 浮法玻璃侧边绿：四条贴边色带（视觉上的「玻璃厚边」）
    const edge = instanced(unitBox, mat.glassEdge, 4);
    const e = 0.0016;
    setMT(0, edge, 0, yG, glassD / 2 - e / 2, glassW, GLASS_T + 0.0002, e);
    setMT(1, edge, 0, yG, -(glassD / 2 - e / 2), glassW, GLASS_T + 0.0002, e);
    setMT(2, edge, glassW / 2 - e / 2, yG, 0, e, GLASS_T + 0.0002, glassD - 2 * e);
    setMT(3, edge, -(glassW / 2 - e / 2), yG, 0, e, GLASS_T + 0.0002, glassD - 2 * e);
    gGroup.add(edge);
    // 广告钉：镀铬圆帽 + 帽顶内六角
    const capGeo = new THREE.CylinderGeometry(0.0105, 0.0115, 0.0075, 24);
    const caps = instanced(capGeo, mat.rod, 4);
    const hexGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.001, 6);
    const hexes = instanced(hexGeo, mat.screw, 4);
    let k = 0;
    for (const x of postXs) for (const z of postZs) {
      setMT(k, caps, x, yG + GLASS_T / 2 + 0.00375, z);
      setMT(k, hexes, x, yG + GLASS_T / 2 + 0.0076, z);
      k++;
    }
    gGroup.add(caps, hexes);
    group.add(gGroup);
    groups.glass = gGroup;
    panes.push({ label: '钢化玻璃台面（8mm）', areaM2: +(glassW * glassD).toFixed(3), kind: 'glass' });
  }

  // ---- 4. 中层亚克力托板（坐在中框梁上，四边让开腿部木板）----
  let midArea = 0;
  if (midAcrylic !== 'none') {
    const a = instanced(unitBox, midAcrylic === 'amber' ? mat.amber : mat.frost, 1);
    const mw = lenX - 0.004, md = D + BEAM - 0.004;
    setMT(0, a, 0, yMid + BEAM / 2 + 0.003, 0, mw, 0.006, md);
    group.add(a);
    groups.acrylic = a;
    midArea = mw * md;
    panes.push({ label: midAcrylic === 'amber' ? '橙色亚克力中板' : '磨砂亚克力中板', areaM2: +midArea.toFixed(3), kind: 'acrylic' });
  }

  // ---- 5. 前后挂杆 + L 型光轴支座 + 竖向亚克力立板 + 板面光轴支座 ----
  let railCount = 0, hangCount = 0, hangArea = 0;
  const railYs = [yBotHigh + frameSpan * 0.30, yBotHigh + frameSpan * 0.75];
  const railLen = W + BEAM + 2 * WT + 0.12;          // 杆头出腿约 6cm
  const boardFront = pz + WW / 2;                    // 腿木板前沿
  const panelZ = boardFront + 0.003 + PT / 2;        // 立板贴木板前沿外 3mm
  const clampD = 0.03;                               // 板面支座进深
  const zRod = boardFront + 0.003 + PT + clampD / 2; // 杆心穿过板面支座中心
  if (rodRails) {
    const rails = instanced(railXGeo, mat.rod, 4);
    let ri = 0;
    for (const y of railYs) for (const sz of [1, -1]) {
      setMT(ri++, rails, 0, y, sz * zRod, railLen, RAIL_D / 2, RAIL_D / 2);
      railCount++;
    }
    group.add(rails);
    groups.rails = rails;
    stats.profileLengthM += railCount * railLen;

    // L 型光轴支座（腿上）：底板锁在型材正面 T 槽（两木板之间的 20mm 槽道内）+ 前伸臂抱杆
    const lcGroup = new THREE.Group();
    const plate = instanced(unitBox, mat.clamp, 8);
    const arm = instanced(unitBox, mat.clamp, 8);
    const hexGeo = new THREE.CylinderGeometry(0.0046, 0.0046, 0.003, 6); hexGeo.rotateX(Math.PI / 2);
    const armHex = instanced(hexGeo, mat.rod, 8);
    const armLen = zRod + 0.013 - (pz + BEAM / 2 + 0.004);
    let k = 0;
    for (const y of railYs) for (const z of postZs) for (const x of postXs) {
      const sz = Math.sign(z);
      setMT(k, plate, x, y - 0.004, sz * (pz + BEAM / 2 + 0.002), 0.018, 0.046, 0.004);
      setMT(k, arm, x, y, sz * (pz + BEAM / 2 + 0.004 + armLen / 2), 0.018, 0.022, armLen);
      setMT(k, armHex, x, y - 0.0165, sz * (pz + BEAM / 2 + 0.006), 1, 1, 1);
      k++;
    }
    // 底板下端外六角螺丝（锁 T 槽螺母）朝前
    lcGroup.add(plate, arm, armHex);
    group.add(lcGroup);
    groups.clamps = lcGroup;

    if (hangPanels && midAcrylic !== 'none') {
      const pw = W - BEAM - 0.004;                     // 立板两边止于型材内沿
      const py0 = yBotHigh + BEAM / 2 + 0.012;
      const py1 = yBotHigh + frameSpan * 0.88;
      const hp = instanced(unitBox, midAcrylic === 'amber' ? mat.amber : mat.frost, 2);
      setMT(0, hp, 0, (py0 + py1) / 2, panelZ, pw, py1 - py0, PT);
      setMT(1, hp, 0, (py0 + py1) / 2, -panelZ, pw, py1 - py0, PT);
      group.add(hp);
      groups.hangPanels = hp;
      hangArea = 2 * pw * (py1 - py0);
      hangCount = 2;
      panes.push({ label: midAcrylic === 'amber' ? '橙色亚克力立板 ×2' : '磨砂亚克力立板 ×2', areaM2: +hangArea.toFixed(3), kind: 'acrylic' });

      // 板面光轴支座：块体 + 前面外六角螺丝（杆下）+ 顶面内六角紧定螺丝（参考图特写）
      const scGroup = new THREE.Group();
      const body = instanced(unitBox, mat.clamp, 8);
      const boltF = instanced(hexGeo, mat.rod, 8);
      const washer = new THREE.CylinderGeometry(0.0062, 0.0062, 0.0008, 16); washer.rotateX(Math.PI / 2);
      const washers = instanced(washer, mat.rod, 8);
      const sockGeo = new THREE.CylinderGeometry(0.0036, 0.0036, 0.0012, 6);
      const socks = instanced(sockGeo, mat.screw, 8);
      const cx = W / 2 - 0.085;
      let j = 0;
      for (const sz of [1, -1]) for (const y of railYs) for (const sx of [-1, 1]) {
        const zc = sz * (boardFront + 0.003 + PT + clampD / 2);
        const zf = sz * (boardFront + 0.003 + PT + clampD);
        setMT(j, body, sx * cx, y - 0.004, zc, 0.026, 0.04, clampD);
        setMT(j, washers, sx * cx, y - 0.0145, zf + sz * 0.0004, 1, 1, 1);
        setMT(j, boltF, sx * cx, y - 0.0145, zf + sz * 0.002, 1, 1, 1);
        setMT(j, socks, sx * cx, y + 0.0164, zc, 1, 1, 1);
        j++;
      }
      scGroup.add(body, washers, boltF, socks);
      group.add(scGroup);
      groups.hangClamps = scGroup;
    }
  }

  // ---- 6. 万向轮 / 地脚 ×4（转向轴对准型材中心，轮体沿对角拖尾外偏——参考图特征）----
  const legPts = postXs.flatMap((x) => postZs.map((z) => ({ x, z, yaw: outwardYaw(x, z, 'diag') })));
  const TRAIL = 0.016;
  if (casters) {
    const wheels = buildCasters(legPts, { H: CASTER_H, wheelD: 0.045, wheelW: 0.018, trail: TRAIL, mount: 'plate', plate: 0.044, brake: true, palette: 'chrome' });
    group.add(wheels);
    groups.wheels = wheels;
  } else {
    const feet = buildLevelFeet(legPts, { H: CASTER_H, palette: 'chrome' });
    group.add(feet);
    groups.feet = feet;
  }

  // ---- 统计 ----
  const nBeams = levels.length * 4;
  stats.profileLengthM += 4 * legLen + levels.length * 2 * (lenX + lenZ);
  const volAlu = (4 * legLen + levels.length * 2 * (lenX + lenZ)) * BEAM * BEAM * 0.55   // 2020 T 槽截面实体率约 55%
    + railCount * railLen * Math.PI * (RAIL_D / 2) ** 2 * (7850 / DENSITY_ALU);       // 光轴为钢，按钢密度折算
  const volWood = 8 * boardLen * WT * WW;
  const glassArea = glassTop ? glassW * glassD : 0;
  stats.weightKg = volAlu * DENSITY_ALU
    + volWood * 650
    + glassArea * GLASS_T * 2500
    + (midArea + hangArea) * 0.006 * 1190
    + (rodRails ? 8 * 0.05 : 0) + (hangCount ? 8 * 0.04 : 0)
    + nBeams * 2 * 0.012
    + (casters ? 4 * 0.15 : 4 * 0.05);
  stats.partCount = 4 + 8 + nBeams + (glassTop ? 1 + 4 : 0) + (midAcrylic !== 'none' ? 1 : 0)
    + railCount + (rodRails ? 8 : 0) + hangCount + (hangCount ? 8 : 0) + 4;

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('立柱型材 2020（银色阳极）', '2020', +legLen.toFixed(3), 4);
  addCut('框梁 2020 · 前后', '2020', +lenX.toFixed(3), levels.length * 2);
  addCut('框梁 2020 · 两侧', '2020', +lenZ.toFixed(3), levels.length * 2);
  stats.cutList.push({ spec: '腿部木纹板 60×18', section: '板', len: +boardLen.toFixed(3), qty: 8 });
  if (rodRails) addCut('光轴挂杆', '⌀12', +railLen.toFixed(3), railCount);
  if (glassTop) stats.cutList.push({ spec: '钢化玻璃台面 8mm', section: '板', len: +glassW.toFixed(2), qty: 1 });
  if (midAcrylic !== 'none') stats.cutList.push({ spec: midAcrylic === 'amber' ? '橙色亚克力中板' : '磨砂亚克力中板', section: '板', len: +(lenX - 0.004).toFixed(2), qty: 1 });
  stats.panes = panes;
  stats.hardware = [
    casters ? { name: '万向轮 1.75 寸 平板式（镀铬轮叉 · 带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '2020 内置连接件（梁柱节点）', qty: nBeams * 2 },
    { name: '沉头螺丝 M5（木板锁梁）', qty: 4 * levels.length * 2 },
    ...(rodRails ? [{ name: 'L 型光轴支座（锁型材 T 槽）', qty: 8 }] : []),
    ...(hangCount ? [{ name: '光轴支座（亚克力立板锁杆）', qty: 8 }] : []),
    ...(glassTop ? [{ name: '玻璃广告钉（镀铬）', qty: 4 }, { name: '玻璃减震垫片', qty: 4 }] : []),
  ];

  stats.supports = {
    kind: casters ? 'casters' : 'feet',
    points: legPts.map(({ x, z }) => {
      if (!casters) return [x, 0, z];
      const l = Math.hypot(x, z) || 1;
      return [+(x + (x / l) * TRAIL).toFixed(4), 0, +(z + (z / l) * TRAIL).toFixed(4)];
    }),
  };
  stats.envelope = computeEnvelope(group);
  return {
    group,
    groups,
    stats,
    bounds: {
      W: Math.max(glassW, railLen) + 0.06,
      H: yPost1 + (glassTop ? 0.02 : 0) + 0.05,
      D: Math.max(glassD, 2 * (zRod + 0.02)) + 0.06,
    },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      // 注意：不销毁 mat.* —— 材质由 cartMaterials.js 按饰面缓存共享（instanced() 已克隆）
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
