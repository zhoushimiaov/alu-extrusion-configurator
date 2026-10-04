// 精确型材截面（非型材架产品共用）。profiles.js 为型材架原封文件，此处只读复用其 GLB 实测截面。
//
// 2020：直接采用 makeGlbStripShape()——alu-frame.glb mesh 7 端盖三角形逆向的 44 点外轮廓 + 方孔。
// 2040：GLB 内没有 2040 实测件，按同一实测槽口模板逐面生成（模板由 2020 实测点反推，
//       test/profiles-exact.test.mjs 断言模板重建的 2020 与 GLB 44 点逐点一致，保证同源同精度）：
//         槽口开口 5.142mm、唇厚 1.0mm、内腔宽 12.53mm、槽底 5.72mm 斜收至芯部，
//         角部实心块 + 斜向腹板，芯部 5.14mm 方孔；两单元交接处为封闭中腔（真实 2040 的中间腔）。
import * as THREE from 'three';
import { makeGlbStripShape } from './profiles.js';

// 实测槽口模板（面内坐标：u 沿面方向、自面中点起；v 自外表面向内）
const A = 0.002571;   // 槽口半开口
const T = 0.001;      // 唇厚
const B = 0.006264;   // 内腔半宽（含倒扣）
const C = 0.003031;   // 内腔直壁深
const DD = 0.002861;  // 槽底半宽
const E = 0.006431;   // 槽全深（至芯部）
const HALF = 0.010002; // 实测半宽（20.004mm 截面的一半；高向为 0.010000）

/** 一个槽口的面内点序（自开口一侧绕到另一侧） */
function slotPoints() {
  return [[-A, 0], [-A, T], [-B, T], [-B, C], [-DD, E], [DD, E], [B, C], [B, T], [A, T], [A, 0]];
}

/**
 * 按槽口模板生成矩形型材外轮廓。
 * @param hw, hh  半宽 / 半高
 * @param slotsX  底/顶面槽口中心 x 列表；slotsY 左/右面槽口中心 y 列表
 * 走向与 GLB 实测轮廓一致：右下角 → 底面（向 -x）→ 左面（向 +y）→ 顶面（向 +x）→ 右面（向 -y）
 */
function outline(hw, hh, slotsX, slotsY) {
  const pts = [];
  const face = (corner, dir, inward, centers) => {
    pts.push(corner);
    // 槽口沿行进方向排序
    const ordered = [...centers].sort((a, b) => (dir[0] + dir[1]) * (a - b));
    for (const c of ordered) {
      for (const [u, v] of slotPoints()) {
        // 面上点 = 面中线基点 + 行进方向 * (c' + u) + 内法向 * v；c' 为槽心沿行进方向的坐标
        const base = dir[0] !== 0 ? [c, corner[1]] : [corner[0], c];
        pts.push([base[0] + dir[0] * u + inward[0] * v, base[1] + dir[1] * u + inward[1] * v]);
      }
    }
  };
  face([hw, -hh], [-1, 0], [0, 1], slotsX);    // 底面
  face([-hw, -hh], [0, 1], [1, 0], slotsY);    // 左面
  face([-hw, hh], [1, 0], [0, -1], slotsX);    // 顶面
  face([hw, hh], [0, -1], [-1, 0], slotsY);    // 右面
  return pts;
}

/** 由模板生成的 2020 轮廓点（仅供测试与 GLB 实测比对） */
export function templateOutline2020() {
  return outline(HALF, 0.01, [0], [0]);
}

/** 精确 2020 截面（GLB 实测） */
export function makeExact2020Shape() {
  return makeGlbStripShape();
}

/** 精确 2040 截面：X 向 40（两单元）× Y 向 20，宽面各 2 槽、窄面各 1 槽，双方孔 + 中腔 */
export function makeExact2040Shape() {
  const hw = 2 * HALF, hh = 0.01;
  const s = new THREE.Shape();
  outline(hw, hh, [-HALF, HALF], [0]).forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  // 两个单元芯部方孔
  for (const cx of [-HALF, HALF]) {
    const h = new THREE.Path();
    [[-A, -A], [-A, A], [A, A], [A, -A]].forEach(([x, y], i) => (i ? h.lineTo(cx + x, y) : h.moveTo(cx + x, y)));
    h.closePath();
    s.holes.push(h);
  }
  // 中腔：两单元相对的两个槽口内腔经 2mm 腹板间的开口连通成一个封闭腔
  //   L(u,v) = (-v, u)（左单元右侧槽，内法向 -x），R(u,v) = (v, u)（右单元左侧槽）
  const L = (u, v) => [-v, u], R = (u, v) => [v, u];
  const ring = [
    L(A, T), L(B, T), L(B, C), L(DD, E), L(-DD, E), L(-B, C), L(-B, T), L(-A, T),
    R(-A, T), R(-B, T), R(-B, C), R(-DD, E), R(DD, E), R(B, C), R(B, T), R(A, T),
  ];
  const mid = new THREE.Path();
  ring.forEach(([x, y], i) => (i ? mid.lineTo(x, y) : mid.moveTo(x, y)));
  mid.closePath();
  s.holes.push(mid);
  return s;
}

/**
 * 型材材质对 [端面, 侧面]：与型材架（buildGlbFrame）同一做法——ExtrudeGeometry 组 0 为端盖、组 1 为侧面；
 * 端面为锯切面（略亮、更粗糙、金属度低），T 槽截面在型材端头清晰可读。返回新克隆，调用方负责释放。
 */
export function profileMaterialPair(sideMat) {
  const side = sideMat.clone();
  const cap = sideMat.clone();
  cap.color = side.color.clone().multiplyScalar(1.08);
  cap.metalness = Math.max(0.25, (side.metalness ?? 0.8) - 0.15);
  cap.roughness = Math.min(0.8, (side.roughness ?? 0.35) + 0.3);
  cap.roughnessMap = null;
  return [cap, side];
}

/** 截面工厂：按名义规格返回精确截面 */
export function makeExactProfileShape(spec) {
  return spec === '2040' ? makeExact2040Shape() : makeExact2020Shape();
}
