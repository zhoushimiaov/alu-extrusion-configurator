// 光轴展架参数化装配（忠实参考模型：单排双柱海报展示架）
//
// 坐标系（与 GLB 一致，平移至原点）：
//   X = 宽度方向（两立柱 ±W/2），Y = 高度，Z = 深度（模型进深很浅）
// 主构件（依据 GLB 逆向数据，比例随 W/H 缩放）：
//   立柱   ⌀20 × H       ×2   底部含锥套
//   底叉   ⌀20 横轴 ×2（前后错位）+ Z 向短轴 + 斜撑 ×4 → 三角承力底盘
//   置物框 ⌀12 双杆 @ yFrame + 端连接 + 托板/层板
//   中档杆 ⌀12 @ yMid；顶档杆 ⌀12 @ yTop
//   背板   竖挂于中档与顶档之间（0.7 比例带包边）；海报 3 张按模型拼贴
//   滚轮   4 × 万向轮组件 / 调平地脚
import * as THREE from 'three';
import {
  ROD_D, RAIL_D, ROD_DENSITY, ZINC_DENSITY,
  DEFAULT_ROD_CONFIG,
} from '../config/rodrack.js';
import { getRodMaterials } from './materials.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function setMT(i, mesh, x, y, z, sx = 1, sy = 1, sz = 1) {
  _q.identity();
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m4.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m4);
}

// 入场动画不再逐 child 修改 opacity，材质无需为动画保持独立；仍按实例克隆以避免跨产品污染。
function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, Array.isArray(mat) ? mat.map(m => m.clone()) : mat.clone(), count) : null;
}

function cylY(radial) {
  return new THREE.CylinderGeometry(1, 1, 1, radial);
}

export function buildRodRack(config) {
  const cfg = { ...DEFAULT_ROD_CONFIG, ...config };
  const { width, height, backPanel, shelf, casters, color, style } = cfg;
  const mat = getRodMaterials(color);

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };

  // ---- 布局（参考模型 H=1.2：各档位高度按立柱长度等比映射）----
  const W = width;
  const H = height;
  const k = H / 1.2;              // 相对模型的高度比例
  const postXs = [-W / 2, W / 2];
  const yPost0 = 0.14;            // 立柱底（锥套顶面）
  const postLen = H;              // 立柱下料长
  const yFrame = 0.419 * k;       // 置物框双杆
  const yMid = 0.582 * k;         // 中档杆（背板底边）
  const yTop = 1.282 * k;         // 顶档杆（背板顶边）
  const yTopCap = H + 0.142;      // 立柱顶（模型立柱超出顶档 0.06 用于挂件）
  const zFrame = 0.087;           // 置物框双杆半深
  const forkHalf = 0.20;          // 底叉半长（⌀20×0.4 Z 向长杆，前后各伸出 0.2）
  const axleOff = 0.06;           // 双横轴相对柱平面的前后错位
  const yFork = 0.126;            // 底叉杆高
  const yAxle = 0.151;            // 横轴高
  const yBraceTop = 0.235;        // 斜撑上端在立柱上的高度

  // ---- 几何 ----
  const postGeo = cylY(16);
  const railXGeo = cylY(12); railXGeo.rotateZ(Math.PI / 2);
  const railZGeo = cylY(12); railZGeo.rotateX(Math.PI / 2);
  const diagGeo = cylY(10);
  const boardVGeo = new THREE.BoxGeometry(1, 1, 0.002);   // 立板（背板/海报）
  const boardHGeo = new THREE.BoxGeometry(1, 0.002, 1);   // 平板（托板/层板）
  const trimGeo = new THREE.BoxGeometry(0.012, 1, 0.014); // 背板左右包边
  const wheelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.016, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const brkGeo = new THREE.BoxGeometry(0.014, 1, 0.032);
  const footGeo = new THREE.CylinderGeometry(0.019, 0.022, 0.02, 14);
  const blockGeo = new THREE.BoxGeometry(0.03, 0.024, 0.034);

  // ---- 立柱 ×2（从锥套顶到柱顶）----
  const posts = instanced(postGeo, mat.rod, 2);
  setMT(0, posts, postXs[0], yPost0 + postLen / 2, 0, ROD_D / 2, postLen, ROD_D / 2);
  setMT(1, posts, postXs[1], yPost0 + postLen / 2, 0, ROD_D / 2, postLen, ROD_D / 2);
  group.add(posts);
  groups.posts = posts;

  // ---- 锥套（立柱底部插入底叉的过渡件）----
  const sockGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.05, 14);
  const socks = instanced(sockGeo, mat.block, 2);
  setMT(0, socks, postXs[0], 0.12, 0, 1, 1, 1);
  setMT(1, socks, postXs[1], 0.12, 0, 1, 1, 1);
  group.add(socks);
  groups.socks = socks;

  // ---- 置物框双杆 + 中档 + 顶档（⌀12 × W±0.08）----
  const railLen = W + 0.08;
  const rails = instanced(railXGeo, mat.rod, 4);
  setMT(0, rails, 0, yFrame, zFrame, railLen, RAIL_D / 2, RAIL_D / 2);
  setMT(1, rails, 0, yFrame, -zFrame, railLen, RAIL_D / 2, RAIL_D / 2);
  setMT(2, rails, 0, yMid, 0, railLen, RAIL_D / 2, RAIL_D / 2);
  setMT(3, rails, 0, yTop, 0, railLen, RAIL_D / 2, RAIL_D / 2);
  group.add(rails);
  groups.rails = rails;

  // ---- 框侧连接短轴（⌀12 × 框深，左右各一）----
  const frameEnds = instanced(railZGeo, mat.rod, 2);
  setMT(0, frameEnds, postXs[0], yFrame, 0, RAIL_D / 2, RAIL_D / 2, zFrame * 2);
  setMT(1, frameEnds, postXs[1], yFrame, 0, RAIL_D / 2, RAIL_D / 2, zFrame * 2);
  group.add(frameEnds);
  groups.frameEnds = frameEnds;

  // ---- 底盘：每柱一根 ⌀20×0.4 Z 向底叉长杆 + 双 X 横轴 ----
  const forks = instanced(railZGeo, mat.rod, 2);
  setMT(0, forks, postXs[0], yFork, 0, ROD_D / 2, ROD_D / 2, forkHalf);
  setMT(1, forks, postXs[1], yFork, 0, ROD_D / 2, ROD_D / 2, forkHalf);
  group.add(forks);
  groups.forks = forks;
  const axles = instanced(railXGeo, mat.rod, 2);
  setMT(0, axles, 0, yAxle, axleOff, W + 0.02, ROD_D / 2, ROD_D / 2);
  setMT(1, axles, 0, yAxle, -axleOff, W + 0.02, ROD_D / 2, ROD_D / 2);
  group.add(axles);
  groups.axles = axles;
  // 立柱与底叉交接的锥套座（柱底两侧短轴）
  const forkZs = instanced(railZGeo, mat.rod, 4);
  setMT(0, forkZs, postXs[0], yPost0 - 0.02, axleOff / 2, ROD_D / 2, RAIL_D / 2, axleOff + 0.05);
  setMT(1, forkZs, postXs[0], yPost0 - 0.02, -axleOff / 2, ROD_D / 2, RAIL_D / 2, axleOff + 0.05);
  setMT(2, forkZs, postXs[1], yPost0 - 0.02, axleOff / 2, ROD_D / 2, RAIL_D / 2, axleOff + 0.05);
  setMT(3, forkZs, postXs[1], yPost0 - 0.02, -axleOff / 2, ROD_D / 2, RAIL_D / 2, axleOff + 0.05);
  group.add(forkZs);
  groups.forkZs = forkZs;

  // ---- 斜撑 ×4：立柱上部（y≈0.24）斜插到底叉端头（y≈0.04，z≈±0.20），真实三角承力 ----
  const nDiag = 4;
  const diags = instanced(diagGeo, mat.rod, nDiag);
  const diagLen = Math.hypot(yBraceTop - 0.04, forkHalf - 0.005);
  {
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    let di = 0;
    for (const px of postXs) {
      for (const sz of [1, -1]) {
        const y0 = yBraceTop, z0 = 0;
        const y1 = 0.04, z1 = sz * (forkHalf - 0.005);
        dir.set(0, y1 - y0, z1 - z0).normalize();
        _q.setFromUnitVectors(up, dir);
        _p.set(px, (y0 + y1) / 2, (z0 + z1) / 2);
        _s.set(RAIL_D / 2, Math.hypot(y1 - y0, z1 - z0), RAIL_D / 2);
        _m4.compose(_p, _q, _s);
        diags.setMatrixAt(di++, _m4);
      }
    }
    _s.set(1, 1, 1);
  }
  group.add(diags);
  groups.diags = diags;

  // ---- 斜撑卡箍：斜撑与底叉交叉处、斜撑与立柱相交处 ----
  const diagBlocks = instanced(blockGeo, mat.block, 8);
  {
    let di = 0;
    for (const px of postXs) {
      for (const sz of [1, -1]) {
        // 交叉点：brace 从 (yBraceTop,0) 到 (0.04,±(forkHalf-0.005))，在 y=yFork 处 z≈±0.106
        const t = (yBraceTop - yFork) / (yBraceTop - 0.04);
        setMT(di++, diagBlocks, px, yFork, sz * (forkHalf - 0.005) * t);
      }
    }
    for (const px of postXs) {
      setMT(di++, diagBlocks, px, yBraceTop, 0);
    }
  }
  group.add(diagBlocks);
  groups.diagBlocks = diagBlocks;

  // ---- 面板体系（按样式分派）----
  let boardCount = 0;
  if (style === 'panel') {
    // 双联展板：两块对称白色展板，整齐挂装在顶档与中档横杆之间，中缝 16mm
    // 物理结构：顶边齐平顶档横杆（yTop），底边落在中档横杆（yMid），杜绝横杆穿板与悬空伪影
    const seam = 0.016;
    const panelW = Math.max(0.18, (W - 0.08 - seam) / 2);
    const panelH = yTop - yMid;
    const panelY = yMid + panelH / 2;
    const panelZ = -0.008;
    const panelGeo = new THREE.BoxGeometry(1, 1, 0.012);
    const panels = instanced(panelGeo, mat.posterPanel, 2);
    const cX0 = -(seam / 2 + panelW / 2);
    const cX1 = +(seam / 2 + panelW / 2);
    setMT(0, panels, cX0, panelY, panelZ, panelW, panelH, 1);
    setMT(1, panels, cX1, panelY, panelZ, panelW, panelH, 1);
    group.add(panels);
    groups.panels = panels;
    boardCount += 2;

    // 导轨夹扣：真实扣接在 ⌀12 顶档与中档横杆上，每板上下各一对夹扣（共 8 颗），受力点真实可信
    const clipGeo = new THREE.BoxGeometry(0.028, 0.034, 0.026);
    const clips = instanced(clipGeo, mat.block, 8);
    let ci = 0;
    const clampOff = panelW * 0.28;
    for (const cX of [cX0, cX1]) {
      for (const yy of [yMid, yTop]) {
        setMT(ci++, clips, cX - clampOff, yy, -0.004);
        setMT(ci++, clips, cX + clampOff, yy, -0.004);
      }
    }
    group.add(clips);
    groups.clips = clips;
    boardCount += 8;

    // 展板左右外侧包边条与正面海报图纸，赋予真实展板层次
    const trims = instanced(trimGeo, mat.block, 2);
    setMT(0, trims, cX0 - panelW / 2, panelY, panelZ, 1, panelH, 1);
    setMT(1, trims, cX1 + panelW / 2, panelY, panelZ, 1, panelH, 1);
    group.add(trims);
    groups.panelTrims = trims;

    const zP = panelZ + 0.007;
    const papers = instanced(boardVGeo, mat.paper, 3);
    setMT(0, papers, cX0, panelY, zP, panelW * 0.80, panelH * 0.78, 1);
    setMT(1, papers, cX1, panelY + panelH * 0.22, zP, panelW * 0.80, panelH * 0.40, 1);
    setMT(2, papers, cX1, panelY - panelH * 0.22, zP, panelW * 0.80, panelH * 0.36, 1);
    group.add(papers);
    groups.panelPapers = papers;
    boardCount += 5;

    stats.panes = [{ label: '双联展板（白）', areaM2: +(2 * panelW * panelH).toFixed(3), kind: 'panel' }];
  } else if (style === 'acrylic') {
    // 亚克力展示屏：整张透明板挂柱身正面，丝印文字条两行
    // 板高：同样受顶档横杆约束，顶边不得高于 yTop - 0.05
    const acrW = Math.min(W - 0.10, 0.70);
    const acrBottomY = yMid - 0.30;
    const acrH = Math.max(0.30, Math.min(yTop - 0.05 - acrBottomY, 1.55));
    const acrY = acrBottomY + acrH / 2;
    const acrGeo = new THREE.BoxGeometry(1, 1, 0.008);
    const acr = instanced(acrGeo, mat.acrylicClear, 1);
    setMT(0, acr, 0, acrY, -0.014, acrW, acrH, 1);
    group.add(acr);
    groups.acr = acr;
    boardCount += 1;
    // 丝印文字条（白底黑字示意：两条半透明白条）
    const stripGeo = new THREE.BoxGeometry(1, 1, 0.001);
    const strips = instanced(stripGeo, mat.printStrip, 2);
    setMT(0, strips, 0, acrY + acrH * 0.18, -0.018, acrW * 0.82, 0.05, 1);
    setMT(1, strips, 0, acrY + acrH * 0.08, -0.018, acrW * 0.62, 0.035, 1);
    group.add(strips);
    groups.printStrips = strips;
    boardCount += 2;
    // 板夹（左右各两组）
    const clipGeo = new THREE.BoxGeometry(0.05, 0.035, 0.032);
    const clips = instanced(clipGeo, mat.block, 4);
    let ci = 0;
    for (const sx of [-1, 1]) {
      for (const yy of [acrY - acrH / 2 + 0.08, acrY + acrH / 2 - 0.08]) {
        setMT(ci++, clips, sx * (acrW / 2 + 0.012), yy, -0.014);
      }
    }
    group.add(clips);
    groups.clips = clips;
    boardCount += 4;
    stats.panes = [{ label: '亚克力展示屏（透明 8mm）', areaM2: +(acrW * acrH).toFixed(3), kind: 'acrylic' }];
  } else if (backPanel !== 'none') {
    const boardH = (yTop - yMid) * 1.0;     // 中档 → 顶档
    const boardW = Math.min(W - 0.10, boardH * 1.0); // 模型 0.7×0.7：宽随柱距但不超过板高
    const yB = yMid + boardH / 2;
    const zB = -0.008;
    const board = instanced(boardVGeo, backPanel === 'zinc' ? mat.zinc : mat.poster, 1);
    setMT(0, board, 0, yB, zB, boardW, boardH, 1);
    group.add(board);
    groups.board = board;
    // 左右包边
    const trims = instanced(trimGeo, mat.block, 2);
    setMT(0, trims, -(boardW / 2 + 0.006), yB, zB - 0.002, 1, boardH, 1);
    setMT(1, trims, boardW / 2 + 0.006, yB, zB - 0.002, 1, boardH, 1);
    group.add(trims);
    groups.trims = trims;
    boardCount = 3;
    if (backPanel === 'poster') {
      // 海报 3 张（按模型拼贴坐标随板宽等比映射）
      const k2 = boardW / 0.70;
      const zP = zB + 0.004;
      const papers = instanced(boardVGeo, mat.paper, 3);
      setMT(0, papers, -0.132 * k2, yB - 0.192 * k2, zP, 0.178 * k2, 0.166 * k2, 1);
      setMT(1, papers, 0.168 * k2, yB + 0.064 * k2, zP, 0.303 * k2, 0.422 * k2, 1);
      setMT(2, papers, -0.178 * k2, yB + 0.053 * k2, zP, 0.297 * k2, 0.210 * k2, 1);
      group.add(papers);
      groups.papers = papers;
      boardCount += 3;
    }
    stats.panes = [];
  }

  // ---- 底部置物：窄托板 或 全深镀锌层板 ----
  if (shelf === 'tray') {
    const tray = instanced(boardHGeo, mat.zinc, 1);
    setMT(0, tray, 0, yFrame + 0.008, 0, W - 0.13, 1, 0.15);
    group.add(tray);
    groups.tray = tray;
    boardCount += 1;
  } else if (shelf === 'deck') {
    // 全深层板：铺满双杆框（W-0.06 × 0.17），略超出框沿便于搭放
    const deck = instanced(boardHGeo, mat.zinc, 1);
    setMT(0, deck, 0, yFrame + 0.010, 0, W - 0.06, 1, zFrame * 2 + 0.03);
    group.add(deck);
    groups.rodDeck = deck;
    // 层板托梁 ×2（⌀12，X 向，位于层板下方前后）
    const joists = instanced(railXGeo, mat.rod, 2);
    setMT(0, joists, 0, yFrame - 0.012, zFrame - 0.02, W - 0.06, RAIL_D / 2, RAIL_D / 2);
    setMT(1, joists, 0, yFrame - 0.012, -zFrame + 0.02, W - 0.06, RAIL_D / 2, RAIL_D / 2);
    group.add(joists);
    groups.rodJoists = joists;
    groups.joists = joists;
    boardCount += 1;
    stats.profileLengthM += 2 * (W - 0.06);
  }

  // ---- T 型夹块（横杆与立柱交汇处 + 底盘交点）----
  const nBlocks = 12;
  const blocks = instanced(blockGeo, mat.block, nBlocks);
  let bi = 0;
  for (const y of [yFrame, yMid, yTop]) {
    for (const px of postXs) {
      setMT(bi++, blocks, px, y, 0);
    }
  }
  for (const px of postXs) {
    setMT(bi++, blocks, px, yFrame, zFrame);
    setMT(bi++, blocks, px, yFrame, -zFrame);
  }
  for (const px of postXs) {
    setMT(bi++, blocks, px, yAxle, axleOff);
    setMT(bi++, blocks, px, yAxle, -axleOff);
  }
  group.add(blocks);
  groups.blocks = blocks;

  // ---- 滚轮 / 地脚（轮在底叉端头 z=±0.20）----
  let wheelParts = 0;
  if (casters) {
    const wheels = instanced(wheelGeo, mat.block, 4);
    const brks = instanced(brkGeo, mat.block, 4);
    let wi = 0;
    for (const px of postXs) {
      for (const sz of [1, -1]) {
        setMT(wi, wheels, px, 0.03, sz * forkHalf);
        setMT(wi, brks, px, 0.08, sz * forkHalf, 1, 0.07, 1);
        wi++;
      }
    }
    group.add(wheels);
    group.add(brks);
    groups.wheels = wheels;
    groups.brks = brks;
    wheelParts = 8;
  } else {
    const feet = instanced(footGeo, mat.block, 4);
    let fi = 0;
    for (const px of postXs) {
      for (const sz of [1, -1]) {
        setMT(fi++, feet, px, 0.01, sz * forkHalf);
      }
    }
    group.add(feet);
    groups.feet = feet;
    wheelParts = 4;
  }

  // ---- 统计 ----
  const railTotal = 4 * railLen + 2 * zFrame * 2;
  stats.profileLengthM += 2 * postLen + 2 * (forkHalf * 2) + 2 * (W + 0.02) + railTotal + nDiag * diagLen;

  const volRod = (2 * postLen * Math.PI * (ROD_D / 2) ** 2)
    + ((2 * (W + 0.02) + railTotal) * Math.PI * (RAIL_D / 2) ** 2)
    + (2 * forkHalf * 2 * Math.PI * (ROD_D / 2) ** 2)
    + (nDiag * diagLen * Math.PI * (RAIL_D / 2) ** 2);
  const boardArea = style === 'panel' || style === 'acrylic'
    ? (stats.panes && stats.panes[0] ? stats.panes[0].areaM2 : 0)
    : (backPanel !== 'none' ? Math.min(W - 0.10, (yTop - yMid)) * (yTop - yMid) : 0);
  const shelfArea = shelf === 'tray' ? (W - 0.13) * 0.15 : shelf === 'deck' ? (W - 0.06) * (zFrame * 2 + 0.03) : 0;
  stats.weightKg = volRod * ROD_DENSITY
    + (boardArea + shelfArea) * 0.0012 * ZINC_DENSITY
    + nBlocks * 0.01 + (casters ? 4 * 0.12 : 4 * 0.03)
    + (style === 'panel' ? 2 * 1.4 : 0) + (style === 'acrylic' ? 0.2 : 0)
    + (style === 'poster' && backPanel === 'poster' ? 0.2 : 0);
  stats.partCount = 2 + 2 + 4 + 2 + nDiag + nDiag + boardCount + nBlocks + wheelParts;

  // ---- 算料单 ----
  const addCut = (spec, dia, len, qty) => {
    const prev = stats.cutList.find(c => c.spec === spec && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else stats.cutList.push({ spec, section: '⌀' + dia, len, qty });
  };
  addCut('光轴立柱', '20', +postLen.toFixed(3), 2);
  addCut('底叉长杆', '20', +(forkHalf * 2).toFixed(3), 2);
  addCut('底盘横轴', '20', +(W + 0.02).toFixed(3), 2);
  addCut('置物框/档杆', '12', +railLen.toFixed(3), 4);
  addCut('框侧连接轴', '12', +(zFrame * 2).toFixed(3), 2);
  addCut('底盘斜撑', '12', +diagLen.toFixed(3), 4);
  if (shelf === 'deck') addCut('层板托梁', '12', +(W - 0.06).toFixed(3), 2);
  if (backPanel !== 'none') stats.cutList.push({ spec: backPanel === 'zinc' ? '镀锌背板' : '海报背板', section: '板', len: +Math.min(W - 0.10, yTop - yMid).toFixed(2), qty: 1 });
  if (shelf === 'tray') stats.cutList.push({ spec: '置物托板', section: '板', len: +(W - 0.13).toFixed(2), qty: 1 });
  if (shelf === 'deck') stats.cutList.push({ spec: '镀锌层板', section: '板', len: +(W - 0.06).toFixed(2), qty: 1 });
  // 板件清单（比价引擎用：zinc 按面积、poster 按件一口价）
  if (style !== 'panel' && style !== 'acrylic') {
    stats.panes = [];
    if (backPanel === 'zinc') stats.panes.push({ label: '镀锌背板', areaM2: +boardArea.toFixed(3), kind: 'zinc' });
  if (backPanel === 'poster') stats.panes.push({ label: '海报画面', areaM2: +boardArea.toFixed(3), kind: 'poster' });
  if (shelf === 'tray') stats.panes.push({ label: '置物托板', areaM2: +shelfArea.toFixed(3), kind: 'zinc' });
  if (shelf === 'deck') stats.panes.push({ label: '镀锌层板', areaM2: +shelfArea.toFixed(3), kind: 'zinc' });
  } else {
    if (shelf === 'tray') stats.panes.push({ label: '置物托板', areaM2: +shelfArea.toFixed(3), kind: 'zinc' });
    if (shelf === 'deck') stats.panes.push({ label: '镀锌层板', areaM2: +shelfArea.toFixed(3), kind: 'zinc' });
  }
  stats.hardware = [
    casters ? { name: '万向轮 2 寸（含刹车×2）', qty: 4 } : { name: '调平地脚 M12', qty: 4 },
    { name: 'T 型夹块', qty: nBlocks },
    { name: '斜撑端卡', qty: nDiag },
    { name: '横杆卡夹', qty: 8 },
    ...(backPanel !== 'none' ? [{ name: '背板挂扣', qty: 4 }] : []),
    ...(shelf === 'deck' ? [{ name: '层板托夹', qty: 4 }] : []),
  ];

  return {
    group,
    groups,
    stats,
    bounds: { W: W + 0.12, H: yTopCap + 0.04, D: 0.42 },
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh) return;
        o.geometry.dispose && o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m && m.dispose());
      });
      // 材质由 materials.js 按色值缓存共享，不销毁（dispose 缓存项会导致
      // 再次切回该颜色时拿到已销毁材质，渲染黑模；2026-09-19 在 cart 上复现并修复）
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
