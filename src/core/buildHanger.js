// 光轴挂衣架参数化装配（忠实参考 SketchUp 挂衣架.glb 逆向结构）
//
// GLB 实测尺寸（英寸→米，Z-up 已转 Y-up）：
//   整体：W 0.504（深）× H 2.480 × D 1.402（宽）
//   立柱：⌀30（1.181"），后排 2 根高柱 2.43m（95.67"），前排 2 根矮柱 1.39m（54.8"）
//   顶挂杆：后排高柱间 X 向 ⌀30 横杆 + 左右各一根 Z 向短杆
//   中层搁板：前排矮柱间木质板（≈0.45×0.504×0.03），板下斜撑 ×2
//   底柜：左半带门柜（灰蓝门+灰台面），右半开放格（木色内衬）
//   底框：四角 2020 方框；无轮（参考模型无底轮）
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
function setMT(i, mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m4.compose(new THREE.Vector3(x, y, z), _q, _s);
  mesh.setMatrixAt(i, _m4);
}

export function buildHanger(config) {
  const cfg = { ...DEFAULT_HANGER_CONFIG, ...config };
  const { width, depth, height, drawers, wheels, color } = cfg;

  const colorCfg = HANGER_COLORS[color] || HANGER_COLORS.silver;
  const matAlu = new THREE.MeshPhysicalMaterial({ color: colorCfg.hex, roughness: colorCfg.roughness, metalness: colorCfg.metalness, envMapIntensity: 0.95 });
  const matWood = new THREE.MeshPhysicalMaterial({ color: 0xc8b394, roughness: 0.55, metalness: 0.02, envMapIntensity: 0.6 });
  const matCabinet = new THREE.MeshPhysicalMaterial({ color: 0x8a94a0, roughness: 0.42, metalness: 0.15, envMapIntensity: 0.8 });
  const matTop = new THREE.MeshPhysicalMaterial({ color: 0x6b7280, roughness: 0.35, metalness: 0.2, envMapIntensity: 0.9 });
  const matWheel = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.3 });

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  // GLB 中 X=深(0.504)、Z=宽(1.402)、Y=高(2.48)；参数化用 X=宽、Z=深，与现有产品一致
  const W = width;   // 宽（挂杆方向）
  const D = depth;   // 深（前后）
  const H = height;  // 后排高柱高度

  // 前排矮柱高度：GLB 中高柱 2.43m、矮柱 1.39m，比例 0.572
  const hShort = +(H * 0.572).toFixed(3);

  const px = W / 2 - POST_D / 2;  // 左右柱中心：外缘齐 W
  const pz = D / 2 - POST_D / 2;  // 前后柱中心：外缘齐 D
  // 后排（z = -pz）为高柱，前排（z = +pz）为矮柱
  const postXs = [-px, px];

  const yPost0 = 0.08;             // 柱底（底框上方）
  const yPostTall = yPost0 + H;    // 高柱顶
  const yPostShort = yPost0 + hShort; // 矮柱顶

  // ---- 几何 ----
  const postGeo = new THREE.CylinderGeometry(POST_D / 2, POST_D / 2, 1, 16);
  const railGeo = new THREE.CylinderGeometry(POST_D / 2, POST_D / 2, 1, 12);
  const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.018, 16); wheelGeo.rotateX(Math.PI / 2);
  const footGeo = new THREE.CylinderGeometry(0.019, 0.022, 0.02, 14);
  const shelfGeo = new THREE.BoxGeometry(1, 1, 1);
  const braceGeo = new THREE.BoxGeometry(0.015, 1, 0.015);
  const doorGeo = new THREE.BoxGeometry(1, 1, 0.02);
  const cabinetGeo = new THREE.BoxGeometry(1, 1, 1);

  // ---- 立柱 ×4：后排 2 高柱 + 前排 2 矮柱 ----
  const posts = instanced(postGeo, matAlu, 4);
  let pi = 0;
  for (const x of postXs) {
    // 后排高柱（z = -pz）
    _s.set(1, H, 1);
    _m4.compose(new THREE.Vector3(x, yPost0 + H / 2, -pz), _q.identity(), _s);
    posts.setMatrixAt(pi++, _m4);
    // 前排矮柱（z = +pz）
    _s.set(1, hShort, 1);
    _m4.compose(new THREE.Vector3(x, yPost0 + hShort / 2, pz), _q.identity(), _s);
    posts.setMatrixAt(pi++, _m4);
  }
  _s.set(1, 1, 1);
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 2 * H + 2 * hShort;
  stats.weightKg += (2 * H + 2 * hShort) * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;

  // ---- 顶挂杆：后排高柱之间 X 向 ⌀30 横杆 ----
  const railLen = W - POST_D;  // 杆长（两端穿入柱心）
  const topRail = new THREE.Mesh(railGeo, matAlu);
  topRail.rotation.z = Math.PI / 2;
  topRail.scale.set(1, railLen, 1);
  topRail.position.set(0, yPostTall - POST_D / 2, -pz);
  group.add(topRail);
  groups.topRail = topRail;
  stats.profileLengthM += railLen;
  stats.weightKg += railLen * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;

  // ---- 左右 Z 向短杆：连接前后柱（高度 = 矮柱顶） ----
  const zRailLen = D - POST_D;
  const zRailsGroup = new THREE.Group();
  for (const x of postXs) {
    const zRail = new THREE.Mesh(railGeo, matAlu);
    zRail.rotation.x = Math.PI / 2;
    zRail.scale.set(1, zRailLen, 1);
    zRail.position.set(x, yPostShort - POST_D / 2, 0);
    zRailsGroup.add(zRail);
    stats.profileLengthM += zRailLen;
    stats.weightKg += zRailLen * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;
  }
  group.add(zRailsGroup);
  groups.zRails = zRailsGroup;


  // ---- 中层搁板：前排矮柱之间木质板（GLB 特征：板下两侧斜撑）----
  const shelfW = W - 2 * POST_D - 0.01;
  const shelfD = D - POST_D - 0.02;
  const shelfT = 0.03;
  const shelfY = yPostShort - POST_D - shelfT / 2;
  const shelf = new THREE.Mesh(shelfGeo, matWood);
  shelf.scale.set(shelfW, shelfT, shelfD);
  shelf.position.set(0, shelfY, 0);
  group.add(shelf);
  groups.shelf = shelf;
  stats.weightKg += shelfW * shelfD * shelfT * DENSITY_PLY;

  // 搁板下斜撑 ×2（左右各一，从板底斜向柱身）
  const braceLen = Math.hypot(0.18, 0.12);
  const braceAngle = Math.atan2(0.18, 0.12);
  const braces = instanced(braceGeo, matAlu, 2);
  let bi = 0;
  for (const sx of [-1, 1]) {
    _s.set(1, braceLen, 1);
    _q.setFromEuler(_e.set(0, 0, sx * braceAngle));
    _m4.compose(new THREE.Vector3(sx * (shelfW / 2 - 0.06), shelfY - 0.09, 0), _q, _s);
    braces.setMatrixAt(bi++, _m4);
  }
  _s.set(1, 1, 1); _q.identity();
  group.add(braces);
  groups.braces = braces;
  stats.weightKg += 2 * braceLen * 0.015 * 0.015 * DENSITY_ALU;

  // ---- 底柜：贴前柱矮柜（GLB 特征：柜体前缘对齐前柱内壁，后缘留空；柱从柜体两侧穿过）----
  const cabH = 0.45;               // 柜高（GLB 实测约 0.45m）
  const cabW = W - 2 * POST_D - 0.04; // 柜宽：比柱间距小 2cm/侧（柱从两侧穿过）
  const cabD = D - POST_D - 0.06;  // 柜深：前缘贴前柱内壁，后缘留 3cm 空
  const cabY = yPost0 + cabH / 2;
  const cabFrontZ = pz - POST_D / 2 - 0.01;  // 前缘贴前柱内壁（z=+pz 是前）
  const cabBackZ = cabFrontZ - cabD;          // 后缘向 -z 延伸
  const cabZ = (cabFrontZ + cabBackZ) / 2;    // 柜体中心 z
  const cabWLeft = cabW * 0.55;   // 左半带门柜宽
  const cabWRight = cabW - cabWLeft;

  // 柜体外框（灰蓝，含背板）
  const cabBody = new THREE.Mesh(cabinetGeo, matCabinet);
  cabBody.scale.set(cabW, cabH, cabD);
  cabBody.position.set(0, cabY, cabZ);
  group.add(cabBody);
  groups.cabinet = cabBody;
  const PLY_T = 0.012;
  // 柜壳：底 + 顶 + 两侧 + 背板（四面板材，前开门无板）
  const cabShellVol = (cabW * cabD * 2 + cabH * cabD * 2 + cabW * cabH) * PLY_T;
  stats.weightKg += cabShellVol * DENSITY_PLY;

  // 左半带门柜：drawers 扇门（灰蓝，贴柜体前缘）
  const nDoors = Math.max(0, drawers);
  if (nDoors > 0) {
    const doorW = (cabWLeft - 0.02) / nDoors - 0.004;
    const doorH = cabH - 0.06;
    const doors = instanced(doorGeo, matCabinet, nDoors);
    for (let i = 0; i < nDoors; i++) {
      const dx = -cabW / 2 + 0.01 + i * (doorW + 0.004) + doorW / 2;
      _s.set(doorW, doorH, 1);
      _m4.compose(new THREE.Vector3(dx, cabY, cabFrontZ + 0.011), _q.identity(), _s);
      doors.setMatrixAt(i, _m4);
    }
    _s.set(1, 1, 1);
    group.add(doors);
    groups.doors = doors;
    stats.weightKg += nDoors * doorW * doorH * 0.02 * DENSITY_PLY;
  }

  // 右半开放格：木色内衬（无门，可见内部）
  if (cabWRight > 0.05) {
    const openW = cabWRight - 0.02;
    const openH = cabH - 0.06;
    const openD = cabD - 0.02;
    const openBox = new THREE.Mesh(cabinetGeo, matWood);
    openBox.scale.set(openW, openH, openD);
    openBox.position.set(cabW / 2 - cabWRight / 2 - 0.01, cabY, cabZ);
    group.add(openBox);
    groups.openBox = openBox;
    stats.weightKg += (openW * openD + openH * openD * 2 + openW * openH) * PLY_T * DENSITY_PLY;
  }

  // 柜顶台面（灰，略超出柜体前缘和两侧）
  const topPanel = new THREE.Mesh(shelfGeo, matTop);
  topPanel.scale.set(cabW + 0.02, 0.02, cabD + 0.04);
  topPanel.position.set(0, yPost0 + cabH + 0.01, cabZ - 0.01);
  group.add(topPanel);
  groups.topPanel = topPanel;
  stats.weightKg += (cabW + 0.02) * (cabD + 0.04) * 0.02 * DENSITY_PLY;

  // ---- 底框（四角 2020 底框梁）----
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

  // ---- 万向轮 / 地脚（参考模型无轮，默认关闭）----
  if (wheels) {
    const wheelsMesh = instanced(wheelGeo, matWheel, 4);
    let wi = 0;
    for (const x of postXs) for (const z of [-pz, pz]) {
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
    for (const x of postXs) for (const z of [-pz, pz]) {
      _m4.identity().setPosition(x, 0.015, z);
      feet.setMatrixAt(fi++, _m4);
    }
    group.add(feet);
    groups.feet = feet;
    stats.partCount += 4;
    stats.weightKg += 4 * FOOT_MASS;
  }

  // ---- 统计 ----
  stats.partCount += 4 + 3 + 2 + 1 + (nDoors > 0 ? 1 + nDoors : 1) + 1 + 1; // 立柱+顶杆/侧杆+斜撑+搁板+柜体+门+台面
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len: +len.toFixed(3), qty });
  };
  addCut('立柱 ⌀30 光轴（后排）', '⌀30', H, 2);
  addCut('立柱 ⌀30 光轴（前排）', '⌀30', hShort, 2);
  addCut('顶挂杆 ⌀30 光轴', '⌀30', railLen, 1);
  addCut('侧连短杆 ⌀30 光轴', '⌀30', zRailLen, 2);
  stats.panes = [];
  stats.hardware = [
    wheels ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: 'T 型夹块（挂杆节点）', qty: 6 },
  ];

  function dispose() {
    group.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      o.geometry.dispose && o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m && m.dispose());
    });
    [matAlu, matWood, matCabinet, matTop, matWheel].forEach(m => m.dispose());
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
