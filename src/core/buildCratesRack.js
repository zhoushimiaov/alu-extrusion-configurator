// 周转箱收纳架参数化装配（参考图复刻 v2）
// 结构（真实铝型材）：
//   4×2040 立柱（makeTSlotShape(.04,.02) tall 截面，extrudeUp）—— 槽口朝外
//   底框/顶框：X 梁 extrudeAlongX(makeTSlotShape(.02,.02))，Z 梁 extrudeAlongZ(makeTSlotShape(.02,.02))
//   每层滑轨 ×2：extrudeAlongZ(2020 截面)，箱底滚落沿
//   周转箱：正立方梯台（Box 主体叠台），正交摆放不歪斜；口沿加强圈
//   万向轮 / 调平地脚
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
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
  // 新箱体为直壁微拔模（参考实物 PP 箱），不再有 0.05 的大梯台倾斜。
  // 尺寸约束改为：唇边外凸 + 微拔模 + 装配间隙，全部计入后仍在立柱内表面以内。
  const LIP_OUT = 0.012;       // 外翻唇边外凸量（与下方建模一致）
  const DRAFT_MAX = 0.012;     // 微拔模最大外扩（下窄上宽）
  const RIM_OUT = LIP_OUT;     // 口沿外扩 = 唇边外凸
  const GAP = 0.005;           // 与立柱内表面的装配间隙
  // 滑轨/横梁顶面：轨中心 (ry - BEAM/2 - 0.007) + 半高 BEAM/2
  const railTopOffset = -0.007;
  // 第 t 层滑轨中心高度（与下方 railYs 数组同一公式，自包含不依赖数组定义顺序）
  const railYOf = (t) => yPost0 + BEAM + tierH * t + tierH / 2;
  // 箱高：逐层约束——不穿上一层滑轨底面；最顶层不穿顶框底面
  // （原 bug：统一用 tierH-BEAM-0.03，最顶层没有"上一层滑轨"，会穿插顶框 59mm）
  const crateHOf = (t) => {
    const yBase = railYOf(t) + railTopOffset;
    const aboveBottom = t < tiers - 1
      ? railYOf(t + 1) - BEAM / 2 - 0.007 - BEAM / 2   // 上一层滑轨底面
      : yTop - BEAM / 2;                               // 最顶层：顶框底面
    // 可用空间 avail 是硬上限：箱高留 1cm 间隙、封顶 0.30m，再对 avail 封顶。
    // 这样无论 tiers/height 取何值，箱高恒 ≤ avail，可证明不穿上一层/顶框。
    const avail = aboveBottom - yBase;
    const want = Math.min(avail - 0.01, 0.30);
    return Math.min(Math.max(0.02, want), Math.max(0, avail));
  };
  // 微拔模外扩很小，直接取最大拔模量保守计入（不再用梯台三角函数）
  const crateHMax = Math.max(...Array.from({ length: tiers }, (_, t) => crateHOf(t)));
  const TILT_PAD = DRAFT_MAX / 2;
  // 箱宽（Z 向）：抽出、微拔模、唇边、间隙全部计入后仍在立柱内表面以内
  const crateTopW = Math.max(0.20, Math.min(D + 0.02, 2 * (innerZ - pullDist - TILT_PAD - RIM_OUT - GAP)));
  // 箱长（X 向）：钳制到立柱内表面以内（抽出方向在 Z 向、X 向不得穿立柱）
  const crateLen = Math.max(0.24, Math.min(W - 0.02, 2 * (innerX - RIM_OUT - GAP)));

  // ---- 几何（真实 T-slot 铝型材）----
  // 立柱顶只到顶框上沿 + 15mm 余量（实物是"齐顶框架"；原 H+2*BEAM 会冲出顶箱 52cm，观感"飞起来"）
  const postTopY = yTop + BEAM / 2 + 0.015;
  const postLen = postTopY - (yPost0 - BEAM); // 立柱实际长度
  // 2040 立柱：截面 .04 宽 × .02 厚（tall 双腔），槽口朝 ±X 外侧
  const postGeo = extrudeUp(makeTSlotShape(.04, .02), postLen);
  // 2020 梁：正方截面
  const beamXGeo = extrudeAlongX(makeTSlotShape(BEAM, BEAM), frameLenXOf());
  function frameLenXOf() { return W + POST_W; }
  // Z 向梁：截面旋转（makeTSlotShape(.02,.02) 正方，extrudeAlongZ 沿 Z 拉）
  const beamZGeo = extrudeAlongZ(makeTSlotShape(BEAM, BEAM), frameLenZOf());
  beamZGeo.translate(0, 0, -frameLenZOf() / 2);   // 居中（extrudeAlongZ 从 0 起）
  function frameLenZOf() { return D + POST_W; }
  // 层轨：Z 向 2020。长度恰好覆盖箱深 + 抽出余量，端头收进前后框内，不外挑出立柱。
  // 原 bug：D + POST_W + 0.06 让两端各外挑 30mm 超出立柱外缘（节点处"型材伸出去"）。
  const railLen = 2 * (innerZ + pullDist) + 0.02;   // 箱深覆盖 + 抽出余量 + 少量搭接
  const railGeo = extrudeAlongZ(makeTSlotShape(BEAM, BEAM), railLen);
  railGeo.translate(0, 0, -railLen / 2);   // 居中

  const frameLenX = W + POST_W;
  const frameLenZ = D + POST_W;

  // ---- 立柱 ×4 ----
  // 注意：extrudeUp 生成的几何 Y 从 0 起（不居中），所以 position.y = 立柱底面，不要再加 postLen/2。
  // 原 bug：写了 yPost0-BEAM+postLen/2，导致立柱整体悬空 0.5m（底在 0.5875 而非 0.085），这就是"框架飞起来"的根源。
  const posts = instanced(postGeo, matAlu, 4);
  let i = 0;
  for (const x of postXs) for (const z of postZs) {
    _m4.identity().setPosition(x, yPost0 - BEAM, z);
    posts.setMatrixAt(i++, _m4);
  }
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 4 * (H + BEAM * 2);

  // ---- 底框 + 顶框（X 梁 + Z 梁）----
  const frameXGroup = new THREE.Group();
  const frameZGroup = new THREE.Group();
  for (const y of [yBottom, yTop]) {
    const fx = instanced(beamXGeo, matAlu, 2);
    setM(fx, 0, -pz - POST_W / 2 + BEAM / 2, y, 'x');
    setM(fx, 1, pz - POST_W / 2 - BEAM / 2 + 0.002, y, 'x');
    frameXGroup.add(fx);
    const fz = instanced(beamZGeo, matAlu, 2);
    setM(fz, 0, -px - POST_W / 2 + BEAM / 2, y, 'z');
    setM(fz, 1, px - POST_W / 2 - BEAM / 2 + 0.002, y, 'z');
    frameZGroup.add(fz);
  }
  group.add(frameXGroup);
  group.add(frameZGroup);
  groups.frameX = frameXGroup;
  groups.frameZ = frameZGroup;
  stats.profileLengthM += 2 * (2 * frameLenX + 2 * frameLenZ);

  function setM(mesh, idx, a, b, axis) {
    // X 梁：a=Z 位置，b=Y；Z 梁：a=X 位置，b=Y
    _m4.identity().setPosition(axis === 'x' ? 0 : a, b, axis === 'x' ? a : 0);
    mesh.setMatrixAt(idx, _m4);
  }

  // ---- 每层滑轨 ×2（Z 向，贴立柱内壁、托住箱底两侧——实物里箱子坐在全深侧轨上）----
  // 原 bug：滑轨悬在 ±px*0.45（远离立柱），箱子两侧悬空，看着"飞起来"
  const railYs = [];
  for (let t = 0; t < tiers; t++) railYs.push(yPost0 + BEAM + tierH * t + tierH / 2);
  const rails = instanced(railGeo, matAlu, tiers * 2);
  let ri = 0;
  // 滑轨内侧面贴立柱内壁，箱底两侧正好落在轨面上
  const railX = innerX - BEAM / 2 - 0.003;
  for (const ry of railYs) {
    _m4.identity().setPosition(-railX, ry - BEAM / 2 - 0.007, 0);
    rails.setMatrixAt(ri++, _m4);
    _m4.identity().setPosition(railX, ry - BEAM / 2 - 0.007, 0);
    rails.setMatrixAt(ri++, _m4);
    stats.profileLengthM += 2 * railLen;
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

  // ---- 周转箱（参考实物：直壁深箱 + 外翻唇边 + 密排竖向加强筋 + 半透明磨砂 PP）----
  // 实物特征（参考图）：半透明磨砂塑料、箱口一圈外翻加厚唇边（承重挂在滑轨上）、
  //   四周竖向加强筋、正面一块光滑标签区、空腔有深度、无盖无把手孔。
  const bodyMats = {};
  const rimMats = {};
  for (const key of Object.keys(CRATE_COLORS)) {
    // 半透明磨砂 PP：低粗糙度透一点光，呈现"朦胧塑料感"而非实心板
    bodyMats[key] = new THREE.MeshPhysicalMaterial({
      color: CRATE_COLORS[key].hex, roughness: 0.34, metalness: 0.0,
      transmission: 0.68, thickness: 0.006, ior: 1.46,
      envMapIntensity: 0.9, clearcoat: 0.35, clearcoatRoughness: 0.35,
    });
    // 唇边用同色但更亮、更挺的材质，让外翻边在视觉上"立起来"
    rimMats[key] = new THREE.MeshPhysicalMaterial({ color: CRATE_COLORS[key].rib, roughness: 0.30, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 1.0 });
  }

  // 直壁深箱：微拔模斜度（下略窄上略宽），空腔有深度
  const crateGroup = new THREE.Group();
  for (let t = 0; t < tiers; t++) {
    const colorKey = (SCHEME_SEQ[scheme] || SCHEME_SEQ.mix)[t % (SCHEME_SEQ[scheme] || SCHEME_SEQ.mix).length];
    const yBase = railYs[t] + railTopOffset;                    // 箱底落在滑轨/横梁顶面
    const zOff = pullOut ? (t % 2 === 0 ? 1 : -1) * pullDist : 0;   // 交错抽出（不出立柱平面）
    const crateH = crateHOf(t);   // 逐层箱高：最顶层受顶框底面约束，不再穿插

    const g = new THREE.Group();
    const wallT = 0.006;                 // 壁厚约 6mm（参考：PP 注塑箱 3~5mm，加厚提升存在感）
    const draft = Math.min(0.012, crateH * 0.06);  // 微拔模斜度（下窄上宽，近直壁）
    const topLen = crateLen, botLen = crateLen - draft;
    const topW = crateTopW, botW = crateTopW - draft;
    const ribW = 0.005, ribProtrude = 0.002;       // 加强筋：窄而低矮（不抢眼，避免波纹板观感）

    // 四面侧壁（直壁微拔模）：Box + 顶部外扩旋转，简单可靠（避免挤出坐标系错乱）
    // 前/后壁（沿 X 长，法线朝 ±Z）
    for (const sz of [1, -1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(botLen, crateH, wallT), bodyMats[colorKey]);
      // 拔模：绕底部 X 轴微转，使上口外扩 draft/2
      const ang = Math.atan2(draft / 2, crateH);
      wall.position.set(0, crateH / 2, sz * (botW / 2 - wallT / 2));
      wall.rotation.x = -sz * ang;
      g.add(wall);
    }
    // 左/右壁（沿 Z 深，法线朝 ±X）
    for (const sx of [1, -1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, crateH, botW - wallT * 2), bodyMats[colorKey]);
      const ang = Math.atan2(draft / 2, crateH);
      wall.position.set(sx * (botLen / 2 - wallT / 2), crateH / 2, 0);
      wall.rotation.z = sx * ang;
      g.add(wall);
    }
    // 内侧壁暗衬（四片贴内壁的深色面，制造"空腔纵深感"——各角度都能看出箱子是空的、能装东西）
    const innerWallMat = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    const inH = crateH - 0.01;
    for (const sz of [1, -1]) {
      const iw = new THREE.Mesh(new THREE.BoxGeometry(botLen - wallT * 2, inH, 0.001), innerWallMat);
      iw.position.set(0, inH / 2 + 0.004, sz * (botW / 2 - wallT - 0.0005));
      g.add(iw);
    }
    for (const sx of [1, -1]) {
      const iw = new THREE.Mesh(new THREE.BoxGeometry(0.001, inH, botW - wallT * 2), innerWallMat);
      iw.position.set(sx * (botLen / 2 - wallT - 0.0005), inH / 2 + 0.004, 0);
      g.add(iw);
    }
    // 底板（有厚度，四角微圆角感由壁面包容）
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(botLen - wallT, wallT * 1.5, botW - wallT), bodyMats[colorKey]);
    bottom.position.set(0, wallT * 0.75, 0);
    g.add(bottom);
    // 内腔衬底（深色内面，从上方/正视能看出"是个有深度的空腔容器"，而非实心门板）
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.85, metalness: 0.0 });
    const innerBottom = new THREE.Mesh(new THREE.BoxGeometry(botLen - wallT * 2, 0.002, botW - wallT * 2), innerMat);
    innerBottom.position.set(0, wallT * 1.5 + 0.001, 0);
    g.add(innerBottom);

    // 外翻唇边（箱口一圈加厚外翻边，承重挂在滑轨上）：4 条明显加厚的框，外凸更挺
    const lipH = 0.026, lipOut = 0.014;
    const lipY = crateH - lipH / 2;
    const lipLong = new THREE.Mesh(new THREE.BoxGeometry(topLen + lipOut * 2, lipH, lipOut + wallT), rimMats[colorKey]);
    lipLong.position.set(0, lipY, topW / 2 + lipOut / 2 - wallT / 2);
    const lipLong2 = lipLong.clone(); lipLong2.position.z = -(topW / 2 + lipOut / 2 - wallT / 2);
    const lipShort = new THREE.Mesh(new THREE.BoxGeometry(lipOut + wallT, lipH, topW + lipOut * 2), rimMats[colorKey]);
    lipShort.position.set(topLen / 2 + lipOut / 2 - wallT / 2, lipY, 0);
    const lipShort2 = lipShort.clone(); lipShort2.position.x = -(topLen / 2 + lipOut / 2 - wallT / 2);
    g.add(lipLong, lipLong2, lipShort, lipShort2);

    // 侧面标签区（实物 EU 箱正面有一块光滑无筋的印刷/标签面）：前壁中部一块浅色贴片
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xf2f3f0, roughness: 0.6, metalness: 0.02 });
    const labelW = topLen * 0.34, labelH = crateH * 0.42;
    const label = new THREE.Mesh(new THREE.BoxGeometry(labelW, labelH, 0.001), labelMat);
    label.position.set(0, crateH * 0.46, botW / 2 + 0.0012);   // 贴前壁（+Z 面）
    g.add(label);

    // 竖向加强筋（稀疏、低矮——参考实物 EU 箱：光滑主面 + 少量低调加强筋，
    // 而非满屏密条纹。过密会读作"折叠波纹板"）
    const ribH = crateH - lipH - 0.008;
    const ribY = ribH / 2 + 0.004;
    const ribGeoX = new THREE.BoxGeometry(ribW, ribH, ribProtrude);   // 贴前/后壁
    const ribGeoZ = new THREE.BoxGeometry(ribProtrude, ribH, ribW);   // 贴左/右壁
    // 前后壁：沿 X 稀疏分布（间距约 60mm，低调不抢眼）
    const nRibX = Math.max(3, Math.floor(topLen / 0.060));
    for (let r = 0; r < nRibX; r++) {
      const x = -topLen / 2 + (r + 0.5) * (topLen / nRibX);
      for (const sz of [1, -1]) {
        const rib = new THREE.Mesh(ribGeoX, rimMats[colorKey]);
        rib.position.set(x, ribY, sz * (botW / 2 + ribProtrude / 2 + (draft / 2) * (ribY / crateH)));
        g.add(rib);
      }
    }
    // 左右壁：沿 Z 稀疏分布
    const nRibZ = Math.max(2, Math.floor(topW / 0.060));
    for (let r = 0; r < nRibZ; r++) {
      const z = -topW / 2 + (r + 0.5) * (topW / nRibZ);
      for (const sx of [1, -1]) {
        const rib = new THREE.Mesh(ribGeoZ, rimMats[colorKey]);
        rib.position.set(sx * (botLen / 2 + ribProtrude / 2 + (draft / 2) * (ribY / crateH)), ribY, z);
        g.add(rib);
      }
    }

    g.position.set(0, yBase, zOff);
    crateGroup.add(g);
  }
  group.add(crateGroup);
  groups.crates = crateGroup;

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
  groups.corners = corners;

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
    groups.wheels = wheels;
    groups.forks = forks;
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
    groups.feet = feet;
    wheelParts = 4;
  }

  // ---- 统计 ----
  // postLen 已在几何段定义（立柱顶=顶框上沿+15mm），直接复用，不再重复定义
  const volAlu = (4 * postLen * POST_W * 0.02
    + 2 * (2 * frameLenX + 2 * frameLenZ) * BEAM * BEAM
    + tiers * 2 * railLen * BEAM * BEAM
    + tiers * 2 * frameLenX * BEAM * BEAM);
  // 箱体自重用"展开壁面积 × 壁厚"估算：直壁微拔模，壁面积约 (2长+2深)×高 + 底
  // crateTopW 为上口宽，下底略窄（微拔模），取上口宽近似即可（拔模量 ≤12mm，对面积影响 <5%）
  let crateWallArea = 0;
  for (let t = 0; t < tiers; t++) {
    const h = crateHOf(t);
    crateWallArea += 2 * (crateLen + crateTopW) * h + crateLen * crateTopW;
  }
  stats.weightKg = volAlu * DENSITY_ALU + crateWallArea * 0.004 * 900 + 8 * 0.03 + (casters ? 4 * 0.15 : 4 * 0.05);
  stats.partCount = 4 + 4 + tiers * (2 + 2 + 1) + 8 + wheelParts + 2;

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('立柱 2040（T-slot）', '2040', +postLen.toFixed(3), 4);
  addCut('框梁 2020（T-slot）', '2020', +frameLenX.toFixed(3), 4);
  addCut('框梁 2020（T-slot）', '2020', +frameLenZ.toFixed(3), 4);
  addCut("层轨 2020（T-slot）", "2020", +railLen.toFixed(3), tiers * 2);
  stats.cutList.push({ spec: `物流周转箱（${scheme === 'mix' ? '混搭' : CRATE_SCHEMES[scheme].label}）`, section: '件', len: +crateLen.toFixed(2), qty: tiers });
  stats.panes = [];
  stats.hardware = [
    casters ? { name: '万向轮 1.5 寸（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '角件', qty: 8 },
    { name: '滑轨垫片', qty: tiers * 4 },
  ];

  stats.envelope = computeEnvelope(group);
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
