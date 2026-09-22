// 摆件防打架 / 防穿出（装配后处理）：buildShelf.js、buildGlbFrame.js 的摆件是
// 纯随机落位，既没有层内碰撞检测，进深方向也可能探出背板（从背面看“出去了”）。
// 两条装配路径都产出 groups.props（Group，直接子节点 = 落在某层板上的一个摆件），
// 统一在这里做后处理：先夹紧到层板可用进深/跨宽内，再同层两两解碰，让不出位的隐藏。
import * as THREE from 'three';

// Z 向可用区间：背面通高立柱前缘在 z=-0.17（背板前面 -0.204），正面立柱内缘约 +0.17。
const BACK_LIMIT = -0.16;   // 距背面立柱前缘留 10mm
const FRONT_LIMIT = 0.165;  // 距正面立柱内缘留 5mm
const X_MARGIN = 0.05;      // 距两侧立柱的最小边距
const GAP = 0.012;          // 摆件之间的最小间隙
const MAX_PASSES = 12;      // 单个摆件让位尝试上限

export function declutterProps(product) {
  const props = product?.groups?.props;
  if (!props || !props.isGroup || !props.children.length) return;

  const W = product?.bounds?.W;
  const xMin = Number.isFinite(W) ? -W / 2 + X_MARGIN : -Infinity;
  const xMax = Number.isFinite(W) ? W / 2 - X_MARGIN : Infinity;

  const items = props.children.map(child => ({ child, box: new THREE.Box3() }));
  const measure = it => { it.child.updateWorldMatrix(true, true); it.box.setFromObject(it.child); };

  // 1) 夹紧进深与跨宽：任何摆件的包围盒不得越过背板侧/正面/两侧立柱。
  //    进深超过可用区间的过深件（如斜放的大开本杂志叠）：贴住背板侧，允许小幅前探，
  //    背板穿模是背面视角的直接可见缺陷，前探仍在框架前平面内、视觉可接受。
  const zAvail = FRONT_LIMIT - BACK_LIMIT;
  for (const it of items) {
    measure(it);
    const zSpan = it.box.max.z - it.box.min.z;
    let dz = 0;
    if (it.box.min.z < BACK_LIMIT) dz = BACK_LIMIT - it.box.min.z;
    else if (it.box.max.z > FRONT_LIMIT) dz = zSpan <= zAvail ? FRONT_LIMIT - it.box.max.z : BACK_LIMIT - it.box.min.z;
    if (dz) { it.child.position.z += dz; measure(it); }
    let dx = 0;
    if (it.box.min.x < xMin) dx = xMin - it.box.min.x;
    else if (it.box.max.x > xMax) dx = xMax - it.box.max.x;
    if (dx) { it.child.position.x += dx; measure(it); }
  }

  // 2) 同层解碰：按层板高度分组，后落位的给先落位的让位（沿 X 平移），
  //    让不出位置就整体隐藏，宁可少摆一件也不穿模
  const overlap = (a, b) =>
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.x < b.max.x + GAP && a.max.x > b.min.x - GAP &&
    a.min.z < b.max.z + GAP && a.max.z > b.min.z - GAP;

  const byLevel = new Map();
  for (const it of items) {
    const key = Math.round(it.box.min.y * 200); // 5mm 粒度归为同层
    const list = byLevel.get(key);
    if (list) list.push(it);
    else byLevel.set(key, [it]);
  }

  for (const list of byLevel.values()) {
    const kept = [];
    for (const it of list) {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const hit = kept.find(k => overlap(it.box, k.box));
        if (!hit) break;
        const itCx = (it.box.min.x + it.box.max.x) / 2;
        const hitCx = (hit.box.min.x + hit.box.max.x) / 2;
        const dir = itCx >= hitCx ? 1 : -1;
        const push = dir > 0
          ? (hit.box.max.x + GAP) - it.box.min.x
          : (hit.box.min.x - GAP) - it.box.max.x;
        it.child.position.x += push;
        measure(it);
        // 让位后越出跨宽就贴回边界，下一轮再验证
        if (it.box.max.x > xMax) { it.child.position.x += xMax - it.box.max.x; measure(it); }
        else if (it.box.min.x < xMin) { it.child.position.x += xMin - it.box.min.x; measure(it); }
      }
      if (kept.some(k => overlap(it.box, k.box))) {
        it.child.visible = false; // 放不下：隐藏（不 remove，避免破坏 dispose 的资源清点）
      } else {
        kept.push(it);
      }
    }
  }
}
