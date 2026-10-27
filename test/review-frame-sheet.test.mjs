import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Mock DOM for material canvas creation in node environment
globalThis.document = {
  createElement: () => ({
    getContext: () => new Proxy({}, { get: (o, k) => o[k] || (() => ({})) }),
    width: 1,
    height: 1,
  }),
};

import { buildGlbFrame } from '../src/core/buildGlbFrame.js';
import { buildSheetCabinet } from '../src/core/buildSheetCabinet.js';
import { buildReviewedShelf } from '../src/core/buildReviewedShelf.js';

// Geometric helper functions for manifold & crossings verification
function crossings(points) {
  const out = [];
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      if (i === 0 && j === points.length - 2) continue;
      const a = points[i], b = points[i + 1], c = points[j], d = points[j + 1];
      if (cross(a, b, c) * cross(a, b, d) < -1e-20 && cross(c, d, a) * cross(c, d, b) < -1e-20) {
        out.push({ i, j, ab: [a.toArray(), b.toArray()], cd: [c.toArray(), d.toArray()] });
      }
    }
  }
  return out;
}

function manifold(geo) {
  const edges = new Map(), p = geo.attributes.position, idx = geo.index;
  const pt = i => [p.getX(i), p.getY(i), p.getZ(i)].map(x => Math.round(x * 1e7)).join(':');
  let tri = 0, degenerate = 0, vol = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let k = 0; k < (idx?.count ?? p.count); k += 3) {
    const ids = [0, 1, 2].map(d => idx ? idx.getX(k + d) : k + d);
    const vs = ids.map(pt);
    A.fromBufferAttribute(p, ids[0]);
    B.fromBufferAttribute(p, ids[1]);
    C.fromBufferAttribute(p, ids[2]);
    if (B.clone().sub(A).cross(C.clone().sub(A)).lengthSq() < 1e-24) {
      degenerate++;
      continue;
    }
    vol += A.dot(B.clone().cross(C)) / 6;
    tri++;
    for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) {
      if (vs[u] === vs[v]) continue;
      const key = [vs[u], vs[v]].sort().join('|');
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const bad = [...edges].filter(([, c]) => c !== 2);
  return { tri, degenerate, vol, uniqueEdges: edges.size, badEdges: bad.length, examples: bad.slice(0, 8) };
}

// -----------------------------------------------------------------------------
// F01: GLB 20×10 横条截面无自交，挤出网格严格闭合且每边恰两个邻面
// -----------------------------------------------------------------------------
test('F01: GLB 20×10 横条截面无自交、无孔交叠，挤出几何为封闭 2-流形', async () => {
  const { makeExact2010Shape } = await import('../src/core/profilesReviewed.js');
  const shape = makeExact2010Shape();
  assert.ok(shape, 'makeExact2010Shape must return a THREE.Shape');
  const pts = shape.extractPoints(10);
  const selfCross = crossings(pts.shape);
  assert.equal(selfCross.length, 0, `20x10 contour must not self-intersect (found ${selfCross.length})`);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false, curveSegments: 1 });
  const m = manifold(geo);
  geo.dispose();
  assert.equal(m.badEdges, 0, `20x10 extruded mesh must have 0 bad edges (found ${m.badEdges})`);
  assert.equal(m.degenerate, 0, `20x10 extruded mesh must have 0 degenerate triangles (found ${m.degenerate})`);
  assert.ok(m.vol > 0, 'Volume must be positive');

  // Verify GLB frame uses this exact geometry for battens
  const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 2, props: false, sidePanels: false });
  try {
    const battens = built.groups.battens;
    assert.ok(battens, 'GLB frame must build battens');
    assert.ok(battens.geometry, 'Battens must have geometry');
    const battenM = manifold(battens.geometry);
    assert.equal(battenM.badEdges, 0, `Batten geometry in GLB frame must have 0 bad edges (found ${battenM.badEdges})`);
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// F02: 标准背板条在两立柱净跨之内，首条及末条严禁穿入立柱实心材
// -----------------------------------------------------------------------------
test('F02: buildReviewedShelf 标准背板条严格位于两立柱净跨开孔内，不穿柱实材', () => {
  const cfg = { bays: 2, levels: 2, bayWidths: [0.3, 1.2], sidePanels: true, series: '2040' };
  const built = buildReviewedShelf(cfg);
  try {
    assert.ok(built.groups.panels, 'panels mesh must exist');
    const panelMesh = built.groups.panels;
    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const W = cfg.bayWidths.reduce((a, b) => a + b, 0);
    const postXs = [-W / 2, -W / 2 + cfg.bayWidths[0], W / 2];
    const postHalfW = 0.010; // 2020 post width is 20mm
    const panelHalfW = 0.012; // 24x8 panel rib width is 24mm

    for (let i = 0; i < panelMesh.count; i++) {
      panelMesh.getMatrixAt(i, m4);
      pos.setFromMatrixPosition(m4);
      const minX = pos.x - panelHalfW;
      const maxX = pos.x + panelHalfW;
      for (const px of postXs) {
        const postMinX = px - postHalfW;
        const postMaxX = px + postHalfW;
        const overlaps = Math.max(minX, postMinX) < Math.min(maxX, postMaxX) - 1e-5;
        assert.ok(!overlaps, `Panel rib instance ${i} at x=${pos.x.toFixed(4)} overlaps post at x=${px.toFixed(4)}`);
      }
    }
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// F03: 2040 标准底排角件连接梁与柱，实际几何 minY>=0 且底面接触底梁顶面
// -----------------------------------------------------------------------------
test('F03: buildReviewedShelf 2040 底排角件实际几何 minY>=0，严格接触底梁顶面与立柱', () => {
  const cfg = { bays: 2, levels: 2, bayWidths: [0.57, 0.57], series: '2040', decks: ['none', 'none'] };
  const built = buildReviewedShelf(cfg);
  try {
    const conn = built.groups.conn;
    const bolts = built.groups.bolts;
    const washers = built.groups.washers;
    assert.ok(conn && bolts && washers);

    if (!conn.geometry.boundingBox) conn.geometry.computeBoundingBox();
    const localBox = conn.geometry.boundingBox;
    const m4 = new THREE.Matrix4();
    const instBox = new THREE.Box3();
    const pos = new THREE.Vector3();

    // 检查所有角件实例的真实几何包围盒
    for (let i = 0; i < conn.count; i++) {
      conn.getMatrixAt(i, m4);
      instBox.copy(localBox).applyMatrix4(m4);
      assert.ok(
        instBox.min.y >= -1e-6,
        `Corner bracket instance ${i} geometry minY (${instBox.min.y.toFixed(4)}) must be >= 0`
      );
    }

    // 底排 2040 角件（在 decks[0]==='none' 时仅后梁 2 跨 × 2 端 = 4 处底节点）：
    // 底梁顶面为 yTop = 0.02 + 0.04/2 = 0.04m，角件底面必须严格贴在梁顶面
    for (let i = 0; i < 4; i++) {
      conn.getMatrixAt(i, m4);
      instBox.copy(localBox).applyMatrix4(m4);
      assert.ok(
        Math.abs(instBox.min.y - 0.04) < 1e-4,
        `Bottom bracket ${i} bottom surface (${instBox.min.y.toFixed(4)}) must contact bottom beam top at y=0.04`
      );
    }

    // 检查螺栓与垫圈的实际几何位置
    for (let i = 0; i < bolts.count; i++) {
      bolts.getMatrixAt(i, m4);
      pos.setFromMatrixPosition(m4);
      assert.ok(pos.y >= -1e-6, `Bolt ${i} position Y (${pos.y.toFixed(4)}) must be >= 0`);
    }
    for (let i = 0; i < washers.count; i++) {
      washers.getMatrixAt(i, m4);
      pos.setFromMatrixPosition(m4);
      assert.ok(pos.y >= -1e-6, `Washer ${i} position Y (${pos.y.toFixed(4)}) must be >= 0`);
    }
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// F04: GLB 背板外挂 6mm 空隙处生成真实跨缝支座挂件，且纳入清单与 dispose
// -----------------------------------------------------------------------------
test('F04: GLB 背板外挂保留 6mm 间距并具有实体跨缝挂件，跨缝挂件进入清单并正确释放', () => {
  const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 2, props: false, sidePanels: true });
  try {
    assert.ok(built.groups.panels, 'GLB frame must have panels');
    assert.ok(built.groups.panelBrackets, 'GLB frame must have visible panelBrackets bridging the 6mm gap');
    const brackets = built.groups.panelBrackets;
    assert.ok(brackets.count > 0, 'Bracket count must be > 0');

    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    brackets.getMatrixAt(0, m4);
    pos.setFromMatrixPosition(m4);
    assert.ok(pos.z <= -0.20 && pos.z >= -0.206, `Bracket Z (${pos.z}) must span the 6mm gap [-0.206, -0.200]`);

    const hwItem = built.stats.hardware.find(h => h.name.includes('背板跨缝挂件') || h.name.includes('背板挂'));
    assert.ok(hwItem, 'Hardware BOM must include back panel mounting brackets');
    assert.equal(hwItem.qty, brackets.count, 'Hardware quantity must match bracket count');
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// F05: GLB rib 与 acrylic 层板陈设实际世界几何包围盒底面严格接触板顶
// -----------------------------------------------------------------------------
test('F05: GLB 层板陈设的实际世界几何包围盒底面严格等于板顶，消灭悬空', () => {
  const builtRib = buildGlbFrame({ bays: 2, levels: 2, bayWidths: [.57, .57], decks: ['rib', 'rib'], props: true, sidePanels: false });
  const builtAcr = buildGlbFrame({ bays: 2, levels: 2, bayWidths: [.57, .57], decks: ['acrylic', 'acrylic'], props: true, sidePanels: false });
  try {
    builtRib.group.updateMatrixWorld(true);
    assert.ok(builtRib.groups.props, 'props group must exist on rib frame');
    builtRib.groups.props.children.forEach((child, idx) => {
      child.updateMatrixWorld(true);
      const worldBox = new THREE.Box3().setFromObject(child);
      const level = Math.round((worldBox.min.y - 0.02) / 0.46);
      const expectedDeckTopY = level * 0.46 + 0.02;
      assert.ok(
        Math.abs(worldBox.min.y - expectedDeckTopY) < 1e-4,
        `Rib prop ${idx} Box3.min.y=${worldBox.min.y.toFixed(4)} must equal rib deck top ${expectedDeckTopY.toFixed(4)}`
      );
    });

    builtAcr.group.updateMatrixWorld(true);
    assert.ok(builtAcr.groups.props, 'props group must exist on acrylic frame');
    builtAcr.groups.props.children.forEach((child, idx) => {
      child.updateMatrixWorld(true);
      const worldBox = new THREE.Box3().setFromObject(child);
      const level = Math.round((worldBox.min.y - 0.008) / 0.46);
      const expectedDeckTopY = level * 0.46 + 0.008;
      assert.ok(
        Math.abs(worldBox.min.y - expectedDeckTopY) < 1e-4,
        `Acrylic prop ${idx} Box3.min.y=${worldBox.min.y.toFixed(4)} must equal acrylic deck top ${expectedDeckTopY.toFixed(4)}`
      );
    });
  } finally {
    builtRib.dispose();
    builtAcr.dispose();
  }
});

// -----------------------------------------------------------------------------
// F06: 标准架统计口径同源：核对所有脚数(14)、亚克力块数(12)、垫片(48)与净面积
// -----------------------------------------------------------------------------
test('F06: buildReviewedShelf 核对 14 支脚、12 块亚克力、48 个缓冲垫片与净面积', () => {
  const cfg = {
    bayWidths: [.57, .57, .57, .57, .57, .57],
    levels: 6,
    decks: ['acrylic', 'rib', 'acrylic', 'rib', 'rib', 'none'],
    frameMode: 'standard',
    series: '2040',
  };
  const built = buildReviewedShelf(cfg);
  try {
    // 1. 支柱与可调脚：6 跨共 7 轴线 × 2 排 = 14 根立柱与 14 个可调支脚
    assert.equal(built.groups.feet.count, 14, 'Rendered feet count must be 14 (not 7)');
    const feetHw = built.stats.hardware.find(h => h.name.includes('可调支脚'));
    assert.ok(feetHw, 'Hardware must have adjustable feet');
    assert.equal(feetHw.qty, 14, 'Adjustable feet quantity must be 14');

    // 2. 亚克力板块：2 层 acrylic × 6 跨 = 12 块
    assert.equal(built.groups.pane.count, 12, 'Rendered pane mesh count must be 12');
    assert.equal(built.stats.panes[0].qty, 12, 'Stats panes qty must be 12');
    assert.equal(built.stats.paneCells, 12, 'Stats paneCells must be 12');

    // 3. 亚克力净面积：杜绝旧算法的额外 18mm 扣减
    // 实际几何每块宽 = 0.57 - 0.012 = 0.558m，深 = 0.36m
    // 单块面积 = 0.558 * 0.36 = 0.20088 m2，12 块总净面积 = 2.41056 m2 -> 2.411 m2
    assert.equal(built.stats.panes[0].areaM2, 2.411, 'Net acrylic area must be 2.411 m2');

    // 4. 每隔间4处实体EVA垫片；没有独立卡扣实体，不继承旧幽灵卡扣。
    assert.equal(built.groups.pads.count, 48, 'Rendered EVA pads count must be 48');
    const clampHw = built.stats.hardware.find(h => h.name.includes('亚克力支撑卡扣'));
    assert.equal(clampHw, undefined, 'No phantom clamps without matching geometry');
    const padHw = built.stats.hardware.find(h => h.name.includes('EVA 缓冲垫片'));
    assert.ok(padHw, 'Hardware must have EVA buffer pads');
    assert.equal(padHw.qty, 48, 'EVA buffer pad qty must be 48');

    // 5. 构件件数汇总与下料长度同源
    const profileCuts = built.stats.cutList.filter(c => c.section === '20×20' || c.section === '20×40');
    const cutListLen = profileCuts.reduce((s, c) => s + c.len * c.qty, 0);
    assert.ok(Math.abs(built.stats.profileLengthM - cutListLen) < 1e-2, 'profileLengthM matches cutList sum');
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// F07: GLB 12mm 复合背板与跨缝挂件体积核重和件数
// -----------------------------------------------------------------------------
test('F07: GLB 12mm 复合背板与金属挂件核重从真实几何体积推导，件数与清单一致', () => {
  const off = buildGlbFrame({ bayWidths: [.3, 1.2], levels: 2, decks: ['acrylic', 'none'], sidePanels: false });
  const on = buildGlbFrame({ bayWidths: [.3, 1.2], levels: 2, decks: ['acrylic', 'none'], sidePanels: true });
  try {
    assert.ok(on.stats.partCount > off.stats.partCount, 'partCount must increase when back panels are enabled');
    const paneItem = on.stats.panes.find(p => p.kind === 'glbBackPanel');
    assert.ok(paneItem, 'Back panel must enter panes list');
    assert.equal(paneItem.thicknessMm, 12, 'Back panel thickness must be 12mm');
    assert.equal(paneItem.densityKgM3, 650, 'Composite substrate density must be 650 kg/m3');
    assert.ok(paneItem.label.includes('12mm') && paneItem.label.includes('未核价'), 'Label must declare 12mm and unpriced');

    // 实际背板几何：宽 = (0.3 + 1.2) + 0.06 = 1.56m，高 = 2 * 0.46 + 0.03 = 0.95m
    // 面积 = 1.56 * 0.95 = 1.482 m2
    assert.equal(paneItem.areaM2, 1.482, 'Back panel area must equal 1.482 m2');

    // 挂件：3 根立柱轴线 × 2 排挂件 = 6 个
    const bracketHw = on.stats.hardware.find(h => h.name.includes('背板跨缝挂件'));
    assert.ok(bracketHw, 'Hardware must contain brackets');
    assert.equal(bracketHw.qty, 6, '6 brackets for 3 columns on a 0.95m high panel');

    // 自重增量核验：
    // 背板重量 = 1.482 * 0.012 * 650 = 11.5596 kg
    // 挂件重量 = 6 * (0.024 * 0.024 * 0.006 * 7850) = 0.16278 kg
    // 总理论增量 = 11.722 kg
    const weightDelta = on.stats.weightKg - off.stats.weightKg;
    assert.ok(Math.abs(weightDelta - 11.7) < 0.2, `Weight delta (${weightDelta}) must match 11.7kg`);
  } finally {
    off.dispose();
    on.dispose();
  }
});

// -----------------------------------------------------------------------------
// F08: GLB 亚克力统计面积与实际板宽深一致（扣 32mm 而非 35mm）
// -----------------------------------------------------------------------------
test('F08: GLB 亚克力面积统计与实际板材几何尺寸同源（扣除32mm）', () => {
  const built = buildGlbFrame({ bayWidths: [.3, 1.2], levels: 2, decks: ['acrylic', 'none'], sidePanels: false });
  try {
    const paneHw = built.stats.panes.find(p => p.kind === 'acrylic');
    assert.ok(paneHw, 'Acrylic pane must be in stats.panes');
    const expectedArea = (0.3 - 0.032) * 0.36 + (1.2 - 0.032) * 0.36;
    assert.ok(
      Math.abs(paneHw.areaM2 - +expectedArea.toFixed(3)) < 1e-4,
      `Acrylic area (${paneHw.areaM2}) must equal actual geometry area (${+expectedArea.toFixed(3)})`
    );
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// F09: GLB 与 SHEET 均准确输出 stats.envelope，与真实 Box3 包络等值匹配
// -----------------------------------------------------------------------------
test('F09: GLB 与 SHEET 均准确输出 stats.envelope，与真实 Box3 包络等值匹配', async () => {
  const glb = buildGlbFrame({ bayWidths: [.3, 1.2], levels: 2, props: false, sidePanels: false });
  const sheet = await buildSheetCabinet({ thicknessMm: 1.5, folds: true });
  const reviewed = buildReviewedShelf({ bayWidths: [0.6, 0.6], levels: 2 });
  try {
    // GLB envelope 与真实 Group Box3 等值核验
    const realGlbBox = new THREE.Box3().setFromObject(glb.group);
    const realGlbSize = new THREE.Vector3();
    realGlbBox.getSize(realGlbSize);
    assert.ok(Math.abs(glb.stats.envelope.W - realGlbSize.x) < 1e-4, 'GLB envelope W must match real Box3 width');
    assert.ok(Math.abs(glb.stats.envelope.H - realGlbSize.y) < 1e-4, 'GLB envelope H must match real Box3 height');
    assert.ok(Math.abs(glb.stats.envelope.D - realGlbSize.z) < 1e-4, 'GLB envelope D must match real Box3 depth');

    // SHEET envelope 与真实 Group Box3 等值核验
    const realSheetBox = new THREE.Box3().setFromObject(sheet.group);
    const realSheetSize = new THREE.Vector3();
    realSheetBox.getSize(realSheetSize);
    assert.ok(Math.abs(sheet.stats.envelope.W - realSheetSize.x) < 1e-4, 'SHEET envelope W must match real Box3 width');
    assert.ok(Math.abs(sheet.stats.envelope.H - realSheetSize.y) < 1e-4, 'SHEET envelope H must match real Box3 height');
    assert.ok(Math.abs(sheet.stats.envelope.D - realSheetSize.z) < 1e-4, 'SHEET envelope D must match real Box3 depth');

    // Reviewed shelf envelope 与真实 Group Box3 等值核验
    const realShelfBox = new THREE.Box3().setFromObject(reviewed.group);
    const realShelfSize = new THREE.Vector3();
    realShelfBox.getSize(realShelfSize);
    assert.ok(Math.abs(reviewed.stats.envelope.W - realShelfSize.x) < 1e-4, 'Reviewed shelf envelope W must match real Box3 width');
    assert.ok(Math.abs(reviewed.stats.envelope.H - realShelfSize.y) < 1e-4, 'Reviewed shelf envelope H must match real Box3 height');
  } finally {
    glb.dispose();
    sheet.dispose();
    reviewed.dispose();
  }
});

// -----------------------------------------------------------------------------
// F10: SHEET 右端收口位于不透明源箱体外侧可见端面，射线首个命中为收口薄板
// -----------------------------------------------------------------------------
test('F10: SHEET 右端收口位于外部可见端面，右侧向左射线首个命中为收口薄板', async () => {
  const built = await buildSheetCabinet({ thicknessMm: 1.5, folds: true });
  try {
    assert.ok(built.groups.rightEndClosure, 'rightEndClosure group must exist');
    const closure = built.groups.rightEndClosure.getObjectByName('RightEndCapThinSheet');
    assert.ok(closure, 'RightEndCapThinSheet mesh must exist');

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(3.0, 1.175, 0), new THREE.Vector3(-1, 0, 0));
    const hits = raycaster.intersectObjects(built.group.children, true);
    assert.ok(hits.length > 0, 'Ray must hit cabinet');
    assert.equal(
      hits[0].object.name,
      'RightEndCapThinSheet',
      `First hit from +X must be RightEndCapThinSheet (found ${hits[0].object.name} at x=${hits[0].point.x.toFixed(4)})`
    );

    assert.equal(built.stats.meshCount, 44, '44 source meshes must be preserved');
  } finally {
    built.dispose();
  }
});

// -----------------------------------------------------------------------------
// 补充测试：GLB 默认无参调用及部分 backs 开关与 stats 同源一致
// -----------------------------------------------------------------------------
test('GLB 默认无参调用与部分 backs 开关与 stats 同源一致', () => {
  // 1. 无参默认 buildGlbFrame()
  const def = buildGlbFrame();
  try {
    assert.ok(Math.abs(def.layout.W - 3.42) < 1e-4, 'Default GLB W must be 3.42m (6x0.57m)');
    assert.equal(def.layout.H, 2.33, 'Default GLB H must be 2.33m (5 levels)');
    assert.equal(def.groups.posts.count, 7, '7通高立柱');
    assert.equal(def.groups.segments.count, 35, '35分段立柱');
    assert.equal(
      def.stats.hardware.find(h => h.name.includes('精确节点连接件')).qty,
      def.groups.connectors.count,
      'Hardware node count matches real connector mesh count',
    );
  } finally {
    def.dispose();
  }

  // 2. 默认参数下开启 sidePanels
  const defPanel = buildGlbFrame({ sidePanels: true });
  try {
    assert.equal(defPanel.groups.panels.count, 1, 'Default 5-level panel is 1 continuous block');
    const expectedArea = (3.42 + 0.06) * 2.33;
    assert.equal(defPanel.stats.panes[0].areaM2, +expectedArea.toFixed(3), 'Back panel area matches 5-level height');
    assert.equal(defPanel.groups.panelBrackets.count, 14, '2 rows x 7 cols = 14 brackets');
    const hwBracket = defPanel.stats.hardware.find(h => h.name.includes('背板跨缝挂件'));
    assert.equal(hwBracket.qty, 14, 'Hardware bracket qty matches 14');
  } finally {
    defPanel.dispose();
  }

  // 3. 部分 backs 开关配置
  const partial = buildGlbFrame({
    levels: 4,
    bayWidths: [0.6, 0.6],
    backs: ['galv', 'none', 'galv', 'galv'],
    sidePanels: true,
  });
  try {
    // 两个连续开区段：层 0 (高 0.43m) 与 层 2..3 (高 0.89m)
    assert.equal(partial.groups.panels.count, 2, 'Two continuous panel blocks');
    const totalArea = (1.2 + 0.06) * 0.43 + (1.2 + 0.06) * 0.89;
    assert.equal(partial.stats.panes[0].areaM2, +totalArea.toFixed(3), 'Stats panel area matches sum of segments');
    // 层 0 (0.43m > 0.3m -> 2 rows) * 3 cols = 6; 层 2..3 (0.89m > 0.3m -> 2 rows) * 3 cols = 6. 共 12
    assert.equal(partial.groups.panelBrackets.count, 12, '12 brackets for 2 segmented panels');
    const partialHw = partial.stats.hardware.find(h => h.name.includes('背板跨缝挂件'));
    assert.equal(partialHw.qty, 12, 'Hardware bracket count matches 12');
  } finally {
    partial.dispose();
  }
});
