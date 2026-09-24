// 移动边几参数化装配（参考图复刻 · 腿部组合结构版）
// 结构：4×组合腿（外侧木纹装饰板 60×16 + 内侧银色 2040 型材，三层梁端夹在两者之间，木板外露螺栓头）
//       + 顶/中/底三层 2020 框 + 贴地踏杆 ×2 + 顶部玻璃 + 中层亚克力
//       + 前后 ⌀12 光轴挂杆（T 型夹块锁在木纹板上）+ 4 万向轮（安装板 + 叉架外偏 + 黑橡胶轮）
import * as THREE from 'three';
import { RAIL_D, DENSITY_ALU, DEFAULT_CART_CONFIG } from '../config/cart.js';
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

export function buildCartTable(config) {
  const cfg = { ...DEFAULT_CART_CONFIG, ...config };
  const { width, depth, height, glassTop, midAcrylic, rodRails, casters, woodFinish } = cfg;
  const mat = getCartMaterials(woodFinish);

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width;    // 柱心距 X
  const D = depth;    // 柱心距 Z
  const H = height;   // 柱长
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  // ---- 高度（自下而上，对照参考图：轮 → 贴地踏杆 → 底框 → 柱 → 顶框 → 玻璃）----
  const yWheel = 0.025;                            // 轮轴心（轮底触地）
  const yKick = yWheel + 0.025 + BEAM / 2 + 0.012; // 贴地踏杆中心（轮叉上方）
  const yLeg0 = yWheel + 0.03;                     // 腿底（轮叉安装面）
  const yBottomFrame = yKick + BEAM / 2 + 0.028;   // 底框中心
  const yPost1 = yBottomFrame + BEAM / 2 + H;      // 柱顶
  const yTopFrame = yPost1 + BEAM / 2;             // 顶框中心
  const yMidFrame = yBottomFrame + BEAM / 2 + H * 0.62; // 中层框：柱身约 62% 处

  // ---- 腿的组合截面（对照参考图）：外侧木纹板 + 内侧银色 2040 型材，梁端夹在两者之间 ----
  // 从前/后面看：宽木纹板（60mm）盖住梁端，板面有外露螺栓；从侧面看：2040 型材 T 槽面 + 木板边线。
  const LEG_ALU_T = 0.022;  // 型材厚（X，梁穿过方向）
  const LEG_ALU_D = 0.04;   // 型材深（Z，2040 竖放：宽面朝 ±X 侧）
  const LEG_WOOD_W = 0.06;  // 木纹板宽（60mm，比型材宽——参考图特征）
  const LEG_WOOD_T = 0.016; // 木纹板厚（贴在梁端外侧）
    const legGap = 0.004;     // 型材与梁之间的装配间隙
  // 木板中心离柱心：型材半深 0.02（Z 向）+ 间隙 0.004 + 梁 0.02 + 木板半厚 0.008 = 0.052
  // 注意：腿组合截面沿 Z 展开，深度基准是 LEG_ALU_D/2 而非 LEG_ALU_T/2
  const legWoodOff = LEG_ALU_D / 2 + legGap + BEAM + LEG_WOOD_T / 2;

  // ---- 几何 ----
  const beamXGeo = new THREE.BoxGeometry(1, BEAM, BEAM);                  // X 向梁
  const beamZGeo = new THREE.BoxGeometry(BEAM, BEAM, 1);                  // Z 向梁
  const aluPostGeo = new THREE.BoxGeometry(LEG_ALU_T, 1, LEG_ALU_D);      // 腿·铝型材（2040 竖放，宽面朝 ±X）
  const woodPostGeo = new THREE.BoxGeometry(LEG_WOOD_W, 1, LEG_WOOD_T);   // 腿·木纹板（外贴）
  const boltGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.005, 10);    // 外露螺栓头
  boltGeo.rotateX(Math.PI / 2);
  const railXGeo = new THREE.CylinderGeometry(1, 1, 1, 12); railXGeo.rotateZ(Math.PI / 2);
  const boardGeo = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 18);    // 轮（黑橡胶）
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.024, 10);     // 轮毂（银）
  hubGeo.rotateX(Math.PI / 2);
  const forkGeo = new THREE.BoxGeometry(0.052, 0.05, 0.006);              // 轮叉侧板（夹轮两侧）
  const mountGeo = new THREE.BoxGeometry(0.04, 0.006, 0.05);              // 轮安装板（贴腿底）
  const clampGeo = new THREE.BoxGeometry(0.032, 0.05, 0.032);             // 光轴 T 型夹块
  const cornerGeo = new THREE.BoxGeometry(0.03, 0.055, 0.044);            // 角部连接板

  // ---- 腿 ×4：银色 2040 型材（内）+ 木纹板（外）组合柱 ----
  // 木纹板贴在每条腿的 Z 向外侧（前后面见木纹），X 向侧面露出型材 T 槽面（对照参考图）。
  // 三层梁端夹在型材外侧面（z=±(pz+0.02)）与木板内侧面（z=±(pz+0.04)）之间。
  const aluPosts = instanced(aluPostGeo, mat.beam, 4);
  const woodPosts = instanced(woodPostGeo, mat.post, 4);
  const legLen = yPost1 - yLeg0;
  {
    let ai = 0, wi = 0;
    for (const x of postXs) for (const z of postZs) {
      const sz = z > 0 ? 1 : -1;
      setMT(ai++, aluPosts, x, (yPost1 + yLeg0) / 2, z, 1, legLen, 1);
      setMT(wi++, woodPosts, x, (yPost1 + yLeg0) / 2, z + sz * legWoodOff, 1, legLen, 1);
    }
  }
  group.add(aluPosts);
  group.add(woodPosts);
  groups.aluPosts = aluPosts;
  groups.woodPosts = woodPosts;

  // ---- 外露螺栓头 ×24（4 腿 × 3 层 × 2）：打在木纹板外侧面、每层框高度上（参考图特征）----
  {
    const bolts = instanced(boltGeo, mat.clamp, 24);
    let bi = 0;
    for (const y of [yBottomFrame, yMidFrame, yTopFrame]) {
      for (const x of postXs) for (const z of postZs) {
        const sz = z > 0 ? 1 : -1;
        const bz = z + sz * (legWoodOff + LEG_WOOD_T / 2 + 0.001);
        setMT(bi++, bolts, x - 0.014, y, bz);
        setMT(bi++, bolts, x + 0.014, y, bz);
      }
    }
    group.add(bolts);
    groups.bolts = bolts;
  }

  // ---- 三层方框（每层 2×X 梁 + 2×Z 梁）----
  // X 梁嵌在腿的型材与木纹板之间（z 中心 = ±(pz + 型材半深 + 间隙 + 梁半厚) = ±(pz+0.034)），
  // Z 梁（侧框）贴在型材 X 外侧面，端头抵住 X 梁外侧面 —— 对照参考图梁端藏进腿的组合截面。
  const frameLenX = W + LEG_ALU_D;                                   // X 梁长（端头藏在木板后）
  const frameLenZ = D + 2 * (LEG_ALU_D / 2 + BEAM);                  // Z 梁长（贴型材外侧，端抵 X 梁外侧面）
  const zBeamX = pz + LEG_ALU_D / 2 + legGap + BEAM / 2;             // X 梁中心离柱心 0.034（>型材半深 0.02，不穿模）
  const xBeamZ = px + LEG_ALU_T / 2 + BEAM / 2;                      // Z 梁中心离柱心 0.021
  const beamsXGroup = new THREE.Group();
  const beamsZGroup = new THREE.Group();
  for (const y of [yBottomFrame, yMidFrame, yTopFrame]) {
    const f = instanced(beamXGeo, mat.beam, 2);
    setMT(0, f, 0, y, -zBeamX, frameLenX, 1, 1);
    setMT(1, f, 0, y, zBeamX, frameLenX, 1, 1);
    beamsXGroup.add(f);
    const fz = instanced(beamZGeo, mat.beam, 2);
    setMT(0, fz, -xBeamZ, y, 0, 1, 1, frameLenZ);
    setMT(1, fz, xBeamZ, y, 0, 1, 1, frameLenZ);
    beamsZGroup.add(fz);
  }
  group.add(beamsXGroup);
  group.add(beamsZGroup);
  groups.beamsX = beamsXGroup;
  groups.beamsZ = beamsZGroup;
  stats.profileLengthM += 3 * (2 * frameLenX + 2 * frameLenZ);

  // ---- 贴地踏杆 ×2（参考图轮叉上方的前后横梁，连接四条腿的底部）----
  {
    const kicks = instanced(beamXGeo, mat.beam, 2);
    setMT(0, kicks, 0, yKick, -zBeamX, frameLenX - 0.03, 1, 1);
    setMT(1, kicks, 0, yKick, zBeamX, frameLenX - 0.03, 1, 1);
    group.add(kicks);
    groups.kicks = kicks;
  }
  stats.profileLengthM += 2 * (frameLenX - 0.03);

  // ---- 顶部玻璃（覆盖顶框，微超出）----
  let panes = [];
  if (glassTop) {
    const g = instanced(boardGeo, mat.glass, 1);
    setMT(0, g, 0, yTopFrame + BEAM / 2 + 0.004, 0, frameLenX + 0.05, 0.008, frameLenZ + 0.05);
    group.add(g);
    groups.glass = g;
    panes.push({ label: '钢化玻璃台面', areaM2: +(((frameLenX + 0.05) * (frameLenZ + 0.05))).toFixed(3), kind: 'glass' });
  }

  // ---- 中层亚克力板（落于中框，覆盖框内 + 微搭框沿）----
  if (midAcrylic !== 'none') {
    const a = instanced(boardGeo, midAcrylic === 'amber' ? mat.amber : mat.frost, 1);
    setMT(0, a, 0, yMidFrame + BEAM / 2 + 0.003, 0, frameLenX - 0.01, 0.006, frameLenZ - 0.01);
    group.add(a);
    groups.acrylic = a;
    const area = ((frameLenX - 0.01) * (frameLenZ - 0.01));
    panes.push({
      label: midAcrylic === 'amber' ? '橙色亚克力中板' : '磨砂亚克力中板',
      areaM2: +area.toFixed(3),
      kind: 'acrylic',
    });
  }

  // ---- 前后光轴挂杆（每侧 2 根 ⌀12，X 向，T 型夹块锁在木纹板上，杆头微出头）----
  let railCount = 0;
  if (rodRails) {
    // 挂杆位于木纹板外侧：z = ±(木板外缘 + 杆半径 + 夹块半厚)，参考图杆头露出木柱约 3cm
    const zRail = pz + legWoodOff + LEG_WOOD_T / 2 + RAIL_D / 2 + 0.012;
    const railYs = [yMidFrame - BEAM, yMidFrame + BEAM + 0.05];
    const railLen = frameLenX + 0.07;
    const rails = instanced(railXGeo, mat.rod, railYs.length * 2);
    let ri = 0;
    for (const ry of railYs) {
      for (const sz of [1, -1]) {
        setMT(ri++, rails, 0, ry, sz * zRail, railLen, RAIL_D / 2, RAIL_D / 2);
        stats.profileLengthM += railLen;
        railCount++;
      }
    }
    group.add(rails);
    groups.rails = rails;
    // T 型夹块：夹在木纹板上（跨板面到杆），每根杆两端各一个
    const clamps = instanced(clampGeo, mat.clamp, railYs.length * 2 * 2);
    let ci = 0;
    for (const ry of railYs) {
      for (const sz of [1, -1]) {
        const cz = sz * (pz + legWoodOff + LEG_WOOD_T / 2 + 0.008);
        setMT(ci++, clamps, -px - 0.004, ry, cz);
        setMT(ci++, clamps, px + 0.004, ry, cz);
      }
    }
    group.add(clamps);
    groups.clamps = clamps;
  }

  // ---- 角部连接板 ×12（每层 ×4 角，贴型材 X 外侧面、包住梁柱节点，参考图侧面银色连接板）----
  const nCorners = 12;
  {
    const corners = instanced(cornerGeo, mat.clamp, nCorners);
    let ci = 0;
    for (const y of [yBottomFrame, yMidFrame, yTopFrame]) {
      for (const x of postXs) for (const z of postZs) {
        const sx = x > 0 ? 1 : -1;
        setMT(ci++, corners, x + sx * (LEG_ALU_T / 2 + BEAM / 2), y, z);
      }
    }
    group.add(corners);
    groups.corners = corners;
  }


  // ---- 万向轮 / 地脚 ×4（腿底下方，轮体略向外偏——参考图特征）----
  let wheelParts = 0;
  if (casters) {
    // 轮组：安装板（贴腿底）+ 两片叉侧板（夹轮）+ 黑橡胶轮 + 银轮毂；轮心向外偏 14/16mm
    const wheels = instanced(wheelGeo, mat.tire, 4);
    const hubs = instanced(hubGeo, mat.clamp, 4);
    const forks = instanced(forkGeo, mat.clamp, 8);
    const mounts = instanced(mountGeo, mat.clamp, 4);
    let hi = 0, fi = 0, mi = 0;
    for (const x of postXs) for (const z of postZs) {
      const sx = x > 0 ? 1 : -1, sz = z > 0 ? 1 : -1;
      const wx = x + sx * 0.014, wz = z + sz * 0.016;
      setMT(mi++, mounts, x + sx * 0.006, yLeg0 + 0.003, z + sz * 0.008);
      setMT(fi++, forks, wx, yWheel + 0.025, wz - 0.013);
      setMT(fi++, forks, wx, yWheel + 0.025, wz + 0.013);
      setMT(hi++, hubs, wx, yWheel, wz);
    }
    // 轮体逐轮布位（与轮毂同轴心）
    {
      let wi = 0;
      for (const x of postXs) for (const z of postZs) {
        const sx = x > 0 ? 1 : -1, sz = z > 0 ? 1 : -1;
        setMT(wi++, wheels, x + sx * 0.014, yWheel, z + sz * 0.016);
      }
    }
    group.add(wheels); group.add(hubs); group.add(forks); group.add(mounts);
    groups.wheels = wheels;
    groups.hubs = hubs;
    groups.forks = forks;
    groups.mounts = mounts;
    wheelParts = 20;
  } else {
    // 调平地脚：腿底小圆柱垫脚
    const footGeo = new THREE.CylinderGeometry(0.014, 0.018, yLeg0, 12);
    const feet = instanced(footGeo, mat.clamp, 4);
    let fi = 0;
    for (const x of postXs) for (const z of postZs) {
      setMT(fi++, feet, x, yLeg0 / 2, z);
    }
    group.add(feet);
    groups.feet = feet;
    wheelParts = 4;
  }

  // ---- 统计 ----
  // 腿：4×2040 型材（组合柱内半）+ 4×木纹装饰板；梁：3 层框 + 贴地踏杆
  stats.profileLengthM += 4 * legLen;

  const volAlu = 4 * legLen * LEG_ALU_T * LEG_ALU_D
    + 3 * (2 * frameLenX + 2 * frameLenZ) * BEAM * BEAM
    + 2 * (frameLenX - 0.03) * BEAM * BEAM
    + railCount * (frameLenX + 0.07) * Math.PI * (RAIL_D / 2) ** 2;
  const volWood = 4 * legLen * LEG_WOOD_W * LEG_WOOD_T;
  const glassArea = glassTop ? (frameLenX + 0.05) * (frameLenZ + 0.05) : 0;
  const acrArea = midAcrylic !== 'none' ? (frameLenX - 0.01) * (frameLenZ - 0.01) : 0;
  stats.weightKg = volAlu * DENSITY_ALU
    + volWood * 600
    + glassArea * 0.008 * 2500
    + acrArea * 0.006 * 1190
    + 24 * 0.008        // 外露螺栓
    + nCorners * 0.03   // 角部连接板
    + (casters ? 4 * 0.15 : 4 * 0.05);

  stats.partCount = 4 + 4 + 6 + 2 + railCount + (rodRails ? railCount * 2 : 0)
    + nCorners + wheelParts + (glassTop ? 1 : 0) + (midAcrylic !== 'none' ? 1 : 0);

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('立柱型材 2040（银色阳极）', '2040', +legLen.toFixed(3), 4);
  addCut('立柱木纹装饰板 60×16', '板', +legLen.toFixed(3), 4);
  addCut('框梁 2020', '2020', +frameLenX.toFixed(3), 6);
  addCut('框梁 2020', '2020', +frameLenZ.toFixed(3), 6);
  addCut('贴地踏杆 2020', '2020', +(frameLenX - 0.03).toFixed(3), 2);
  if (rodRails) addCut('光轴挂杆', '12', +(frameLenX + 0.07).toFixed(3), railCount);
  if (glassTop) stats.cutList.push({ spec: '钢化玻璃台面', section: '板', len: +(frameLenX + 0.05).toFixed(2), qty: 1 });
  if (midAcrylic !== 'none') stats.cutList.push({ spec: midAcrylic === 'amber' ? '橙色亚克力中板' : '磨砂亚克力中板', section: '板', len: +(frameLenX - 0.01).toFixed(2), qty: 1 });
  stats.panes = panes;
  stats.hardware = [
    casters ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '十字光轴夹块', qty: rodRails ? 8 : 0 },
    { name: '角部连接板', qty: nCorners },
    { name: '外六角螺栓 M6×16（装饰外露）', qty: 24 },
    ...(glassTop ? [{ name: '玻璃减震垫片', qty: 4 }] : []),
    ...(midAcrylic !== 'none' ? [{ name: '中板压条', qty: 2 }] : []),
  ].filter(h => h.qty > 0);

  return {
    group,
    groups,
    stats,
    bounds: {
      W: frameLenX + 0.16,
      H: yTopFrame + BEAM / 2 + (glassTop ? 0.012 : 0) + 0.05,
      D: frameLenZ + 0.16,
    },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      // 注意：不销毁 mat.* —— 材质由 cartMaterials.js 按饰面缓存共享，
      // dispose 缓存项会导致再次切回该饰面时拿到已销毁材质（黑模）。
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}

