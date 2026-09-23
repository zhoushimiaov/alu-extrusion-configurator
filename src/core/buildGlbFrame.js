// GLB measured-coordinate prototype. Isolated from production BOM/price.
import * as THREE from 'three';
import {
  makeTSlotShape,
  makeGlbJointShape,
  makeGlbStripShape,
  extrudeUp,
  extrudeAlongZ,
  extrudeAlongX,
} from './profiles.js';
import { COLORS, PANEL_COLORS } from '../config/product.js';
import { getPropMaterials, getAcrylicMaterial } from './materials.js';

// 世界坐标系定义（与标准货架对齐）：
// +Z: 正面/外侧/开放取物侧 (Z = +0.20)
// -Z: 背面/墙面侧/背板侧 (Z = -0.20)
//
// 构件布置规则：
// 1. 通高立柱 posts: 位于背面墙面侧 (z = -0.185)
// 2. 分段立柱 segments: 位于正面外侧 (z = +0.185)
// 3. 进深横梁 depth: 从外侧 z=+0.20 向内延伸到 z=-0.17；截面外露端头精确位于最外侧 z = +0.20
// 4. 层板条 strips: 沿进深排布，覆盖 [ -0.20, +0.20 ]
// 5. 背面板 panels: 仅位于背面墙面侧 (z = -0.206)

const DEPTH_FRONT_Z = 0.20;
const DEPTH_BACK_Z = -0.17;
const WALL_BACK_Z = -0.20;

export function glbLayout({ bayWidths = [.57, .57, .57, .57, .57, .57], levels = 5, decks = null } = {}) {
  if (!Array.isArray(bayWidths) || !bayWidths.length || bayWidths.some(w => !Number.isFinite(w) || w < .3 || w > 1.2) || !Number.isInteger(levels) || levels < 1 || levels > 8) {
    throw Error('Invalid reference dimensions');
  }
  // 逐层层板配置：'rib' 铺板条 / 'acrylic' 改整板（此处不排板条）/ 'none' 空层。
  // 不带 decks 的旧调用保持原行为（全层铺板条，含顶层封面）。
  const decksValid = Array.isArray(decks) && decks.length >= levels;
  const W = bayWidths.reduce((a, b) => a + b, 0);
  const H = levels * .46 + .03;
  const xs = [-W / 2];
  for (const w of bayWidths) xs.push(xs.at(-1) + w);
  const rows = { posts: [], segments: [], depth: [], strips: [], battens: [] };
  for (const x of xs) {
    // 通高立柱在背面墙面侧
    rows.posts.push([x, 0, -0.185]);
    // 分段立柱在正面外侧
    for (let k = 0; k < levels; k++) rows.segments.push([x, k * .46 + .03, 0.185]);
    // 进深梁端头在正面外侧 z = +0.20
    for (let k = 0; k <= levels; k++) rows.depth.push([x, k * .46 + .015, DEPTH_FRONT_Z]);
  }
  for (let k = 0; k <= levels; k++) {
    // 有 decks 时顶层不铺板（与标准参数架一致：顶层只有围梁）；'acrylic'/'none' 层不排板条
    const stripLevel = decksValid ? k < levels && decks[k] === 'rib' : true;
    if (stripLevel) for (let b = 0; b < bayWidths.length; b++) {
      const n = Math.floor((bayWidths[b] - .03) / .02 + 1e-7);
      const start = (xs[b] + xs[b + 1]) / 2 - (n - 1) * .01;
      for (let r = 0; r < n; r++) {
        const x = start + r * .02;
        rows.strips.push([x, k * .46 + .01, WALL_BACK_Z]);
      }
    }
    // 纵向连接支承条
    for (const z of [-.13615, -.11615, -.09615, -.07615, .12439, .14439]) {
      rows.battens.push([0, k * .46 - .005, z]);
    }
  }
  return {
    W,
    H,
    rows,
    ends: {
      backSideZ: WALL_BACK_Z,
      openSideZ: DEPTH_FRONT_Z,
      exposedSectionZ: DEPTH_FRONT_Z,
    },
  };
}

// 背板：逐层分段（backs[k]==='none' 的层留空），每块覆盖该层层高区间
function glbBackPanelRows(config) {
  const levels = config.levels || 1;
  const backs = Array.isArray(config.backs) ? config.backs : null;
  const rows = [];
  for (let k = 0; k < levels; k++) {
    if (backs && backs[k] === 'none') continue;
    // 层区间：底梁顶面 (k*.46+.03) 到上层梁底面 ((k+1)*.46)，高 .43
    rows.push([0, k * .46 + .245, -0.206, .43]);
  }
  return rows;
}

/**
 * 摆件系统：替换为大开本 EL 建筑杂志（单本/叠放/立放）、极简陶土/石膏几何雕塑与极简高瓶
 */
function buildGlbProps(layout, config) {
  const decks = Array.isArray(config.decks) ? config.decks : [];
  const bayWidths = config.bayWidths || [.57];
  const levels = config.levels || 1;
  const xs = [-layout.W / 2];
  for (const w of bayWidths) xs.push(xs.at(-1) + w);

  const root = new THREE.Group();
  root.name = 'props';
  root.userData.displayOnly = true;

  let seed = 42 + bayWidths.length * 7 + levels * 13;
  for (const w of bayWidths) seed = (seed * 31 + Math.round(w * 100)) % 2147483647;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // 艺术品与杂志专属材质
  const mkMat = (hex, rough, metal = 0) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
  const elCoverMats = [
    mkMat(0xf6f5f2, 0.85), // EL 经典纯白画册封面
    mkMat(0x1a1a1b, 0.88), // EL 黑色封面特刊
    mkMat(0x9a958d, 0.80), // 暖灰特刊
  ];
  const elSpineMat = mkMat(0x282a2e, 0.75); // 哑光精装书脊
  const artSculptureMats = [
    mkMat(0xd8d3c7, 0.95), // 粗陶米白石膏质感
    mkMat(0x8a7e72, 0.92), // 陶土暖灰
    mkMat(0x2c2e30, 0.88), // 黑色炭烧陶
    mkMat(0xb09575, 0.40, 0.3), // 极简氧化黄铜小雕塑
  ];
  const vaseMats = [
    mkMat(0xeae7e1, 0.65), // 细瓷哑白高瓶
    mkMat(0x222426, 0.75), // 哑光黑陶
  ];

  const geometriesToDispose = [];

  // EL 杂志单本几何（标准大开本 240mm × 320mm × 28mm）
  const elMagGeo = new THREE.BoxGeometry(0.24, 0.028, 0.32);
  const elMagStandingGeo = new THREE.BoxGeometry(0.028, 0.32, 0.24);
  const cylinderVaseGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 20);
  const tallVaseGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.35, 20);
  const archSculptureGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16, 1, false, 0, Math.PI);
  const blockSculptureGeo = new THREE.BoxGeometry(0.14, 0.22, 0.14);
  const stepSculptureGeo = new THREE.BoxGeometry(0.18, 0.14, 0.18);

  geometriesToDispose.push(
    elMagGeo, elMagStandingGeo, cylinderVaseGeo, tallVaseGeo,
    archSculptureGeo, blockSculptureGeo, stepSculptureGeo
  );

  const kinds = ['elMagStack', 'elMagStanding', 'sculpture', 'tallVase', 'geometricVase'];
  // 摆件落点：型材层板条顶面 .03；磨砂亚克力整板顶面 .038（板厚 8mm 压在梁顶）
  const deckTopY = k => k * .46 + (decks[k] === 'acrylic' ? .038 : .03);

  for (let k = 0; k < levels; k++) {
    if (decks[k] === 'none') continue;
    const count = Math.max(1, Math.round(bayWidths.length / 2));
    for (let n = 0; n < count; n++) {
      const kind = kinds[Math.floor(rand() * kinds.length)];
      const bay = Math.floor(rand() * bayWidths.length);
      const margin = 0.20;
      const x = xs[bay] + margin + rand() * Math.max(0.05, bayWidths[bay] - margin * 2);
      const z = (rand() - 0.5) * 0.18; // 居中于层板进深内
      const yBase = deckTopY(k);

      if (kind === 'elMagStack') {
        // EL 建筑杂志 2~3 本叠放
        const g = new THREE.Group();
        const nBooks = 2 + Math.floor(rand() * 2);
        let curY = 0;
        for (let b = 0; b < nBooks; b++) {
          const mat = elCoverMats[Math.floor(rand() * elCoverMats.length)];
          const mesh = new THREE.Mesh(elMagGeo, mat);
          mesh.position.set((rand() - 0.5) * 0.015, curY + 0.014, (rand() - 0.5) * 0.015);
          mesh.rotation.y = (rand() - 0.5) * 0.18;
          curY += 0.028;
          g.add(mesh);
        }
        g.position.set(x, yBase, z);
        g.rotation.y = (rand() - 0.5) * 0.4;
        root.add(g);
      } else if (kind === 'elMagStanding') {
        // 立放/斜靠的 EL 杂志
        const g = new THREE.Group();
        const mesh = new THREE.Mesh(elMagStandingGeo, elCoverMats[0]);
        mesh.position.y = 0.16;
        mesh.rotation.z = (rand() - 0.5) * 0.12;
        mesh.rotation.y = (rand() - 0.5) * 0.25;
        g.add(mesh);
        g.position.set(x, yBase, z);
        root.add(g);
      } else if (kind === 'sculpture') {
        // 极简微缩建筑雕塑（拱形或阶梯几何体）
        const g = new THREE.Group();
        const mat = artSculptureMats[Math.floor(rand() * artSculptureMats.length)];
        const isArch = rand() > 0.5;
        const mesh = isArch
          ? new THREE.Mesh(archSculptureGeo, mat)
          : new THREE.Mesh(stepSculptureGeo, mat);
        mesh.position.y = isArch ? 0.08 : 0.07;
        mesh.rotation.y = (rand() - 0.5) * 0.8;
        g.add(mesh);
        g.position.set(x, yBase, z);
        root.add(g);
      } else if (kind === 'tallVase') {
        // 极简高瓶
        const g = new THREE.Group();
        const mat = vaseMats[Math.floor(rand() * vaseMats.length)];
        const mesh = new THREE.Mesh(tallVaseGeo, mat);
        mesh.position.y = 0.175;
        g.add(mesh);
        g.position.set(x, yBase, z);
        root.add(g);
      } else {
        // 极简块面雕塑
        const g = new THREE.Group();
        const mat = artSculptureMats[Math.floor(rand() * artSculptureMats.length)];
        const mesh = new THREE.Mesh(blockSculptureGeo, mat);
        mesh.position.y = 0.11;
        mesh.rotation.y = (rand() - 0.5) * 0.5;
        g.add(mesh);
        g.position.set(x, yBase, z);
        root.add(g);
      }
    }
  }

  return { root, geometries: geometriesToDispose, materials: [...elCoverMats, elSpineMat, ...artSculptureMats, ...vaseMats] };
}

function makeGlbStats(layout, config) {
  const cutList = [];
  const addCut = (spec, section, len, qty, span = len) => {
    const prev = cutList.find(c => c.spec === spec && c.section === section && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty;
    else cutList.push({ spec, section, len: +len.toFixed(3), span: +span.toFixed(3), qty });
  };
  const posts = layout.rows.posts.length;
  const segments = layout.rows.segments.length;
  const depth = layout.rows.depth.length;
  const strips = layout.rows.strips.length;
  const battens = layout.rows.battens.length;

  addCut('GLB 30×30 通高立柱', '30×30', layout.H, posts);
  addCut('GLB 30×30 分段立柱', '30×30', .43, segments);
  addCut('GLB 30×30 进深梁', '30×30', .37, depth);
  addCut('GLB 20×20 精确层板条', '20×20', .4, strips);
  addCut('GLB 20×10 板下横条', '20×10', layout.W + .03, battens);

  // 磨砂亚克力整板：面积计入 panes（与标准参数架同口径，市场价可计价）
  const decks = Array.isArray(config?.decks) ? config.decks : [];
  const bayWidths = Array.isArray(config?.bayWidths) ? config.bayWidths : [];
  let paneCount = 0, paneArea = 0;
  decks.forEach((d, k) => {
    if (k >= (config?.levels || 0) || d !== 'acrylic') return;
    for (const w of bayWidths) { paneArea += Math.max(0, w - .035) * .36; paneCount++; }
  });

  const sectionAreas = {
    '30×30': 1.8e-4,
    '20×20': 1.18e-4,
    '20×10': 5.9e-5,
  };
  const profileLengthM = cutList.reduce((sum, c) => sum + c.len * c.qty, 0);
  const weightKg = cutList.reduce((sum, c) => sum + c.len * c.qty * sectionAreas[c.section], 0) * 2700
    + paneArea * .008 * 1180; // 亚克力整板自重（8mm × 1180 kg/m³）

  return {
    cutList,
    hardware: [
      { name: 'GLB 精确节点连接方式（未核价）', qty: depth },
    ],
    panes: paneCount ? [{ label: '磨砂亚克力层板', areaM2: +paneArea.toFixed(3), kind: 'acrylic' }] : [],
    partCount: posts + segments + depth + strips + battens + paneCount,
    profileLengthM: +profileLengthM.toFixed(1),
    weightKg: +weightKg.toFixed(1),
    referenceOnly: true,
  };
}

function orientDepthGeometry(geometry) {
  // 绕 Y 轴旋转 180°，使得原局部 z=0 端的端盖朝向 +Z 迎面（开放外侧），同时几何从 z=0 延伸至 z=-0.37
  geometry.rotateY(Math.PI);
  return geometry;
}

// 按需渲染友好：几何缓存池 —— 同参数几何全架共享，rebuild 时不再反复创建/销毁
const geoCache = new Map();

function cachedGeometry(key, factory) {
  if (!geoCache.has(key)) geoCache.set(key, { refCount: 0, geo: factory() });
  const entry = geoCache.get(key);
  entry.refCount++;
  return entry.geo;
}

/** 引用计数释放，避免共享几何被提前销毁 */
function releaseGeometry(key) {
  const entry = geoCache.get(key);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) { entry.geo.dispose(); geoCache.delete(key); }
}

export function glbFrameCacheInfo() {
  return { entries: geoCache.size, keys: [...geoCache.keys()] };
}

export function buildGlbFrame(config) {
  const layout = glbLayout(config);
  const group = new THREE.Group();
  const groups = {};
  const colorCfg = COLORS[config?.color] || COLORS.silver;
  const side = new THREE.MeshStandardMaterial({
    color: colorCfg.hex,
    metalness: colorCfg.metalness,
    roughness: colorCfg.roughness,
  });
  const capColor = new THREE.Color(colorCfg.hex).multiplyScalar(1.08);
  const cap = new THREE.MeshStandardMaterial({
    color: capColor,
    metalness: Math.max(.25, colorCfg.metalness - .15),
    roughness: Math.min(.8, colorCfg.roughness + .3),
  });
  // 几何经缓存池共享：同配置 rebuild 不再反复创建/销毁；记录 key 供 dispose 引用计数释放
  const geometryKeys = {
    posts: `tslot-up:0.03x0.03:${layout.H}`,
    segments: 'tslot-up:0.03x0.03:0.43',
    depth: 'glbjoint:0.37',
    strips: 'glbstrip:0.4',
    battens: `tslot-x:0.02x0.01:${layout.W + .03}`,
  };
  const geometries = {
    posts: cachedGeometry(geometryKeys.posts, () => extrudeUp(makeTSlotShape(.03, .03), layout.H)),
    segments: cachedGeometry(geometryKeys.segments, () => extrudeUp(makeTSlotShape(.03, .03), .43)),
    depth: cachedGeometry(geometryKeys.depth, () => orientDepthGeometry(extrudeAlongZ(makeGlbJointShape(), .37))),
    strips: cachedGeometry(geometryKeys.strips, () => extrudeAlongZ(makeGlbStripShape(), .4)),
    battens: cachedGeometry(geometryKeys.battens, () => extrudeAlongX(makeTSlotShape(.02, .01), layout.W + .03)),
  };
  const panelGeoKey = `panel:${layout.W - .03}`;
  const paneGeoKey = 'glbpane:unit';
  const hasPanels = !!(config?.sidePanels && glbBackPanelRows(config).length);
  for (const [key, rows] of Object.entries(layout.rows)) {
    const mesh = new THREE.InstancedMesh(geometries[key], [cap.clone(), side.clone()], rows.length);
    mesh.name = key;
    rows.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    groups[key] = mesh;
  }
  if (config?.sidePanels) {
    const panelRows = glbBackPanelRows(config);
    if (panelRows.length) {
      const panelCfg = PANEL_COLORS[config?.panelColor] || PANEL_COLORS.galv;
      const panelGeometry = cachedGeometry(panelGeoKey, () => new THREE.BoxGeometry(layout.W - .03, 1, .012));
      geometries.panels = panelGeometry;
      const panelMaterial = new THREE.MeshStandardMaterial({ color: panelCfg.hex, metalness: panelCfg.metalness, roughness: panelCfg.roughness });
      const mesh = new THREE.InstancedMesh(panelGeometry, panelMaterial, panelRows.length);
      mesh.name = 'panels';
      panelRows.forEach(([x, y, z, h], i) => {
        const m = new THREE.Matrix4().makeScale(1, h, 1);
        m.setPosition(x, y, z);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      groups.panels = mesh;
    }
  }
  // 磨砂亚克力整板：逐层逐跨一块（decks[k]==='acrylic'），压在进深梁顶面
  const decksCfg = Array.isArray(config?.decks) ? config.decks : [];
  const bayW = Array.isArray(config?.bayWidths) ? config.bayWidths : [];
  const paneRows = []; // [cx, y, w]
  {
    const xs = [-layout.W / 2];
    for (const w of bayW) xs.push(xs.at(-1) + w);
    for (let k = 0; k < (config?.levels || 0); k++) {
      if (decksCfg[k] !== 'acrylic') continue;
      for (let b = 0; b < bayW.length; b++) {
        paneRows.push([(xs[b] + xs[b + 1]) / 2, k * .46 + .034, Math.max(.05, bayW[b] - .035)]);
      }
    }
  }
  if (paneRows.length) {
    const paneGeometry = cachedGeometry(paneGeoKey, () => new THREE.BoxGeometry(1, .008, .36));
    geometries.pane = paneGeometry;
    const mesh = new THREE.InstancedMesh(paneGeometry, getAcrylicMaterial().clone(), paneRows.length);
    mesh.name = 'pane';
    paneRows.forEach(([cx, y, w], i) => {
      const m = new THREE.Matrix4().makeScale(w, 1, 1);
      m.setPosition(cx, y, 0);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    groups.pane = mesh;
  }
  let propsAssets = null;
  if (config?.props) {
    propsAssets = buildGlbProps(layout, config);
    if (propsAssets.root.children.length) {
      group.add(propsAssets.root);
      groups.props = propsAssets.root;
    }
  }
  const stats = makeGlbStats(layout, config);
  const bounds = {
    W: layout.W,
    H: layout.H,
    D: .40,
    // 节点近看：精准对焦在外侧迎面的节点端头 (x = 第一根立柱, y = 第二层节点高度, z = DEPTH_FRONT_Z)
    nodeTarget: new THREE.Vector3(layout.rows.depth[0][0], .015 + .46, DEPTH_FRONT_Z),
  };
  return {
    group,
    groups,
    layout,
    stats,
    bounds,
    dispose() {
      // 缓存池几何：引用计数释放（rebuild 复用时保持存活）；其余资源直接销毁
      for (const key of Object.keys(geometryKeys)) releaseGeometry(geometryKeys[key]);
      if (geometries.panels) releaseGeometry(panelGeoKey);
      if (geometries.pane) releaseGeometry(paneGeoKey);
      for (const mesh of Object.values(groups)) {
        if (!mesh.isInstancedMesh) continue;
        for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) mat.dispose();
      }
      if (propsAssets) {
        propsAssets.geometries.forEach(g => g.dispose());
        propsAssets.materials.forEach(m => m.dispose());
      }
      side.dispose();
      cap.dispose();
    },
  };
}
