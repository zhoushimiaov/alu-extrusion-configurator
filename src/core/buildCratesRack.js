// 周转箱收纳架参数化装配（参考图复刻 v3）
// 结构（真实铝型材，对照参考实拍）：
//   4×2040 立柱（makeTSlotShape(.04,.02) tall 截面，extrudeUp）
//   底框（双层 2020 叠梁）/ 顶框：X 梁贴立柱前后外侧面、Z 梁贴左右外侧，角部黑色加强角码板
//   每层：左右 Z 向 2020 侧梁 + 黑色三节钢珠滑轨（外轨固定、中/内轨随抽出伸展）+ 前后托底横梁
//   周转箱：不透明 PP 物流箱（网格加强筋 + 外翻唇边 + 短边把手孔 + 长边印字标签），沿 Z 向抽出
//   白色尼龙护罩万向轮（带刹车）/ 调平地脚
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import { RAIL_BEAM, DENSITY_ALU, DEFAULT_CRATES_CONFIG, SCHEME_SEQ, CRATE_COLORS, CRATE_SCHEMES } from '../config/crates.js';
import { makeTSlotShape, extrudeUp, extrudeAlongX, extrudeAlongZ } from './profiles.js';
import { buildCasters, buildLevelFeet, outwardYaw } from './casters.js';

const _m4 = new THREE.Matrix4();

function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, mat.clone(), count) : null;
}

const BEAM = 0.02;
const POST_W = 0.04;      // 立柱 X 向宽（2040 宽面朝 ±Z）
const POST_T = 0.02;      // 立柱 Z 向厚
const SLIDE_T = 0.013;    // 三节滑轨总厚（外 5 + 中 4 + 内 4mm）
// 抽出量（占箱宽比例，自顶层起）：参考图顶层黑箱半抽、第二层白箱抽出更多，其余推入
const PULL_SEQ = [0.55, 0.72, 0, 0, 0.4, 0];

/** 箱体侧面印字标签（canvas 程序化；深色箱白字、白箱深字） */
const labelCache = new Map();
function labelTexture(dark) {
  const key = dark ? 'dark' : 'light';
  if (labelCache.has(key)) return labelCache.get(key);
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    g.clearRect?.(0, 0, 512, 256);
    const ink = dark ? 'rgba(240,240,236,0.92)' : 'rgba(40,42,46,0.88)';
    g.fillStyle = ink;
    g.textBaseline = 'alphabetic';
    g.font = '600 50px Georgia, "Times New Roman", serif';
    g.fillText?.('MODULO CRATE', 18, 86);
    g.fillRect(18, 116, 476, 3);
    g.font = 'italic 30px Georgia, serif';
    g.fillText?.('Industrial style', 18, 166);
    g.fillText?.('Turnover box', 18, 204);
    g.font = '600 58px Arial, sans-serif';
    g.fillText?.('‹‹ 600', 300, 200);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  labelCache.set(key, tex);
  return tex;
}

export function buildCratesRack(config) {
  const cfg = { ...DEFAULT_CRATES_CONFIG, ...config };
  const { width, depth, height, tiers, scheme, pullOut, casters } = cfg;
  const matAlu = new THREE.MeshPhysicalMaterial({ color: 0xd4d8dc, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.0 });
  const matGusset = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.42, metalness: 0.6 });
  const matBolt = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.3, metalness: 0.95 });
  // 钢珠滑轨：黑色电泳钢（外轨）+ 镀锌内轨（参考图：黑轨 + 银色锁扣）
  const matSlide = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.36, metalness: 0.7 });
  const matSlideIn = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.3, metalness: 0.85 });

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  const W = width, D = depth, H = height;
  const px = W / 2, pz = D / 2;
  const postXs = [-px, px];
  const postZs = [-pz, pz];

  const CASTER_H = 0.085;                 // 2 寸护罩万向轮安装面高（= 立柱底面）
  const yPostBottom = CASTER_H;
  const yBottom = yPostBottom + BEAM / 2; // 底框（下层梁）中心
  const yBottom2 = yBottom + BEAM;        // 底框上层叠梁中心（参考图底部双梁）
  const yPost0 = yBottom + BEAM / 2;
  const yPost1 = yPost0 + H;
  const yTop = yPost1 + BEAM / 2;

  const span = yPost1 - yPost0 - BEAM;
  const tierH = span / tiers;

  // ---- 周转箱尺寸约束 ----
  // X 向：箱长 = 两侧滑轨内轨之间；Z 向：箱宽留在立柱内表面以内（推入状态）
  const innerX = px - POST_W / 2;
  const innerZ = pz - POST_W / 2;
  const LIP_OUT = 0.012;
  const DRAFT_MAX = 0.012;
  const GAP = 0.005;
  const railX = innerX - BEAM / 2;                // 侧梁中心（贴立柱内侧面）
  const slideFace = railX - BEAM / 2;             // 侧梁内侧面 = 滑轨外轨安装面
  const railYOf = (t) => yPost0 + BEAM + tierH * t + tierH / 2;
  const railTopOffset = -0.007;
  const crateHOf = (t) => {
    const yBase = railYOf(t) + railTopOffset;
    const aboveBottom = t < tiers - 1
      ? railYOf(t + 1) - BEAM / 2 - 0.007 - BEAM / 2
      : yTop - BEAM / 2;
    const avail = aboveBottom - yBase;
    const want = Math.min(avail - 0.01, 0.30);
    return Math.min(Math.max(0.02, want), Math.max(0, avail));
  };
  const TILT_PAD = DRAFT_MAX / 2;
  const crateTopW = Math.max(0.20, Math.min(D + 0.02, 2 * (innerZ - TILT_PAD - LIP_OUT - GAP)));
  // 箱口唇边在 X 向也外翻 LIP_OUT：箱壁到滑轨内轨面留 2mm，唇边悬在滑轨上方
  const crateLen = Math.max(0.24, 2 * (slideFace - SLIDE_T - 0.002));

  const pullOf = (t) => {
    if (!pullOut) return 0;
    const fromTop = tiers - 1 - t;
    return +(crateTopW * (PULL_SEQ[fromTop % PULL_SEQ.length] || 0)).toFixed(4);
  };

  // ---- 几何（真实 T-slot 铝型材）----
  const postTopY = yTop + BEAM / 2 + 0.015;
  const postLen = postTopY - yPostBottom;
  const postGeo = extrudeUp(makeTSlotShape(POST_W, POST_T), postLen);
  // 框梁：X 梁贴立柱前后外侧（z=±(pz+POST_T/2+BEAM/2)），长 = 立柱 X 外沿；
  //       Z 梁贴左右外侧（x=±(px+POST_W/2+BEAM/2)），长 = 覆盖 X 梁端头 → 四角闭合无穿插
  const frameLenX = W + POST_W;
  const frameLenZ = D + POST_T + 2 * BEAM;
  const zBeamX = pz + POST_T / 2 + BEAM / 2;
  const xBeamZ = px + POST_W / 2 + BEAM / 2;
  const beamXGeo = extrudeAlongX(makeTSlotShape(BEAM, BEAM), frameLenX);
  const beamZGeo = extrudeAlongZ(makeTSlotShape(BEAM, BEAM), frameLenZ);
  beamZGeo.translate(0, 0, -frameLenZ / 2);
  // 每层侧梁：前后立柱之间（贴立柱内侧面），长度 = 立柱 Z 外沿
  const railLen = D + POST_T;
  const railGeo = extrudeAlongZ(makeTSlotShape(BEAM, BEAM), railLen);
  railGeo.translate(0, 0, -railLen / 2);

  // ---- 立柱 ×4 ----
  const posts = instanced(postGeo, matAlu, 4);
  let i = 0;
  for (const x of postXs) for (const z of postZs) {
    _m4.identity().setPosition(x, yPostBottom, z);
    posts.setMatrixAt(i++, _m4);
  }
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 4 * postLen;

  // ---- 底框（双层叠梁）+ 顶框 ----
  const frameXGroup = new THREE.Group();
  const frameZGroup = new THREE.Group();
  const frameYs = [yBottom, yBottom2, yTop];
  for (const y of frameYs) {
    const fx = instanced(beamXGeo, matAlu, 2);
    _m4.identity().setPosition(0, y, -zBeamX); fx.setMatrixAt(0, _m4);
    _m4.identity().setPosition(0, y, zBeamX); fx.setMatrixAt(1, _m4);
    frameXGroup.add(fx);
    const fz = instanced(beamZGeo, matAlu, 2);
    _m4.identity().setPosition(-xBeamZ, y, 0); fz.setMatrixAt(0, _m4);
    _m4.identity().setPosition(xBeamZ, y, 0); fz.setMatrixAt(1, _m4);
    frameZGroup.add(fz);
  }
  group.add(frameXGroup);
  group.add(frameZGroup);
  groups.frameX = frameXGroup;
  groups.frameZ = frameZGroup;
  stats.profileLengthM += frameYs.length * (2 * frameLenX + 2 * frameLenZ);

  // ---- 角部加强角码板（参考图：顶框四角黑色 L 板 + 外露螺栓；底框同理）----
  {
    const plateGeo = new THREE.BoxGeometry(0.05, 0.05, 0.004);
    const plateGeoZ = new THREE.BoxGeometry(0.004, 0.05, 0.05);
    const boltGeo = new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 12);
    const boltGeoZ = boltGeo.clone();
    boltGeo.rotateX(Math.PI / 2);
    boltGeoZ.rotateZ(Math.PI / 2);
    const cornerYs = [yTop - 0.012, yBottom2 - BEAM / 2 + 0.002];
    const n = cornerYs.length * 4;
    const pf = instanced(plateGeo, matGusset, n);
    const ps = instanced(plateGeoZ, matGusset, n);
    const bf = instanced(boltGeo, matBolt, n * 4);
    const bs = instanced(boltGeoZ, matBolt, n * 4);
    let a = 0, b = 0, c = 0, d = 0;
    for (const y of cornerYs) for (const x of postXs) for (const z of postZs) {
      const sx = Math.sign(x), sz = Math.sign(z);
      const fzPos = sz * (zBeamX + BEAM / 2 + 0.002);
      const sxPos = sx * (xBeamZ + BEAM / 2 + 0.002);
      _m4.identity().setPosition(x, y, fzPos); pf.setMatrixAt(a++, _m4);
      _m4.identity().setPosition(sxPos, y, z + sz * 0.006); ps.setMatrixAt(b++, _m4);
      for (const ox of [-0.014, 0.014]) for (const oy of [-0.014, 0.014]) {
        _m4.identity().setPosition(x + ox, y + oy, fzPos + sz * 0.003); bf.setMatrixAt(c++, _m4);
        _m4.identity().setPosition(sxPos + sx * 0.003, y + oy, z + sz * 0.006 + ox); bs.setMatrixAt(d++, _m4);
      }
    }
    const gGroup = new THREE.Group();
    gGroup.add(pf, ps, bf, bs);
    group.add(gGroup);
    groups.corners = gGroup;
  }

  // ---- 每层：左右侧梁 + 前后托底横梁 + 三节钢珠滑轨 ----
  const railYs = [];
  for (let t = 0; t < tiers; t++) railYs.push(railYOf(t));
  const yBaseOf = (t) => railYs[t] + railTopOffset;   // 箱底
  const SLIDE_H = 0.035;
  const rails = instanced(railGeo, matAlu, tiers * 2);
  let ri = 0;
  for (let t = 0; t < tiers; t++) {
    const ySide = yBaseOf(t) + SLIDE_H / 2;            // 侧梁与滑轨同高（滑轨锁在侧梁内侧槽）
    for (const sx of [-1, 1]) {
      _m4.identity().setPosition(sx * railX, ySide, 0);
      rails.setMatrixAt(ri++, _m4);
    }
    stats.profileLengthM += 2 * railLen;
  }
  group.add(rails);
  groups.rails = rails;

  const tierBeamGeo = extrudeAlongX(makeTSlotShape(BEAM, BEAM), frameLenX);
  const tierBeams = instanced(tierBeamGeo, matAlu, tiers * 2);
  let ti = 0;
  for (let t = 0; t < tiers; t++) {
    const yb = yBaseOf(t) - BEAM / 2 - 0.002;         // 托底横梁顶面低于箱底 2mm
    for (const sz of [1, -1]) {
      _m4.identity().setPosition(0, yb, sz * (pz - POST_T / 2 - BEAM / 2));
      tierBeams.setMatrixAt(ti++, _m4);
    }
    stats.profileLengthM += 2 * frameLenX;
  }
  group.add(tierBeams);
  groups.tierBeams = tierBeams;

  // ---- 底盘（轮/脚）：先建，外轮廓（规格尺寸）以「框架 + 底盘」为准，抽出的箱体不计入 ----
  const legPts = postXs.flatMap((x) => postZs.map((z) => ({ x, z, yaw: outwardYaw(x, z, 'diag') })));
  let wheelParts = 0;
  if (casters) {
    const wheels = buildCasters(legPts, { H: CASTER_H, wheelD: 0.05, wheelW: 0.02, trail: 0.018, mount: 'plate', plate: 0.046, brake: true, hood: true, palette: 'white' });
    group.add(wheels);
    groups.wheels = wheels;
  } else {
    const feet = buildLevelFeet(legPts, { H: CASTER_H, palette: 'chrome' });
    group.add(feet);
    groups.feet = feet;
  }
  wheelParts = 4;
  const frameEnvelope = computeEnvelope(group);

  // 滑轨：外轨固定（长 = 箱宽），中轨伸出 pull/2，内轨随箱伸出 pull
  const slideLen = crateTopW;
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const slideOuter = new THREE.InstancedMesh(unitBox, matSlide, tiers * 2);
  const slideMid = new THREE.InstancedMesh(unitBox, matSlideIn, tiers * 2);
  const slideInner = new THREE.InstancedMesh(unitBox, matSlide, tiers * 2);
  const slideLock = new THREE.InstancedMesh(unitBox, matBolt, tiers * 2);
  {
    const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
    let si = 0;
    for (let t = 0; t < tiers; t++) {
      const yS = yBaseOf(t) + SLIDE_H / 2;
      const pull = pullOf(t);
      for (const sx of [-1, 1]) {
        _m4.compose(_p.set(sx * (slideFace - 0.0025), yS, 0), _q, _s.set(0.005, SLIDE_H, slideLen));
        slideOuter.setMatrixAt(si, _m4);
        _m4.compose(_p.set(sx * (slideFace - 0.007), yS, pull / 2), _q, _s.set(0.004, SLIDE_H - 0.006, slideLen - 0.01));
        slideMid.setMatrixAt(si, _m4);
        _m4.compose(_p.set(sx * (slideFace - 0.011), yS, pull), _q, _s.set(0.004, SLIDE_H - 0.012, slideLen - 0.02));
        slideInner.setMatrixAt(si, _m4);
        // 内轨前端拨片锁扣（参考图银色小扣件）
        _m4.compose(_p.set(sx * (slideFace - 0.0135), yS, pull + slideLen / 2 - 0.03), _q, _s.set(0.003, 0.014, 0.022));
        slideLock.setMatrixAt(si, _m4);
        si++;
      }
    }
    const sGroup = new THREE.Group();
    sGroup.add(slideOuter, slideMid, slideInner, slideLock);
    group.add(sGroup);
    groups.slides = sGroup;
  }


  // ---- 周转箱（不透明 PP 物流箱：网格筋 + 唇边 + 把手孔 + 印字标签）----
  const bodyMats = {};
  const rimMats = {};
  for (const key of Object.keys(CRATE_COLORS)) {
    bodyMats[key] = new THREE.MeshPhysicalMaterial({
      color: CRATE_COLORS[key].hex, roughness: 0.52, metalness: 0.0,
      clearcoat: 0.18, clearcoatRoughness: 0.5, envMapIntensity: 0.85,
    });
    rimMats[key] = new THREE.MeshPhysicalMaterial({ color: CRATE_COLORS[key].rib, roughness: 0.46, metalness: 0.0, clearcoat: 0.2, clearcoatRoughness: 0.45, envMapIntensity: 0.9 });
  }
  const innerMats = {};
  for (const key of Object.keys(CRATE_COLORS)) {
    const c = new THREE.Color(CRATE_COLORS[key].hex).multiplyScalar(0.62);
    innerMats[key] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.0 });
  }
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.9, metalness: 0.0 });
  const labelMats = {
    dark: new THREE.MeshStandardMaterial({ map: labelTexture(true), transparent: true, roughness: 0.6, metalness: 0, depthWrite: false }),
    light: new THREE.MeshStandardMaterial({ map: labelTexture(false), transparent: true, roughness: 0.6, metalness: 0, depthWrite: false }),
  };
  const isDarkCrate = (key) => key !== 'white' && key !== 'cool';

  const boxBatches = new Map();
  const _bq = new THREE.Quaternion();
  const _be = new THREE.Euler();
  const _bp = new THREE.Vector3();
  const _bs = new THREE.Vector3();
  function pushBox(mat, x, y, z, sx, sy, sz, rx = 0, rz = 0) {
    let b = boxBatches.get(mat);
    if (!b) { b = { mat, mats: [] }; boxBatches.set(mat, b); }
    _be.set(rx, 0, rz);
    _bq.setFromEuler(_be);
    _m4.compose(_bp.set(x, y, z), _bq, _bs.set(sx, sy, sz));
    b.mats.push(_m4.clone());
  }

  const crateGroup = new THREE.Group();
  for (let t = 0; t < tiers; t++) {
    const seq = SCHEME_SEQ[scheme] || SCHEME_SEQ.mix;
    const colorKey = seq[(tiers - 1 - t) % seq.length];   // 自顶层起取色（顶层 = 序列首色，同参考图黑箱在上）
    const yBase = yBaseOf(t);
    const zOff = pullOf(t);
    const crateH = crateHOf(t);
    const body = bodyMats[colorKey], rim = rimMats[colorKey], inner = innerMats[colorKey];

    const wallT = 0.005;
    const draft = Math.min(0.01, crateH * 0.05);
    const L = crateLen, Wd = crateTopW;                 // 上口
    const Lb = L - draft, Wb = Wd - draft;               // 箱底
    const ang = Math.atan2(draft / 2, crateH);
    const lipH = 0.022, lipOut = LIP_OUT;
    const bandH = 0.012;                                 // 横向加强带高

    // 四面侧壁（微拔模）
    for (const sz of [1, -1]) pushBox(body, 0, yBase + crateH / 2, zOff + sz * (Wb / 2 - wallT / 2), Lb, crateH, wallT, -sz * ang, 0);
    for (const sx of [1, -1]) pushBox(body, sx * (Lb / 2 - wallT / 2), yBase + crateH / 2, zOff, wallT, crateH, Wb - wallT * 2, 0, sx * ang);
    // 底板 + 内腔暗面
    pushBox(body, 0, yBase + wallT, zOff, Lb - wallT, wallT * 2, Wb - wallT);
    pushBox(inner, 0, yBase + wallT * 2 + 0.0008, zOff, Lb - wallT * 2, 0.0015, Wb - wallT * 2);
    const inH = crateH - lipH;
    for (const sz of [1, -1]) pushBox(inner, 0, yBase + inH / 2 + 0.006, zOff + sz * (Wb / 2 - wallT - 0.0006), Lb - wallT * 2, inH, 0.001);
    for (const sx of [1, -1]) pushBox(inner, sx * (Lb / 2 - wallT - 0.0006), yBase + inH / 2 + 0.006, zOff, 0.001, inH, Wb - wallT * 2);

    // 外翻唇边（箱口一圈）
    const lipY = yBase + crateH - lipH / 2;
    for (const sz of [1, -1]) pushBox(rim, 0, lipY, zOff + sz * (Wd / 2 + lipOut / 2 - wallT / 2), L + lipOut * 2, lipH, lipOut + wallT);
    for (const sx of [1, -1]) pushBox(rim, sx * (L / 2 + lipOut / 2 - wallT / 2), lipY, zOff, lipOut + wallT, lipH, Wd);

    // 网格加强筋：横向加强带（长/短边）+ 竖筋；长边左侧 40% 留作光滑印字区（参考图）
    const ribP = 0.003;
    const bandYs = [0.012, crateH * 0.36, crateH * 0.66].filter((y) => y < crateH - lipH - 0.02);
    const labelW = L * 0.38;
    const labelX0 = -L / 2 + 0.03, labelX1 = labelX0 + labelW;
    for (const by of bandYs) {
      const yy = yBase + by + bandH / 2;
      const dz = (draft / 2) * (by / crateH);
      for (const sz of [1, -1]) {
        // 长边横带避开标签区
        const segs = by < 0.02 ? [[-L / 2, L / 2]] : [[-L / 2 + 0.008, labelX0 - 0.004], [labelX1 + 0.004, L / 2 - 0.008]];
        for (const [a, b] of segs) {
          if (b - a < 0.01) continue;
          pushBox(rim, (a + b) / 2, yy, zOff + sz * (Wb / 2 + ribP / 2 + dz), b - a, bandH, ribP);
        }
      }
      for (const sx of [1, -1]) pushBox(rim, sx * (Lb / 2 + ribP / 2 + dz), yy, zOff, ribP, bandH, Wb - 0.016);
    }
    const ribTop = crateH - lipH - 0.004;
    const ribH = ribTop - 0.012;
    const ribY = yBase + 0.012 + ribH / 2;
    const nRibX = Math.max(5, Math.round(L / 0.045));
    for (let r = 0; r <= nRibX; r++) {
      const x = -L / 2 + 0.008 + (r / nRibX) * (L - 0.016);
      const inLabel = x > labelX0 - 0.006 && x < labelX1 + 0.006;
      for (const sz of [1, -1]) {
        if (inLabel) continue;
        pushBox(rim, x, ribY, zOff + sz * (Wb / 2 + ribP / 2 + draft / 4), 0.006, ribH, ribP);
      }
    }
    const nRibZ = Math.max(3, Math.round(Wd / 0.045));
    for (let r = 0; r <= nRibZ; r++) {
      const z = -Wb / 2 + 0.008 + (r / nRibZ) * (Wb - 0.016);
      const nearHandle = Math.abs(z) < 0.07 && true;
      for (const sx of [1, -1]) {
        const h = nearHandle ? ribH * 0.55 : ribH;
        pushBox(rim, sx * (Lb / 2 + ribP / 2 + draft / 4), yBase + 0.012 + h / 2, zOff + z, ribP, h, 0.006);
      }
    }
    // 短边把手孔（深色内凹）
    for (const sx of [1, -1]) pushBox(holeMat, sx * (Lb / 2 + 0.0008 + draft / 4), yBase + crateH - lipH - 0.032, zOff, 0.0016, 0.03, Math.min(0.12, Wd * 0.3));
    // 长边印字标签
    const lab = isDarkCrate(colorKey) ? labelMats.dark : labelMats.light;
    const labH = Math.min(crateH * 0.5, labelW * 0.5);
    for (const sz of [1, -1]) pushBox(lab, (labelX0 + labelX1) / 2, yBase + crateH * 0.48, zOff + sz * (Wb / 2 + draft / 4 + 0.0012), labelW, labH, 0.0006);
  }
  for (const { mat, mats } of boxBatches.values()) {
    const mesh = new THREE.InstancedMesh(unitBox, mat, mats.length);
    mats.forEach((mm, k) => mesh.setMatrixAt(k, mm));
    mesh.instanceMatrix.needsUpdate = true;
    crateGroup.add(mesh);
  }
  group.add(crateGroup);
  groups.crates = crateGroup;

  // ---- 统计 ----
  const volAlu = (4 * postLen * POST_W * POST_T
    + frameYs.length * (2 * frameLenX + 2 * frameLenZ) * BEAM * BEAM
    + tiers * 2 * railLen * BEAM * BEAM
    + tiers * 2 * frameLenX * BEAM * BEAM);
  let crateWallArea = 0;
  for (let t = 0; t < tiers; t++) {
    const h = crateHOf(t);
    crateWallArea += 2 * (crateLen + crateTopW) * h + crateLen * crateTopW;
  }
  const slideMass = tiers * 2 * slideLen * 0.45;     // 三节钢珠滑轨约 0.45 kg/m
  stats.weightKg = volAlu * DENSITY_ALU + crateWallArea * 0.004 * 900 + 16 * 0.03 + slideMass + (casters ? 4 * 0.18 : 4 * 0.05);
  stats.partCount = 4 + frameYs.length * 4 + tiers * (2 + 2 + 2 + 1) + 16 + wheelParts;

  // ---- 算料单 ----
  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len, qty });
  };
  addCut('立柱 2040（T-slot）', '2040', +postLen.toFixed(3), 4);
  addCut('框梁 2020（T-slot）', '2020', +frameLenX.toFixed(3), 2 * frameYs.length);
  addCut('框梁 2020（T-slot）', '2020', +frameLenZ.toFixed(3), 2 * frameYs.length);
  addCut('层侧梁 2020（T-slot）', '2020', +railLen.toFixed(3), tiers * 2);
  addCut('托底横梁 2020（T-slot）', '2020', +frameLenX.toFixed(3), tiers * 2);
  stats.cutList.push({ spec: `物流周转箱（${scheme === 'mix' ? '混搭' : CRATE_SCHEMES[scheme].label}）`, section: '件', len: +crateLen.toFixed(2), qty: tiers });
  stats.panes = [];
  stats.hardware = [
    casters ? { name: '万向轮 2 寸 尼龙护罩（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: '三节钢珠滑轨（黑色）', qty: tiers * 2 },
    { name: '角部加强角码板', qty: 16 },
    { name: 'T 型螺栓 + 螺母', qty: 16 * 4 + tiers * 8 },
  ];

  // 支撑点：轮着地点 = 立柱心沿对角外偏拖尾距
  stats.supports = {
    kind: casters ? 'casters' : 'feet',
    points: legPts.map(({ x, z }) => {
      if (!casters) return [x, 0, z];
      const l = Math.hypot(x, z) || 1;
      return [+(x + (x / l) * 0.018).toFixed(4), 0, +(z + (z / l) * 0.018).toFixed(4)];
    }),
  };
  // 规格外轮廓：框架 + 底盘（抽出的箱体不计入「架体尺寸」，取景 bounds 另含抽出量）
  stats.envelope = frameEnvelope;
  const maxPull = Math.max(0, ...Array.from({ length: tiers }, (_, t) => pullOf(t)));
  return {
    group,
    groups,
    stats,
    bounds: { W: frameLenX + 2 * BEAM + 0.10, H: yTop + BEAM + 0.04, D: frameLenZ + 0.18 + maxPull },
    config: cfg,
    crate: { len: crateLen, width: crateTopW, pulls: Array.from({ length: tiers }, (_, t) => pullOf(t)) },
    dispose() {
      group.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      [matAlu, matGusset, matBolt, matSlide, matSlideIn, holeMat].forEach(m => m.dispose());
      Object.values(bodyMats).forEach(m => m.dispose());
      Object.values(rimMats).forEach(m => m.dispose());
      Object.values(innerMats).forEach(m => m.dispose());
      // 标签纹理按深/浅两份全局缓存复用，不随单次 dispose 释放
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
