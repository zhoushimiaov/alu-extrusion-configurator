// 万向脚轮 / 调平地脚参数化组件（非型材架各产品共用）
//
// 一只脚轮 = 圆角胎面轮胎（Lathe）+ 轮毂/轴套 + 轮叉（U 形两侧板，或双轮中置轮体）
//          + 平面轴承（上下滚道 + 钢珠圈）+ 安装方式（四孔平板 / 螺杆+六角螺母）
//          + 可选刹车踏板 / 防缠绕护罩。
// 局部坐标：转向轴 = Y 轴，地面 y=0；轮心在 (-trail, R, 0)，轮轴沿 Z（拖尾偏距朝 -X）。
// 同材质零件合并成一份几何，再用 InstancedMesh 批量布位：一个调色板 ≈ 4 个 draw call。
// 数据依据：光轴展架双轮杆式脚轮按 assets_src/guangzhou02-parts.json（GLB 逆向）——
//   ⌀50 双轮、轮心 y=0.025、拖尾偏距 23mm、转向轴上接 25×70 端头夹块（底面 y=0.078）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 调色板：tire 胎面 / hub 轮毂 / metal 轮叉与轴承 / brake 踏板
const PALETTES = {
  chrome: { tire: [0x1b1d20, 0.86, 0.02], hub: [0xc4c9ce, 0.32, 0.65], metal: [0xd9dde2, 0.2, 1.0], brake: [0x1e2023, 0.55, 0.05] },
  black:  { tire: [0x161719, 0.88, 0.02], hub: [0x2b2d31, 0.5, 0.2],   metal: [0x2a2d32, 0.38, 0.75], brake: [0x2b2d31, 0.55, 0.05] },
  white:  { tire: [0x7d8288, 0.8, 0.02],  hub: [0xe9ebea, 0.45, 0.0],  metal: [0xeef0ef, 0.42, 0.0], brake: [0x9aa0a6, 0.5, 0.05] },
};

const mkMat = ([hex, rough, metal], extra = {}) => new THREE.MeshStandardMaterial({
  color: hex, roughness: rough, metalness: metal, envMapIntensity: metal > 0.5 ? 1.1 : 0.8, ...extra,
});

function nonIndexed(g) { return g.index ? g.toNonIndexed() : g; }

/** 合并桶：按材质收集已定位的几何 */
function bucketSet() {
  const b = { tire: [], hub: [], metal: [], brake: [] };
  return {
    b,
    push(key, geo, x = 0, y = 0, z = 0) {
      geo.translate(x, y, z);
      b[key].push(nonIndexed(geo));
    },
  };
}

/** 圆角胎面轮胎：Lathe 截面（内径 → 胎肩圆角 → 胎面 → 圆角 → 内径），轴向沿 Z */
function tireGeo(R, w, rIn) {
  const c = Math.min(w * 0.32, R * 0.18);
  const pts = [new THREE.Vector2(rIn, -w / 2), new THREE.Vector2(R - c, -w / 2)];
  for (let i = 1; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - c + c * Math.cos(a), -w / 2 + c + c * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(R, w / 2 - c));
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - c + c * Math.cos(a), w / 2 - c + c * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(rIn, w / 2));
  const g = new THREE.LatheGeometry(pts, 28);
  g.rotateX(Math.PI / 2);
  return g;
}

function cylZ(r, len, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** 轮叉侧板轮廓（XY 平面）：顶边覆盖转向滚道，向下收窄成绕轮轴的圆耳 */
function forkPlateShape(xf, xb, yTop, ax, ay, r2) {
  const s = new THREE.Shape();
  s.moveTo(xf, yTop);
  s.lineTo(xb, yTop);
  s.lineTo(ax - r2, ay);
  s.absarc(ax, ay, r2, Math.PI, Math.PI * 2, false);
  s.lineTo(xf, yTop);
  return s;
}

function extrudeZ(shape, t) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -t / 2);
  return g;
}

/**
 * 单只脚轮几何（按材质分桶）
 * @param o.H       安装面高度（平板顶面 / 端头夹块底面）
 * @param o.wheelD  轮径
 * @param o.wheelW  单轮宽
 * @param o.twin    双轮（中置轮体，轮在两侧）
 * @param o.twinGap 双轮间距（中置轮体厚 + 间隙）
 * @param o.trail   拖尾偏距
 * @param o.mount   'plate' | 'stem'
 * @param o.plate   平板边长
 * @param o.brake   刹车踏板
 * @param o.hood    防缠绕护罩（白色尼龙脚轮）
 */
function casterParts(o) {
  const { H, wheelD, wheelW: w, twin = false, twinGap = 0.012, trail = 0.02, mount = 'plate', plate = 0.05, brake = false, hood = false } = o;
  const R = wheelD / 2;
  const rIn = R * 0.72;
  const k = bucketSet();
  const gap = 0.004;
  const wt = twin ? 2 * w + twinGap : w;                // 轮组总宽
  const swR = Math.max(0.016, Math.min(0.026, R * 0.82)); // 转向滚道半径
  const swivelH = 0.011;
  const topH = mount === 'plate' ? 0.003 : 0.006;       // 平板厚 / 螺母高
  const yTop = H - topH - swivelH;                      // 轮叉顶面
  const ax = -trail, ay = R;
  const r2 = Math.max(0.008, R * 0.36);
  const xf = swR * 0.85;
  const xb = Math.min(-swR * 0.85, ax - r2 * 0.6);

  // ---- 轮胎 + 轮毂 + 轴套 ----
  const wheelZs = twin ? [-(w / 2 + twinGap / 2), w / 2 + twinGap / 2] : [0];
  for (const zc of wheelZs) {
    k.push('tire', tireGeo(R, w, rIn), ax, ay, zc);
    k.push('hub', cylZ(rIn, w * 0.86, 24), ax, ay, zc);
    k.push('metal', cylZ(rIn * 0.36, w + 0.003, 14), ax, ay, zc);
  }
  // 轮轴 + 两端轴盖
  const axleLen = twin ? wt + 0.002 : wt + 2 * (gap + 0.003);
  k.push('metal', cylZ(0.0035, axleLen + 0.004, 10), ax, ay, 0);
  for (const s of [-1, 1]) k.push('metal', cylZ(0.0062, 0.003, 6), ax, ay, s * (axleLen / 2 + 0.0015));

  // ---- 轮叉 ----
  const housingKey = hood ? 'hub' : 'metal';
  if (twin) {
    // 双轮：中置轮体夹在两轮之间（GLB：30×49 轮体 + 20 宽轮叉）
    k.push(housingKey, extrudeZ(forkPlateShape(xf, xb, yTop, ax, ay, r2), Math.max(0.003, twinGap - 0.0015)), 0, 0, 0);
  } else {
    const t = 0.0025;
    for (const s of [-1, 1]) {
      k.push(housingKey, extrudeZ(forkPlateShape(xf, xb, yTop, ax, ay, r2), t), 0, 0, s * (wt / 2 + gap + t / 2));
    }
    const bridge = new THREE.BoxGeometry(xf - xb, 0.003, wt + 2 * gap + 2 * t);
    k.push(housingKey, bridge, (xf + xb) / 2, yTop - 0.0015, 0);
  }
  if (hood) {
    // 防缠绕护罩：包住轮上半圈的尼龙壳
    const hoodG = new THREE.CylinderGeometry(R + 0.005, R + 0.005, wt + 2 * gap + 0.006, 22, 1, true, Math.PI / 2, Math.PI);
    hoodG.rotateX(Math.PI / 2);
    k.push('hub', hoodG, ax, ay, 0);
  }

  // ---- 平面轴承：下滚道 + 钢珠圈 + 上滚道 + 中心铆钉 ----
  k.push('metal', new THREE.CylinderGeometry(swR, swR, 0.004, 24), 0, yTop + 0.002, 0);
  const balls = new THREE.TorusGeometry(swR * 0.8, 0.0022, 6, 22);
  balls.rotateX(Math.PI / 2);
  k.push('metal', balls, 0, yTop + 0.0055, 0);
  k.push('metal', new THREE.CylinderGeometry(swR * 0.93, swR * 0.93, 0.004, 24), 0, yTop + 0.009, 0);
  k.push('metal', new THREE.CylinderGeometry(0.0045, 0.0045, swivelH + 0.004, 10), 0, yTop + swivelH / 2, 0);

  // ---- 安装方式 ----
  if (mount === 'plate') {
    k.push('metal', new THREE.BoxGeometry(plate, 0.003, plate), 0, H - 0.0015, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.push('metal', new THREE.CylinderGeometry(0.0042, 0.0042, 0.003, 6), sx * plate * 0.34, H - 0.0045, sz * plate * 0.34);
    }
  } else {
    // 螺杆：插入端头夹块（上段隐藏在夹块内）+ 六角锁紧螺母
    k.push('metal', new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 6), 0, H - 0.003, 0);
    k.push('metal', new THREE.CylinderGeometry(0.006, 0.006, 0.03, 10), 0, H + 0.012, 0);
  }

  // ---- 刹车踏板：从轮叉后沿伸出越过胎面 ----
  if (brake) {
    const x0 = xb + 0.004, x1 = ax - R - 0.014;
    const y0 = yTop - 0.002, y1 = yTop - 0.012;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const lever = new THREE.BoxGeometry(len, 0.004, wt + 2 * gap + 0.004);
    lever.rotateZ(Math.atan2(y1 - y0, x1 - x0) + Math.PI);
    k.push('brake', lever, (x0 + x1) / 2, (y0 + y1) / 2, 0);
    const pad = new THREE.BoxGeometry(0.014, 0.008, wt + 2 * gap + 0.016);
    k.push('brake', pad, x1 - 0.004, y1 - 0.001, 0);
  }

  const merged = {};
  for (const [key, list] of Object.entries(k.b)) {
    if (!list.length) continue;
    merged[key] = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
  }
  return merged;
}

/** 调平地脚：橡胶垫 + 镀铬底座 + 螺杆 + 六角螺母，顶端到 H */
function footParts(H) {
  const k = bucketSet();
  k.push('tire', new THREE.CylinderGeometry(0.021, 0.022, 0.005, 24), 0, 0.0025, 0);
  k.push('metal', new THREE.CylinderGeometry(0.0155, 0.02, 0.009, 24), 0, 0.0095, 0);
  const stemLen = Math.max(0.006, H - 0.014);
  k.push('metal', new THREE.CylinderGeometry(0.005, 0.005, stemLen, 10), 0, 0.014 + stemLen / 2, 0); // 螺杆顶 = 安装面 H
  const nutY = Math.min(H - 0.004, 0.014 + Math.max(0.004, stemLen * 0.55));
  k.push('metal', new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 6), 0, nutY, 0);
  const merged = {};
  for (const [key, list] of Object.entries(k.b)) {
    if (!list.length) continue;
    merged[key] = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
  }
  return merged;
}

function emit(parts, points, palette, name) {
  const pal = PALETTES[palette] || PALETTES.chrome;
  const group = new THREE.Group();
  group.name = name;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  for (const [key, geo] of Object.entries(parts)) {
    const extra = key === 'hub' && palette === 'white' ? { side: THREE.DoubleSide } : {};
    const mesh = new THREE.InstancedMesh(geo, mkMat(pal[key], extra), points.length);
    mesh.name = `${name}-${key}`;
    points.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw || 0);
      m4.compose(pos.set(p.x, p.y || 0, p.z), q, one);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  return group;
}

/**
 * 批量脚轮
 * @param points [{x, z, yaw?, y?}]  yaw：拖尾方向（0 = 轮在转向轴 -X 侧）
 * @param opts   见 casterParts + palette
 * @returns THREE.Group（每材质一个 InstancedMesh）
 */
export function buildCasters(points, opts) {
  return emit(casterParts(opts), points, opts.palette || 'chrome', 'casters');
}

/** 批量调平地脚（顶端到 H） */
export function buildLevelFeet(points, { H = 0.03, palette = 'chrome' } = {}) {
  return emit(footParts(H), points, palette, 'feet');
}

/** 拖尾朝外：返回让轮心落在转向轴外侧（远离产品中心）的 yaw。
 *  Ry(a) 把局部轮心 (-t,0,0) 转到 (-t·cos a, 0, t·sin a)，令其与外向 (x,z) 同向即 a = atan2(z, -x)。
 *  axis='x' / 'z' 只沿单轴朝外（轮子沿该轴滚动方向排布），'diag' 沿对角朝外。 */
export function outwardYaw(x, z, axis = 'x') {
  if (axis === 'x') return Math.atan2(0, x < 0 ? 1 : -1);
  if (axis === 'z') return Math.atan2(z < 0 ? -1 : 1, 0);
  return Math.atan2(z, -x);
}
