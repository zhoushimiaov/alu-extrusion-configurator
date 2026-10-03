// 光轴挂衣架参数化装配（两种样式）
//
// classic「光轴抽屉柜」：四角 ⌀30 光轴立柱 + 顶框横纵梁 + 顶部置物搁板 + 居中挂衣横杆 + 后框横撑
//   + 结构斜撑 + 底部抽屉柜（0-3 层）+ 2020 矩形底框 + 万向轮/调平地脚
//
// atelier「原木水磨石」：忠实复刻 ref/挂衣架.glb（GLB 实测尺寸，见各段注释）——
//   水磨石底座 1.402×0.06×0.504 + 4 根 ⌀30 原木圆杆（柱距 1.273×0.400，杆长 2.43）
//   + 两道木杆环梁（顶环 @柱顶-0.125，搁板环 @顶环-0.40）+ 十字木套筒
//   + 藤编搁板（木端头，长 1.182 / 编织段 1.022 / 深 0.45）+ V 形托架吊挂中央挂衣杆（@搁板环-0.10）
//   + 底部储物：湖蓝漆面收纳箱（带木嵌板盖）+ 水磨石面长凳（drawers 参数 = 储物模块数）
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import { POST_D, DENSITY_ALU, DENSITY_PLY, DEFAULT_HANGER_CONFIG, HANGER_COLORS, ATELIER_TONES } from '../config/hanger.js';
import { buildCasters, buildLevelFeet, outwardYaw } from './casters.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);

function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, mat.clone(), count) : null;
}

function disposeGroup(group, extraMats = []) {
  group.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => m?.dispose?.());
  });
  extraMats.forEach(m => m.dispose());
  while (group.children.length) group.remove(group.children[0]);
}

export function buildHanger(config) {
  const cfg = { ...DEFAULT_HANGER_CONFIG, ...config };
  return cfg.style === 'atelier' ? buildAtelier(cfg) : buildClassic(cfg);
}

// =====================================================================
// classic：光轴抽屉柜
// =====================================================================
function buildClassic(cfg) {
  const { width, depth, height, drawers, wheels, color } = cfg;

  const colorCfg = HANGER_COLORS[color] || HANGER_COLORS.silver;
  const matAlu = new THREE.MeshPhysicalMaterial({
    color: colorCfg.hex,
    roughness: colorCfg.roughness,
    metalness: colorCfg.metalness,
    envMapIntensity: 0.95,
  });
  const matWood = new THREE.MeshPhysicalMaterial({ color: 0xc8b394, roughness: 0.55, metalness: 0.02, envMapIntensity: 0.6 });
  const matCabinet = new THREE.MeshPhysicalMaterial({ color: 0x8a94a0, roughness: 0.42, metalness: 0.15, envMapIntensity: 0.8 });
  const matTop = new THREE.MeshPhysicalMaterial({ color: 0x6b7280, roughness: 0.35, metalness: 0.2, envMapIntensity: 0.9 });
  const matHandle = new THREE.MeshPhysicalMaterial({ color: 0xd0d5dd, roughness: 0.25, metalness: 0.92, envMapIntensity: 1.0 });

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

  // 底盘：2 寸万向轮安装面 68mm → 2020 底框坐其上 → 立柱立于底框顶面（此前立柱悬在底框上方 3cm）
  const CASTER_H = 0.068;
  const beamH = 0.02;
  const yBottom = CASTER_H + beamH / 2;   // 底框中心
  const yPost0 = CASTER_H + beamH;        // 柱底 = 底框顶面
  const yPostTall = yPost0 + H;
  const yTopRail = yPostTall - POST_D / 2;

  // ---- 基础几何复用 ----
  const rodGeo = new THREE.CylinderGeometry(POST_D / 2, POST_D / 2, 1, 16);
  const clampGeo = new THREE.BoxGeometry(0.038, 0.038, 0.038);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const braceGeo = new THREE.BoxGeometry(0.016, 1, 0.016);
  const handleGeo = new THREE.BoxGeometry(1, 0.012, 0.018);

  // ---- 1. 四角 ⌀30 光轴立柱 ----
  const posts = instanced(rodGeo, matAlu, 4);
  let pi = 0;
  _s.set(1, H, 1);
  for (const x of postXs) for (const z of postZs) {
    _m4.compose(new THREE.Vector3(x, yPost0 + H / 2, z), _q.identity(), _s);
    posts.setMatrixAt(pi++, _m4);
  }
  _s.set(1, 1, 1);
  group.add(posts);
  groups.posts = posts;
  stats.profileLengthM += 4 * H;
  stats.weightKg += 4 * H * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;

  // ---- 2. 顶框横梁与纵梁 ----
  const railLenX = W - POST_D;
  const railLenZ = D - POST_D;
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
  // 居中挂衣主横杆（z=0）
  const yHang = yTopRail - 0.10;
  const hangRail = new THREE.Mesh(rodGeo, matAlu);
  hangRail.rotation.z = Math.PI / 2;
  hangRail.scale.set(1, railLenX, 1);
  hangRail.position.set(0, yHang, 0);
  topRailsGroup.add(hangRail);
  stats.profileLengthM += railLenX;
  stats.weightKg += railLenX * Math.PI * (POST_D / 2) ** 2 * DENSITY_ALU;
  for (const sx of [-1, 1]) {
    const clamp = new THREE.Mesh(clampGeo, matAlu);
    clamp.position.set(sx * px, yHang, 0);
    topRailsGroup.add(clamp);
  }
  group.add(topRailsGroup);
  groups.topRail = topRailsGroup;

  // ---- 3. 顶部置物搁板 ----
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

  // ---- 4. 结构斜撑（左右侧框顶部 45°）----
  const braceArm = 0.16;
  const braceLen = Math.hypot(braceArm, braceArm);
  const braces = instanced(braceGeo, matAlu, 4);
  let bi = 0;
  for (const sx of postXs) {
    for (const sz of [-1, 1]) {
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

  // ---- 5. 底部储物柜与抽屉 ----
  const cabH = 0.46;
  const cabW = W - 2 * POST_D - 0.024;
  const cabD = D - 2 * POST_D - 0.024;
  const cabY = yPost0 + cabH / 2;
  const CAB_T = 0.015;
  const cabGroup = new THREE.Group();
  const cabBottom = new THREE.Mesh(boxGeo, matCabinet);
  cabBottom.scale.set(cabW, CAB_T, cabD);
  cabBottom.position.set(0, yPost0 + CAB_T / 2, 0);
  cabGroup.add(cabBottom);
  for (const sx of [-1, 1]) {
    const cabSide = new THREE.Mesh(boxGeo, matCabinet);
    cabSide.scale.set(CAB_T, cabH, cabD);
    cabSide.position.set(sx * (cabW / 2 - CAB_T / 2), cabY, 0);
    cabGroup.add(cabSide);
  }
  const cabBack = new THREE.Mesh(boxGeo, matCabinet);
  cabBack.scale.set(cabW - 2 * CAB_T, cabH - CAB_T, CAB_T);
  cabBack.position.set(0, yPost0 + CAB_T + (cabH - CAB_T) / 2, -cabD / 2 + CAB_T / 2);
  cabGroup.add(cabBack);
  group.add(cabGroup);
  groups.cabinet = cabGroup;
  stats.weightKg += (cabW * cabD + 2 * cabH * cabD + (cabW - 2 * CAB_T) * (cabH - CAB_T)) * CAB_T * DENSITY_PLY;

  const topPanel = new THREE.Mesh(boxGeo, matTop);
  topPanel.scale.set(cabW + 0.016, 0.02, cabD + 0.016);
  topPanel.position.set(0, yPost0 + cabH + 0.01, 0);
  group.add(topPanel);
  groups.topPanel = topPanel;
  stats.weightKg += (cabW + 0.016) * (cabD + 0.016) * 0.02 * DENSITY_PLY;

  const nDrawers = Math.max(0, Math.min(3, drawers));
  if (nDrawers === 0) {
    const openGroup = new THREE.Group();
    const inW = cabW - 2 * CAB_T - 0.004;
    const inH = cabH - CAB_T;
    const inD = cabD - CAB_T;
    const inY = yPost0 + CAB_T + inH / 2;
    const inZ = CAB_T / 2;
    const hShelf = new THREE.Mesh(boxGeo, matWood);
    hShelf.scale.set(inW, 0.012, inD);
    hShelf.position.set(0, inY, inZ);
    openGroup.add(hShelf);
    const vDivider = new THREE.Mesh(boxGeo, matWood);
    vDivider.scale.set(0.012, inH, inD);
    vDivider.position.set(0, inY, inZ);
    openGroup.add(vDivider);
    group.add(openGroup);
    groups.openBox = openGroup;
    stats.weightKg += (inW * inD + inH * inD) * 0.012 * DENSITY_PLY;
  } else {
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
      const panel = new THREE.Mesh(boxGeo, matCabinet);
      panel.scale.set(drawerW, drawerH, 0.016);
      panel.position.set(0, dy, drawerFrontZ);
      doorsGroup.add(panel);
      const handle = new THREE.Mesh(handleGeo, matHandle);
      handle.scale.set(handleW, 1, 1);
      handle.position.set(0, dy, drawerFrontZ + 0.012);
      doorsGroup.add(handle);
      stats.weightKg += drawerW * drawerH * 0.016 * DENSITY_PLY + handleW * 0.012 * 0.018 * DENSITY_ALU;
    }
    group.add(doorsGroup);
    groups.doors = doorsGroup;
  }

  // ---- 6. 后框中间加强横撑 ----
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

  // ---- 7. 2020 铝型材底框（立柱直接立在底框四角上）----
  const frameLenX = W;
  const frameLenZ = D - POST_D;
  const beamXGeo = new THREE.BoxGeometry(frameLenX, beamH, beamH);
  const beamZGeo = new THREE.BoxGeometry(beamH, beamH, frameLenZ);
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

  // ---- 8. 万向轮 / 调平地脚（平板贴底框四角，轮沿对角外偏）----
  const legPts = postXs.flatMap((x) => postZs.map((z) => ({ x, z, yaw: outwardYaw(x, z, 'diag') })));
  const palette = color === 'black' ? 'black' : 'chrome';
  if (wheels) {
    const w = buildCasters(legPts, { H: CASTER_H, wheelD: 0.045, wheelW: 0.018, trail: 0.016, mount: 'plate', plate: 0.04, brake: true, palette });
    group.add(w);
    groups.wheels = w;
    stats.weightKg += 4 * 0.18;
  } else {
    const f = buildLevelFeet(legPts, { H: CASTER_H, palette });
    group.add(f);
    groups.feet = f;
    stats.weightKg += 4 * 0.05;
  }

  // ---- 9. 统计清单与算料 ----
  stats.partCount += 4 + 2 + 2 + 1 + 1 + 4 + 1 + (nDrawers > 0 ? nDrawers * 2 : 2) + 1 + 4 + 4 + 4;
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
    wheels ? { name: '万向轮 1.75 寸 平板式（带刹车）', qty: 4 } : { name: '调平地脚 M10', qty: 4 },
    { name: 'T 型夹块（挂杆/横撑节点）', qty: 4 },
    { name: '45° 加固斜撑角件', qty: 4 },
    { name: '底框压铸角件', qty: 4 },
    ...(nDrawers > 0 ? [{ name: '铝合金极简横向拉手', qty: nDrawers }] : []),
  ];

  stats.supports = {
    kind: wheels ? 'casters' : 'feet',
    points: legPts.map(({ x, z }) => {
      if (!wheels) return [x, 0, z];
      const l = Math.hypot(x, z) || 1;
      return [+(x + (x / l) * 0.016).toFixed(4), 0, +(z + (z / l) * 0.016).toFixed(4)];
    }),
  };
  stats.envelope = computeEnvelope(group);
  return {
    group,
    groups,
    stats,
    bounds: { W: W + 0.06, H: yPostTall + 0.04, D: D + 0.06 },
    config: cfg,
    dispose: () => disposeGroup(group, [matAlu, matWood, matCabinet, matTop, matHandle]),
  };
}

// =====================================================================
// atelier：原木水磨石（ref/挂衣架.glb 复刻）
// =====================================================================

// 程序化贴图（按需生成并全局缓存，node 测试环境下 canvas 为桩对象也可安全执行）
const texCache = new Map();
function canvasTex(key, w, h, draw, repeat = [1, 1]) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  texCache.set(key, tex);
  return tex;
}
// 伪随机（固定种子：每次生成的水磨石/木纹一致，截图可复现）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function terrazzoTex() {
  return canvasTex('terrazzo', 512, 512, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#e7e6e1';
    g.fillRect(0, 0, w, h);
    const chips = ['#1f2023', '#5e6064', '#8d8f93', '#b9bbbd', '#fbfbf8', '#cfc9bd', '#9a9184'];
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h;
      const s = 0.8 + r() ** 3 * 7;
      g.fillStyle = chips[Math.floor(r() * chips.length)];
      g.beginPath();
      g.ellipse(x, y, s, s * (0.55 + r() * 0.45), r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }, [1, 1]);
}
function ashGrainTex(hex) {
  return canvasTex('ash:' + hex, 64, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#' + hex.toString(16).padStart(6, '0');
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      g.fillStyle = r() < 0.6 ? 'rgba(90,70,50,0.10)' : 'rgba(255,250,240,0.14)';
      g.fillRect(x, 0, 0.8 + r() * 2.2, h);
    }
  }, [1, 3]);
}
function rattanTex() {
  // 藤编（方孔 / 双经双纬篮式编织）：浅藤皮条压在深色缝隙上
  return canvasTex('rattan', 256, 256, (g, w, h) => {
    g.fillStyle = '#4f3a24';
    g.fillRect(0, 0, w, h);
    const cell = 16;
    for (let j = 0; j < h / cell; j++) {
      for (let i = 0; i < w / cell; i++) {
        const x = i * cell, y = j * cell;
        const horiz = (i + j) % 2 === 0;
        for (let k = 0; k < 2; k++) {
          const grad = horiz
            ? g.createLinearGradient?.(x, y + k * 8, x, y + k * 8 + 7)
            : g.createLinearGradient?.(x + k * 8, y, x + k * 8 + 7, y);
          if (grad) {
            grad.addColorStop(0, '#d8c49c');
            grad.addColorStop(0.5, '#f1e4c6');
            grad.addColorStop(1, '#c7af82');
            g.fillStyle = grad;
          } else {
            g.fillStyle = '#e6d6b4';
          }
          if (horiz) g.fillRect(x + 1, y + k * 8 + 1.2, cell - 2, 5.6);
          else g.fillRect(x + k * 8 + 1.2, y + 1, 5.6, cell - 2);
        }
      }
    }
  }, [1, 1]);
}

/** 盒子几何，六个面的 UV 都按真实尺寸 / tile 平铺（BoxGeometry 面序 px nx py ny pz nz，每面 4 顶点） */
function tiledBoxGeo(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const faceDims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fu, fv] = faceDims[f];
    for (let k = f * 4; k < f * 4 + 4; k++) uv.setXY(k, uv.getX(k) * (fu / tile), uv.getY(k) * (fv / tile));
  }
  return g;
}

function buildAtelier(cfg) {
  const { width, depth, height, drawers, wheels, color } = cfg;
  const tone = ATELIER_TONES[color] || ATELIER_TONES.silver;

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  // ---- 材质 ----
  const matPole = new THREE.MeshStandardMaterial({ color: 0xffffff, map: ashGrainTex(tone.hex), roughness: 0.58, metalness: 0.0, envMapIntensity: 0.55 });
  const matSleeve = new THREE.MeshStandardMaterial({ color: 0xffffff, map: ashGrainTex(tone.sleeve), roughness: 0.52, metalness: 0.0, envMapIntensity: 0.55 });
  const matTerrazzo = new THREE.MeshStandardMaterial({ color: 0xffffff, map: terrazzoTex(), roughness: 0.38, metalness: 0.0, envMapIntensity: 0.7 });
  const matTeal = new THREE.MeshPhysicalMaterial({ color: 0x8dbfcb, roughness: 0.42, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.8 });
  const matCream = new THREE.MeshStandardMaterial({ color: 0xebdfcd, roughness: 0.6, metalness: 0.0, envMapIntensity: 0.5 });
  const matRattan = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rattanTex(), roughness: 0.72, metalness: 0.0, envMapIntensity: 0.45 });

  const W = width, D = depth, Hh = height;
  // GLB：底座 1.402×0.504，柱心 ±0.637 / ±0.200 → 柱心距底座边 0.064 / 0.052
  const px = W / 2 - 0.064;
  const pz = D / 2 - 0.052;
  const postXs = [-px, px];
  const postZs = [-pz, pz];
  const R = POST_D / 2;

  // 底座：落地（GLB）或架在低矮隐藏式万向轮上
  const CASTER_H = 0.05;
  const PLINTH_T = 0.06;
  const yPl0 = wheels ? CASTER_H : 0.0;
  const yPlTop = yPl0 + PLINTH_T;
  const postLen = Hh + 0.03;                 // GLB 杆长 2.43（默认 H=2.40）
  const yPost0 = yPlTop - 0.01;              // 杆脚嵌入底座 10mm
  const yPostTop = yPost0 + postLen;
  const yTopRing = yPostTop - 0.125;         // GLB 2.359 / 杆顶 2.484
  const yShelfRing = yTopRing - 0.40;        // GLB 1.959
  const yHang = yShelfRing - 0.10;           // GLB 1.859
  const railLenX = 2 * px + 0.12;            // GLB 1.392：环梁出头 60mm
  const railLenZ = 2 * pz;                   // GLB 0.396

  // ---- 1. 水磨石底座（UV 按真实尺寸平铺：薄侧面不拉丝）----
  const plinth = new THREE.Mesh(tiledBoxGeo(W, PLINTH_T, D, 0.45), matTerrazzo);
  plinth.position.set(0, yPl0 + PLINTH_T / 2, 0);
  group.add(plinth);
  groups.plinth = plinth;

  // ---- 2. 四根原木圆杆 ----
  const poleGeo = new THREE.CylinderGeometry(R, R, 1, 20);
  const poles = instanced(poleGeo, matPole, 4);
  {
    let k = 0;
    for (const x of postXs) for (const z of postZs) {
      _m4.compose(new THREE.Vector3(x, yPost0 + postLen / 2, z), _q.identity(), new THREE.Vector3(1, postLen, 1));
      poles.setMatrixAt(k++, _m4);
    }
  }
  group.add(poles);
  groups.posts = poles;

  // ---- 3. 环梁：顶环（长梁 ×2 + 短梁 ×2）+ 搁板环（长梁 ×2）+ 中央挂衣杆 ----
  const railXGeo = new THREE.CylinderGeometry(R, R, 1, 18); railXGeo.rotateZ(Math.PI / 2);
  const railZGeo = new THREE.CylinderGeometry(R, R, 1, 18); railZGeo.rotateX(Math.PI / 2);
  const longRails = instanced(railXGeo, matPole, 4);
  {
    let k = 0;
    for (const y of [yTopRing, yShelfRing]) for (const z of postZs) {
      _m4.compose(new THREE.Vector3(0, y, z), _q.identity(), new THREE.Vector3(railLenX, 1, 1));
      longRails.setMatrixAt(k++, _m4);
    }
  }
  group.add(longRails);
  groups.topRail = longRails;
  const shortRails = instanced(railZGeo, matPole, 2);
  postXs.forEach((x, k) => {
    _m4.compose(new THREE.Vector3(x, yTopRing - 0.005, 0), _q.identity(), new THREE.Vector3(1, 1, railLenZ));
    shortRails.setMatrixAt(k, _m4);
  });
  group.add(shortRails);
  groups.zRails = shortRails;
  const hangRail = new THREE.Mesh(railXGeo, matPole);
  hangRail.scale.set(railLenX, 1, 1);
  hangRail.position.set(0, yHang, 0);
  group.add(hangRail);
  groups.hangRail = hangRail;

  // ---- 4. 十字木套筒：立杆竖套（⌀34×130）+ 长梁横套（⌀34×80），两道环梁 × 四角 ----
  const sleeveR = 0.017;
  const vSleeveGeo = new THREE.CylinderGeometry(sleeveR, sleeveR, 0.13, 20);
  const hSleeveGeo = new THREE.CylinderGeometry(sleeveR, sleeveR, 0.08, 20); hSleeveGeo.rotateZ(Math.PI / 2);
  const vSleeves = instanced(vSleeveGeo, matSleeve, 8);
  const hSleeves = instanced(hSleeveGeo, matSleeve, 8);
  {
    let a = 0, b = 0;
    for (const y of [yTopRing, yShelfRing]) for (const x of postXs) for (const z of postZs) {
      _m4.identity().setPosition(x, y, z); vSleeves.setMatrixAt(a++, _m4);
      _m4.identity().setPosition(x, y - 0.001, z); hSleeves.setMatrixAt(b++, _m4);
    }
  }
  const sleeveGroup = new THREE.Group();
  sleeveGroup.add(vSleeves, hSleeves);
  group.add(sleeveGroup);
  groups.sleeves = sleeveGroup;

  // ---- 5. V 形托架 ×2（搁板环两侧长梁 → 中央挂衣杆，GLB 位于柱心内侧 0.106）+ 环形管夹 ×3/架 ----
  const bx = px - 0.106;
  const vShape = new THREE.Shape();
  {
    const t = 0.022;                      // 托架臂宽
    vShape.moveTo(-pz - 0.012, 0.012);
    vShape.lineTo(-pz + t * 0.6, 0.012);
    vShape.lineTo(0, -(yShelfRing - yHang) + t);
    vShape.lineTo(pz - t * 0.6, 0.012);
    vShape.lineTo(pz + 0.012, 0.012);
    vShape.lineTo(t * 0.35, -(yShelfRing - yHang) - 0.012);
    vShape.lineTo(-t * 0.35, -(yShelfRing - yHang) - 0.012);
    vShape.lineTo(-pz - 0.012, 0.012);
  }
  const vGeo = new THREE.ExtrudeGeometry(vShape, { depth: 0.018, bevelEnabled: false });
  vGeo.translate(0, 0, -0.009);
  vGeo.rotateY(Math.PI / 2);              // 板面法向 → X，V 形在 YZ 平面内
  const brackets = instanced(vGeo, matCream, 2);
  [-bx, bx].forEach((x, k) => { _m4.identity().setPosition(x, yShelfRing, 0); brackets.setMatrixAt(k, _m4); });
  const ringGeo = new THREE.CylinderGeometry(sleeveR, sleeveR, 0.03, 18); ringGeo.rotateZ(Math.PI / 2);
  const rings = instanced(ringGeo, matCream, 6);
  {
    let k = 0;
    for (const x of [-bx, bx]) {
      for (const z of postZs) { _m4.identity().setPosition(x, yShelfRing, z); rings.setMatrixAt(k++, _m4); }
      _m4.identity().setPosition(x, yHang, 0); rings.setMatrixAt(k++, _m4);
    }
  }
  const brkGroup = new THREE.Group();
  brkGroup.add(brackets, rings);
  group.add(brkGroup);
  groups.brackets = brkGroup;

  // ---- 6. 藤编搁板：坐在搁板环长梁上（GLB 底面 1.974 = 环梁顶），木端头 + 藤编中段 ----
  const shelfL = 2 * px - 0.09;          // GLB 1.182
  const shelfD = D - 0.054;              // GLB 0.45
  const shelfT = 0.03;
  const capL = Math.min(0.08, shelfL * 0.07);
  const wovenL = shelfL - 2 * capL;      // GLB 1.022
  const yShelf = yShelfRing + R + shelfT / 2;
  const shelfGroup = new THREE.Group();
  const capGeo = new THREE.BoxGeometry(capL, shelfT, shelfD);
  const caps = instanced(capGeo, matSleeve, 2);
  [-1, 1].forEach((s, k) => { _m4.identity().setPosition(s * (shelfL / 2 - capL / 2), yShelf, 0); caps.setMatrixAt(k, _m4); });
  shelfGroup.add(caps);
  // 编织段：上下两面藤编 + 侧沿；UV 按 6cm 一个编织周期平铺
  const wovenGeo = new THREE.BoxGeometry(wovenL, shelfT * 0.6, shelfD);
  {
    const uv = wovenGeo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (wovenL / 0.16), uv.getY(k) * (shelfD / 0.16));
  }
  const woven = new THREE.Mesh(wovenGeo, matRattan);
  woven.position.set(0, yShelf, 0);
  shelfGroup.add(woven);
  // 编织段前后木边框（细木条，藤面绷在框内）
  const frameGeo = new THREE.BoxGeometry(wovenL, shelfT, 0.016);
  const frames = instanced(frameGeo, matSleeve, 2);
  [-1, 1].forEach((s, k) => { _m4.identity().setPosition(0, yShelf, s * (shelfD / 2 - 0.008)); frames.setMatrixAt(k, _m4); });
  shelfGroup.add(frames);
  group.add(shelfGroup);
  groups.shelf = shelfGroup;

  // ---- 7. 底部储物模块（drawers 0-3：无 / 长凳 / 长凳+收纳箱(GLB) / 收纳箱+长凳+收纳箱）----
  const nMod = Math.max(0, Math.min(3, drawers));
  const spanX = 2 * (px - 0.037);        // GLB ±0.600
  const modD = Math.min(0.45, D - 0.054);
  const modGroup = new THREE.Group();
  let boxCount = 0, benchCount = 0;
  const boxH = 0.40, lidT = 0.05, benchBaseH = 0.20, benchTopH = 0.25;
  const boxW = nMod === 3 ? Math.min(0.4, spanX * 0.28) : Math.min(0.4, spanX / 3);
  const layout = [];                     // [kind, x0, x1]
  if (nMod === 1) layout.push(['bench', -spanX / 2, spanX / 2]);
  if (nMod === 2) { layout.push(['bench', -spanX / 2, spanX / 2 - boxW]); layout.push(['box', spanX / 2 - boxW, spanX / 2]); }
  if (nMod === 3) { layout.push(['box', -spanX / 2, -spanX / 2 + boxW]); layout.push(['bench', -spanX / 2 + boxW, spanX / 2 - boxW]); layout.push(['box', spanX / 2 - boxW, spanX / 2]); }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const tealParts = [], terrazzoParts = [], creamParts = [];
  for (const [kind, x0, x1] of layout) {
    const w = x1 - x0 - 0.004, cx = (x0 + x1) / 2;
    if (kind === 'box') {
      tealParts.push([cx, yPlTop + boxH / 2, 0, w, boxH, modD]);
      tealParts.push([cx, yPlTop + boxH + 0.002 + lidT / 2, 0, w, lidT, modD]);            // 盖（2mm 缝）
      creamParts.push([cx, yPlTop + boxH + 0.002 + lidT + 0.0015, 0, w - 0.04, 0.003, modD - 0.04]); // 木嵌板
      boxCount++;
    } else {
      tealParts.push([cx, yPlTop + benchBaseH / 2, 0, w, benchBaseH, modD]);
      terrazzoParts.push([cx, yPlTop + benchBaseH + benchTopH / 2, 0, w, benchTopH, modD]);
      benchCount++;
    }
  }
  const emitBoxes = (parts, mat) => {
    if (!parts.length) return;
    const m = new THREE.InstancedMesh(unit, mat.clone(), parts.length);
    parts.forEach(([x, y, z, sx, sy, sz], k) => m.setMatrixAt(k, _m4.compose(new THREE.Vector3(x, y, z), _q.identity(), new THREE.Vector3(sx, sy, sz))));
    modGroup.add(m);
  };
  emitBoxes(tealParts, matTeal);
  emitBoxes(creamParts, matCream);
  // 水磨石凳面：逐块独立网格（每块按自身尺寸平铺 UV，实例缩放会拉伸碎石纹理）
  for (const [x, y, z, sx, sy, sz] of terrazzoParts) {
    const m = new THREE.Mesh(tiledBoxGeo(sx, sy, sz, 0.45), matTerrazzo);
    m.position.set(x, y, z);
    modGroup.add(m);
  }
  group.add(modGroup);
  groups.modules = modGroup;

  // ---- 8. 底座隐藏式万向轮 / 落地 ----
  const footPts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const x = sx * (W / 2 - 0.07), z = sz * (D / 2 - 0.06);
    return { x, z, yaw: outwardYaw(x, z, 'diag') };
  }));
  if (wheels) {
    const w = buildCasters(footPts, { H: CASTER_H, wheelD: 0.036, wheelW: 0.016, trail: 0.012, mount: 'plate', plate: 0.04, brake: false, palette: 'black' });
    group.add(w);
    groups.wheels = w;
  }

  // ---- 9. 统计 ----
  const DENSITY_ASH = 680;               // 白蜡木
  const poleVol = Math.PI * R * R;
  const poleLen = 4 * postLen + 4 * railLenX + 2 * railLenZ + railLenX;
  stats.profileLengthM = poleLen;
  const plyVol = W * D * PLINTH_T * 0.5                       // 水磨石饰面底座（多层板芯，按半实心折算）
    + boxCount * (2 * (boxW * boxH + modD * boxH) + boxW * modD * 2) * 0.015
    + benchCount * (spanX * modD * benchTopH * 0.35)          // 长凳：水磨石饰面 + 空腔骨架折算
    + shelfL * shelfD * shelfT * 0.4;
  stats.weightKg = poleLen * poleVol * DENSITY_ASH + plyVol * DENSITY_PLY + 16 * 0.06 + 2 * 0.15 + (wheels ? 4 * 0.12 : 0);
  stats.partCount = 1 + 4 + 4 + 2 + 1 + 16 + 2 + 6 + 3 + 1 + boxCount * 3 + benchCount * 2 + (wheels ? 4 : 0);

  const addCut = (spec, sec, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: sec, len: +len.toFixed(3), qty });
  };
  addCut(`立杆 ⌀30 ${tone.label}`, '⌀30 木', postLen, 4);
  addCut(`环梁长杆 ⌀30 ${tone.label}`, '⌀30 木', railLenX, 4);
  addCut(`环梁短杆 ⌀30 ${tone.label}`, '⌀30 木', railLenZ, 2);
  addCut(`挂衣杆 ⌀30 ${tone.label}`, '⌀30 木', railLenX, 1);
  stats.cutList.push({ spec: '水磨石饰面底座（60mm）', section: '板', len: +W.toFixed(2), qty: 1 });
  stats.cutList.push({ spec: '藤编搁板（木端头）', section: '板', len: +shelfL.toFixed(2), qty: 1 });
  if (boxCount) stats.cutList.push({ spec: '湖蓝漆面收纳箱（木嵌板盖）', section: '件', len: +boxW.toFixed(2), qty: boxCount });
  const bench = layout.find((l) => l[0] === 'bench');
  if (bench) stats.cutList.push({ spec: '水磨石面长凳', section: '件', len: +(bench[2] - bench[1]).toFixed(2), qty: benchCount });
  stats.panes = [];
  stats.hardware = [
    { name: '十字木套筒（竖套 + 横套）', qty: 16 },
    { name: 'V 形挂杆托架', qty: 2 },
    { name: '环形管夹', qty: 6 },
    wheels ? { name: '隐藏式万向轮 1.5 寸（底座下）', qty: 4 } : { name: '底座防滑脚垫', qty: 4 },
  ];
  stats.supports = {
    kind: wheels ? 'casters' : 'feet',
    points: footPts.map(({ x, z }) => [x, 0, z]),
  };
  stats.envelope = computeEnvelope(group);
  return {
    group,
    groups,
    stats,
    bounds: { W: W + 0.06, H: yPostTop + 0.04, D: D + 0.06 },
    config: cfg,
    // 贴图按键全局缓存复用：不随单次 dispose 释放（材质本身释放）
    dispose: () => disposeGroup(group, [matPole, matSleeve, matTerrazzo, matTeal, matCream, matRattan]),
  };
}
