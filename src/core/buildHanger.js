// 光轴挂衣架参数化装配
// 结构：四角 ⌀30 光轴立柱 + 顶框横纵梁 + 顶布置物搁板 + 居中挂衣横杆 + 后框横撑 + 结构斜撑
//       + 底部抽屉柜（抽屉层数可调 0-3 层）+ 2020 矩形底框 + 万向轮/调平地脚
import * as THREE from 'three';
import { POST_D, DENSITY_ALU, DENSITY_PLY, DEFAULT_HANGER_CONFIG, HANGER_COLORS } from '../config/hanger.js';

const WHEEL_MASS = 0.15;
const FOOT_MASS = 0.05;

function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, mat.clone(), count) : null;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);

export function buildHanger(config) {
  const cfg = { ...DEFAULT_HANGER_CONFIG, ...config };
  const { width, depth, height, drawers, wheels, color } = cfg;

  const colorCfg = HANGER_COLORS[color] || HANGER_COLORS.silver;
  const matAlu = new THREE.MeshPhysicalMaterial({
    color: colorCfg.hex,
    roughness: colorCfg.roughness,
    metalness: colorCfg.metalness,
    envMapIntensity: 0.95,
  });
  const matWood = new THREE.MeshPhysicalMaterial({
    color: 0xc8b394,
    roughness: 0.55,
    metalness: 0.02,
    envMapIntensity: 0.6,
  });
  const matCabinet = new THREE.MeshPhysicalMaterial({
    color: 0x8a94a0,
    roughness: 0.42,
    metalness: 0.15,
    envMapIntensity: 0.8,
  });
  const matTop = new THREE.MeshPhysicalMaterial({
    color: 0x6b7280,
    roughness: 0.35,
    metalness: 0.2,
    envMapIntensity: 0.9,
  });
  const matHandle = new THREE.MeshPhysicalMaterial({
    color: 0xd0d5dd,
    roughness: 0.25,
    metalness: 0.92,
    envMapIntensity: 1.0,
  });
  const matWheel = new THREE.MeshStandardMaterial({
    color: 0x2a2d31,
    roughness: 0.5,
    metalness: 0.3,
  });

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width;   // 宽（横杆方向 X）
  const D = depth;   // 深（进深方向 Z）
  const H = height;  // 立柱高度 Y

  const px = W / 2 - POST_D / 2;  // 左右立柱中心
  const pz = D / 2 - POST_D / 2;  // 前后立柱中心
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  const yPost0 = 0.08;            // 柱底（底框上方）
  const yPostTall = yPost0 + H;   // 立柱顶端
  const yTopRail = yPostTall - POST_D / 2;

  // ---- 基础几何复用 ----
  const rodGeo = new THREE.CylinderGeometry(POST_D / 2, POST_D / 2, 1, 16);
  const clampGeo = new THREE.BoxGeometry(0.038, 0.038, 0.038);
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.018, 16); wheelGeo.rotateX(Math.PI / 2);
  const footGeo = new THREE.CylinderGeometry(0.019, 0.022, 0.02, 14);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const braceGeo = new THREE.BoxGeometry(0.016, 1, 0.016);
  const handleGeo = new THREE.BoxGeometry(1, 0.012, 0.018);

  // ---- 1. 四角 ⌀30 光轴立柱（等高四柱，构成完整立体框架）----
  const posts = instanced(rodGeo, matAlu, 4);
  let pi = 0;
  _s.set(1, H, 1);
  for (const x of postXs) {
    for (const z of postZs) {
      _m4.compose(new THREE.Vector3(x, yPost0 + H / 2, z), _q.identity(), _s);
      posts.setMatrixAt(pi++, _m4);
    }
  }
  _s.set(1, 1, 1);
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 4 * H;
  stats.weightKg += 4 * H * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;

  // ---- 2. 顶框横梁与纵梁（闭合顶部外框，约束四柱顶端）----
  const railLenX = W - POST_D;
  const railLenZ = D - POST_D;

  // 顶框纵梁 ×2（左右各一，连通前后柱）
  const zRailsGroup = new THREE.Group();
  for (const x of postXs) {
    const zRail = new THREE.Mesh(rodGeo, matAlu);
    zRail.rotation.x = Math.PI / 2;
    zRail.scale.set(1, railLenZ, 1);
    zRail.position.set(x, yTopRail, 0);
    zRailsGroup.add(zRail);
    stats.profileLengthM += railLenZ;
    stats.weightKg += railLenZ * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;
  }
  group.add(zRailsGroup);
  groups.zRails = zRailsGroup;

  // 顶框横梁 ×2（前后各一）+ 挂衣主横杆 ×1（居中 z=0，衣架垂挂空间充足）
  const topRailsGroup = new THREE.Group();
  for (const z of postZs) {
    const xRail = new THREE.Mesh(rodGeo, matAlu);
    xRail.rotation.z = Math.PI / 2;
    xRail.scale.set(1, railLenX, 1);
    xRail.position.set(0, yTopRail, z);
    topRailsGroup.add(xRail);
    stats.profileLengthM += railLenX;
    stats.weightKg += railLenX * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;
  }

  // 居中挂衣主横杆（z=0，挂衣前后各留约 25cm 余量，衣物不碰墙不撞柱）
  const yHang = yTopRail - 0.10;
  const hangRail = new THREE.Mesh(rodGeo, matAlu);
  hangRail.rotation.z = Math.PI / 2;
  hangRail.scale.set(1, railLenX, 1);
  hangRail.position.set(0, yHang, 0);
  topRailsGroup.add(hangRail);
  stats.profileLengthM += railLenX;
  stats.weightKg += railLenX * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;

  // 挂杆两端 T 型夹块（牢固锁紧在左右纵梁/立柱上）
  for (const sx of [-1, 1]) {
    const clamp = new THREE.Mesh(clampGeo, matAlu);
    clamp.position.set(sx * px, yHang, 0);
    topRailsGroup.add(clamp);
  }

  group.add(topRailsGroup);
  groups.topRail = topRailsGroup;

  // ---- 3. 顶布置物搁板（坐于顶框之上，可放帽盒、行李箱、收纳筐）----
  const shelfW = W - 2 * POST_D - 0.006;
  const shelfD = D - 2 * POST_D - 0.006;
  const shelfT = 0.018;
  const shelfY = yTopRail + POST_D / 2 - shelfT / 2;
  const shelf = new THREE.Mesh(boxGeo, matWood);
  shelf.scale.set(shelfW, shelfT, shelfD);
  shelf.position.set(0, shelfY, 0);
  group.add(shelf);
  groups.shelf = shelf;
  stats.weightKg += shelfW * shelfD * shelfT * DENSITY_PLY;

  // ---- 4. 结构斜撑（左右侧框顶部 45° 三角加固支撑，端点严密连接纵梁与立柱，绝无悬空）----
  const braceArm = 0.16;
  const braceLen = Math.hypot(braceArm, braceArm);
  const braces = instanced(braceGeo, matAlu, 4);
  let bi = 0;
  for (const sx of postXs) {
    for (const sz of [-1, 1]) {
      // 支撑在左右侧面 (X=sx)，从立柱顶端向下 braceArm 连到纵梁向内 braceArm
      _s.set(1, braceLen, 1);
      _q.setFromEuler(_e.set(-sz * Math.PI / 4, 0, 0));
      _m4.compose(new THREE.Vector3(sx, yTopRail - braceArm / 2, sz * (pz - braceArm / 2)), _q, _s);
      braces.setMatrixAt(bi++, _m4);
    }
  }
  _s.set(1, 1, 1); _q.identity();
  group.add(braces);
  groups.braces = braces;
  stats.weightKg += 4 * braceLen * 0.016 * 0.016 * DENSITY_ALU;

  // ---- 5. 底部储物柜与抽屉（嵌于四柱之间，抽屉层数可调 0-3 层）----
  const cabH = 0.46;
  const cabW = W - 2 * POST_D - 0.024; // 两侧留 12mm 间隙，不穿模立柱
  const cabD = D - 2 * POST_D - 0.024; // 前后留 12mm 间隙
  const cabY = yPost0 + cabH / 2;
  const CAB_T = 0.015; // 柜体板厚 15mm

  // 柜体外壳（5 面体结构：底板 + 左右侧板 + 背板，顶面由台面盖合，正面敞口供装抽屉/开放格）
  const cabGroup = new THREE.Group();

  // 底板
  const cabBottom = new THREE.Mesh(boxGeo, matCabinet);
  cabBottom.scale.set(cabW, CAB_T, cabD);
  cabBottom.position.set(0, yPost0 + CAB_T / 2, 0);
  cabGroup.add(cabBottom);

  // 左右侧板
  for (const sx of [-1, 1]) {
    const cabSide = new THREE.Mesh(boxGeo, matCabinet);
    cabSide.scale.set(CAB_T, cabH, cabD);
    cabSide.position.set(sx * (cabW / 2 - CAB_T / 2), cabY, 0);
    cabGroup.add(cabSide);
  }

  // 背板
  const cabBack = new THREE.Mesh(boxGeo, matCabinet);
  cabBack.scale.set(cabW - 2 * CAB_T, cabH - CAB_T, CAB_T);
  cabBack.position.set(0, yPost0 + CAB_T + (cabH - CAB_T) / 2, -cabD / 2 + CAB_T / 2);
  cabGroup.add(cabBack);

  group.add(cabGroup);
  groups.cabinet = cabGroup;

  const cabShellVol = (cabW * cabD + 2 * cabH * cabD + (cabW - 2 * CAB_T) * (cabH - CAB_T)) * CAB_T;
  stats.weightKg += cabShellVol * DENSITY_PLY;

  // 柜顶置物台面（加厚灰顶板，略有挑檐，可放置折叠衣物、首饰托盘、随身包袋）
  const topPanel = new THREE.Mesh(boxGeo, matTop);
  topPanel.scale.set(cabW + 0.016, 0.02, cabD + 0.016);
  topPanel.position.set(0, yPost0 + cabH + 0.01, 0);
  group.add(topPanel);
  groups.topPanel = topPanel;
  stats.weightKg += (cabW + 0.016) * (cabD + 0.016) * 0.02 * DENSITY_PLY;

  // 抽屉模块（按 drawers 参数：0 为开放格鞋位，1-3 为水平分层拉出式抽屉）
  const nDrawers = Math.max(0, Math.min(3, drawers));
  if (nDrawers === 0) {
    // 0 层：开放格内嵌（温润木纹内衬，带立隔板与水平中搁板，形成四格开敞鞋位/收纳格）
    const openGroup = new THREE.Group();
    const inW = cabW - 2 * CAB_T - 0.004;
    const inH = cabH - CAB_T;
    const inD = cabD - CAB_T;
    const inY = yPost0 + CAB_T + inH / 2;
    const inZ = CAB_T / 2;

    // 水平中隔板
    const hShelf = new THREE.Mesh(boxGeo, matWood);
    hShelf.scale.set(inW, 0.012, inD);
    hShelf.position.set(0, inY, inZ);
    openGroup.add(hShelf);

    // 垂直中隔板
    const vDivider = new THREE.Mesh(boxGeo, matWood);
    vDivider.scale.set(0.012, inH, inD);
    vDivider.position.set(0, inY, inZ);
    openGroup.add(vDivider);

    group.add(openGroup);
    groups.openBox = openGroup;
    stats.weightKg += (inW * inD + inH * inD) * 0.012 * DENSITY_PLY;
  } else {
    // 1-3 层：水平分层抽屉面板 + 极简铝合金横向拉手
    const doorsGroup = new THREE.Group();
    const marginY = 0.018;
    const gapY = 0.008;
    const totalDrawerH = cabH - marginY * 2;
    const drawerH = (totalDrawerH - (nDrawers - 1) * gapY) / nDrawers;
    const drawerW = cabW - 0.018;
    const drawerFrontZ = cabD / 2 + 0.006;
    const handleW = Math.min(0.32, Math.max(0.18, drawerW * 0.35));

    for (let i = 0; i < nDrawers; i++) {
      const dy = (yPost0 + cabH - marginY) - drawerH / 2 - i * (drawerH + gapY);

      // 抽屉面板
      const panel = new THREE.Mesh(boxGeo, matCabinet);
      panel.scale.set(drawerW, drawerH, 0.016);
      panel.position.set(0, dy, drawerFrontZ);
      doorsGroup.add(panel);

      // 铝合金极简横向拉手
      const handle = new THREE.Mesh(handleGeo, matHandle);
      handle.scale.set(handleW, 1, 1);
      handle.position.set(0, dy, drawerFrontZ + 0.012);
      doorsGroup.add(handle);

      stats.weightKg += drawerW * drawerH * 0.016 * DENSITY_PLY + handleW * 0.012 * 0.018 * DENSITY_ALU;
    }
    group.add(doorsGroup);
    groups.doors = doorsGroup;
  }

  // ---- 6. 后框中间加强横撑（提高整架构件抗剪切刚度，兼做挂裤杆/挂钩导轨）----
  const yRearTie = yPost0 + cabH + (H - cabH) * 0.45;
  const rearTie = new THREE.Mesh(rodGeo, matAlu);
  rearTie.rotation.z = Math.PI / 2;
  rearTie.scale.set(1, railLenX, 1);
  rearTie.position.set(0, yRearTie, -pz);
  group.add(rearTie);
  stats.profileLengthM += railLenX;
  stats.weightKg += railLenX * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;

  for (const sx of [-1, 1]) {
    const clamp = new THREE.Mesh(clampGeo, matAlu);
    clamp.position.set(sx * px, yRearTie, -pz);
    group.add(clamp);
  }

  // ---- 7. 2020 铝型材底框（四角刚性闭合底梁）----
  const beamH = 0.02;
  const frameLenX = W;
  const frameLenZ = D - POST_D;
  const beamXGeo = new THREE.BoxGeometry(frameLenX, beamH, beamH);
  const beamZGeo = new THREE.BoxGeometry(beamH, beamH, frameLenZ);
  const yBottom = yPost0 - 0.04;
  for (const sign of [-1, 1]) {
    const fx = new THREE.Mesh(beamXGeo, matAlu);
    fx.position.set(0, yBottom, sign * pz);
    group.add(fx);
    const fz = new THREE.Mesh(beamZGeo, matAlu);
    fz.position.set(sign * px, yBottom, 0);
    group.add(fz);
  }
  stats.profileLengthM += 2 * (frameLenX + frameLenZ);
  stats.weightKg += 2 * (frameLenX + frameLenZ) * 0.02 * 0.02 * DENSITY_ALU;

  // ---- 8. 万向轮 / 调平地脚 ----
  if (wheels) {
    const wheelsMesh = instanced(wheelGeo, matWheel, 4);
    let wi = 0;
    for (const x of postXs) for (const z of postZs) {
      _m4.identity().setPosition(x, 0.025, z);
      wheelsMesh.setMatrixAt(wi++, _m4);
    }
    group.add(wheelsMesh);
    groups.wheels = wheelsMesh;
    stats.partCount += 4;
    stats.weightKg += 4 * WHEEL_MASS;
  } else {
    const feet = instanced(footGeo, matWheel, 4);
    let fi = 0;
    for (const x of postXs) for (const z of postZs) {
      _m4.identity().setPosition(x, 0.015, z);
      feet.setMatrixAt(fi++, _m4);
    }
    group.add(feet);
    groups.feet = feet;
    stats.partCount += 4;
    stats.weightKg += 4 * FOOT_MASS;
  }

  // ---- 9. 统计清单与算料 ----
  stats.partCount += 4 + 2 + 2 + 1 + 1 + 4 + 1 + (nDrawers > 0 ? nDrawers * 2 : 2) + 1 + 4 + 4;
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len: +len.toFixed(3), qty });
  };
  addCut('立柱 ⌀30 光轴', '⌀30', H, 4);
  addCut('主挂衣杆 ⌀30 光轴', '⌀30', railLenX, 1);
  addCut('顶框横杆 ⌀30 光轴', '⌀30', railLenX, 2);
  addCut('顶框纵杆 ⌀30 光轴', '⌀30', railLenZ, 2);
  addCut('后框横撑 ⌀30 光轴', '⌀30', railLenX, 1);
  addCut('底框横梁 2020', '20×20', frameLenX, 2);
  addCut('底框纵梁 2020', '20×20', frameLenZ, 2);

  stats.panes = [];
  stats.hardware = [
    wheels ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: 'T 型夹块（挂杆/横撑节点）', qty: 4 },
    { name: '45° 加固斜撑角件', qty: 4 },
    ...(nDrawers > 0 ? [{ name: '铝合金极简横向拉手', qty: nDrawers }] : []),
  ];

  function dispose() {
    group.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m?.dispose?.());
    });
    [matAlu, matWood, matCabinet, matTop, matHandle, matWheel].forEach(m => m.dispose());
    while (group.children.length) group.remove(group.children[0]);
  }

  return {
    group,
    groups,
    stats,
    bounds: { W: W + 0.04, H: yPostTall + 0.04, D: D + 0.04 },
    config: cfg,
    dispose,
  };
}
