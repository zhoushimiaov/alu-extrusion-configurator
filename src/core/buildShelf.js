// 参数化整机装配：立柱 / 横梁（强轴竖放）/ 型材层板 / 侧板 / 压铸角件 / 支脚 / 摆件
// Instanced detail groups; cap/side materials add draw calls.
import * as THREE from 'three';
import {
  DEPTH, LEVEL_PITCH, POST_H_BASE,
  PROFILE_SERIES, ALU_DENSITY, ACRYLIC_DENSITY, PANE_THICKNESS,
  RIB_SPACING, DECK_STRIP, PANEL_RIB, normalizeConfig, beamCutLength, JOINT_GAP,
  PANEL_COLORS,
} from '../config/product.js';
import { makeTSlotShape, makeRibShape, extrudeUp, extrudeAlongX, extrudeAlongZ } from './profiles.js';
import { getCutMaterial, getAluMaterial, getConnectorMaterial, getAcrylicMaterial, getFootMaterial, getPropMaterials } from './materials.js';

import {makeCornerGeo, makeSocketBoltGeo, makeWasherGeo} from './joints.js';

const CONN_MASS = 0.075; // kg / 角件
const FOOT_MASS = 0.03;  // kg / 个

function instanced(geo, mat, count) {
  if (count <= 0) return null;
  const m = new THREE.InstancedMesh(geo, Array.isArray(mat) ? mat.map(m=>m.clone()) : mat.clone(), count);
  return m;
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

export function buildShelf(config, withProps = true) {
  const cfg = normalizeConfig(config);
  const { bays, levels, series, decks, bayWidths, sidePanels, color } = cfg;
  const prof = PROFILE_SERIES[series] || PROFILE_SERIES['2040'];
  const postProf = PROFILE_SERIES['2020'];

  const W = bayWidths.reduce((a, b) => a + b, 0);
  const H = levels * LEVEL_PITCH + POST_H_BASE;
  const x0 = -W / 2;
  const zPost = DEPTH / 2 - 0.01;

  const postXs = [x0];
  let acc = x0;
  for (const w of bayWidths) { acc += w; postXs.push(acc); }

  const group = new THREE.Group();
  const matAlu = [getCutMaterial(), getAluMaterial(color).clone()];
  const matConn = getConnectorMaterial().clone();
  const matAcrylic = getAcrylicMaterial().clone();
  const matFoot = getFootMaterial().clone();

  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0 };
  const groups = {};

  // ---- 几何 ----
  const postGeo = extrudeUp(makeTSlotShape(postProf.w, postProf.h), H, 8);
  // Verified vertices: centered X length; Y remains vertical, section X maps to -Z.
  const beamGeo = extrudeAlongX(makeTSlotShape(prof.w, prof.h), 1, 8);
  // 型材层板条：24×16 迷你 T-slot，槽口朝上，沿 Z 挤出；前端悬挑超出前立柱线
  const CANTILEVER = 0.06;                       // 悬挑长度
  const stripZBack = -zPost;                     // 后端搭在背梁中线上
  const stripZFront = zPost + 0.01 + CANTILEVER; // 前端越过柱前面 60mm
  const stripLen = stripZFront - stripZBack;     // 0.45
  const paneDepth = 2 * zPost - 0.02;            // 亚克力板深 0.36（避开前后柱）
  const deckStripGeo = extrudeAlongZ(makeTSlotShape(DECK_STRIP.w, DECK_STRIP.h), stripLen, 4);
  const panelGeo = extrudeUp(makeRibShape(PANEL_RIB.w, PANEL_RIB.h), LEVEL_PITCH - 0.05, 4);
  const paneGeo = new THREE.BoxGeometry(1, PANE_THICKNESS, paneDepth);
  const connGeo = makeCornerGeo();
  const boltGeo = makeSocketBoltGeo();
  const washerGeo = makeWasherGeo();
  const footGeo = new THREE.CylinderGeometry(0.015, 0.017, 0.012, 16);
  // 悬挑托架：立柱前侧面竖板 + 层板下横向托舌

  // ---- 立柱 ----
  const nPosts = (bays + 1) * 2;
  const posts = instanced(postGeo, matAlu, nPosts);
  let i = 0;
  for (const px of postXs) {
    for (const sz of [1, -1]) setMT(i++, posts, px, 0, sz * zPost);
  }
  groups.posts = posts;

  // ---- 后侧横梁：仅背面（层板条后端搮在其上；前面无梁，层板悬挑 + 托架承担）----
  const BEAM_TOP = prof.h / 2;
  const nBeamRows = levels + 1;
  const beamsB = instanced(beamGeo, matAlu, nBeamRows * bays);
  i = 0;
  for (let k = 0; k <= levels; k++) {
    const y = 0.02 + k * LEVEL_PITCH;
    let bx = x0;
    for (let b = 0; b < bays; b++) {
      const wSeg = bayWidths[b];
      const cx = bx + wSeg / 2;
      _s.set(beamCutLength(wSeg, postProf.w), 1, 1);
      _q.identity();
      _m4.compose(new THREE.Vector3(cx, y, -zPost), _q, _s);
      beamsB.setMatrixAt(i, _m4);
      i++;
      bx += wSeg;
    }
  }
  _s.set(1, 1, 1);
  groups.beamsB = beamsB;

  // ---- 前支撑梁：层板条下方沿前柱线，托住悬挑段；顶行也加前梁封闭框架 ----
  const railRows = []; // [cx, wSeg, y]
  for (let k = 0; k < levels; k++) {
    if (decks[k] === 'none') continue;
    const stripBottom = 0.02 + k * LEVEL_PITCH + BEAM_TOP;
    const railY = stripBottom - prof.h / 2; // 梁顶与板条底面齐平
    let bx = x0;
    for (let b = 0; b < bays; b++) {
      railRows.push([bx + bayWidths[b] / 2, bayWidths[b], railY]);
      bx += bayWidths[b];
    }
  }
  { // 顶行前梁（顶部围梁行，与背梁对称）
    const topY = 0.02 + levels * LEVEL_PITCH;
    let bx = x0;
    for (let b = 0; b < bays; b++) {
      railRows.push([bx + bayWidths[b] / 2, bayWidths[b], topY]);
      bx += bayWidths[b];
    }
  }
  const beamsRail = instanced(beamGeo, matAlu, railRows.length);
  railRows.forEach(([cx, w, y], ri) => {
    _s.set(beamCutLength(w, postProf.w), 1, 1);
    _m4.compose(new THREE.Vector3(cx, y, zPost), new THREE.Quaternion(), _s);
    beamsRail.setMatrixAt(ri, _m4);
  });
  _s.set(1, 1, 1);
  groups.beamsRail = beamsRail;

  // ---- 侧横梁（Z 向）：每条柱线每层一根，封闭全部侧框架 ----
  const sideLen = 2 * zPost - 0.02; // 后梁内侧面到前梁内侧面
  const sideGeo = extrudeAlongZ(makeTSlotShape(prof.w, prof.h), sideLen - 2 * JOINT_GAP, 8);
  const nSideBeams = postXs.length * nBeamRows;
  const beamsSide = instanced(sideGeo, matAlu, nSideBeams);
  {
    let si = 0;
    for (let k = 0; k <= levels; k++) {
      const y = 0.02 + k * LEVEL_PITCH;
      for (const px of postXs) setMT(si++, beamsSide, px, y, -sideLen / 2 + JOINT_GAP);
    }
  }
  groups.beamsSide = beamsSide;

  // ---- 逐层层板 ----
  let stripMesh = null;
  let paneMesh = null;
  const stripRows = [];
  const paneCells = [];
  const padRows = [];
  const PAD_H = .003;
  const deckTopYs = []; // 有层板的层：层板顶面 y（摆件落点）
  const bracketTops = []; // 型材层板层的板条顶面（托架只支撑悬挑板条）
  for (let k = 0; k < levels; k++) {
    if (decks[k] === 'none') continue;
    const beamTop = 0.02 + k * LEVEL_PITCH + BEAM_TOP; // 背梁顶面
    let bx = x0;
    for (let b = 0; b < bays; b++) {
      const wSeg = bayWidths[b];
      if (decks[k] === 'rib') {
        const n = Math.max(4, Math.floor((wSeg - 0.03) / RIB_SPACING));
        const startX = bx + (wSeg - (n - 1) * RIB_SPACING) / 2;
        for (let r = 0; r < n; r++) stripRows.push([startX + r * RIB_SPACING, beamTop + DECK_STRIP.h / 2]);
      } else if (decks[k] === 'acrylic') {
        paneCells.push([bx + wSeg / 2, beamTop + PAD_H + PANE_THICKNESS / 2, wSeg - 0.012]);
        for(const px of [bx+.006,bx+wSeg-.006]) for(const z of [-.15,.15]) padRows.push([px,beamTop+PAD_H/2,z]);
      }
      bx += wSeg;
    }
    if (decks[k] === 'rib') {
      const top = beamTop + DECK_STRIP.h;
      deckTopYs.push(top);
      bracketTops.push(top);
    } else {
      deckTopYs.push(beamTop + PAD_H + PANE_THICKNESS);
    }
  }
  if (stripRows.length) {
    stripMesh = instanced(deckStripGeo, matAlu, stripRows.length);
    // 层板条：后端搭背梁中线，前端悬挑至柱前面外 60mm
    stripRows.forEach(([x, y], ri) => setMT(ri, stripMesh, x, y, stripZBack));
  }
  if (paneCells.length) {
    paneMesh = instanced(paneGeo, matAcrylic, paneCells.length);
    paneCells.forEach(([cx, y, wSeg], gi) => {
      _s.set(wSeg, 1, 1);
      _m4.compose(new THREE.Vector3(cx, y, 0), new THREE.Quaternion(), _s);
      paneMesh.setMatrixAt(gi, _m4);
    });
    _s.set(1, 1, 1);
  }
  groups.deck = stripMesh;
  groups.pane = paneMesh;
  const pads=instanced(new THREE.BoxGeometry(.008,PAD_H,.025),matFoot,padRows.length);
  padRows.forEach(([x,y,z],i)=>setMT(i,pads,x,y,z));
  groups.pads=pads;

  // ---- 侧挡板 ----
  let panelMesh = null;
  const panelRows = [];
  if (sidePanels) {
    for (let k = 0; k < levels; k++) {
      if (decks[k] === 'none') continue;
      const y = 0.02 + k * LEVEL_PITCH + BEAM_TOP; // 从背梁顶面起，避开梁体
      for (let p = 0; p < postXs.length - 1; p++) {
        const wNext = bayWidths[p];
        const n = Math.max(4, Math.floor((wNext - 0.03) / RIB_SPACING));
        for (let r = 0; r < n; r++) panelRows.push([postXs[p] + 0.02 + r * RIB_SPACING, y]);
      }
    }
    if (panelRows.length) {
      const panelCfg = PANEL_COLORS[cfg.panelColor] || PANEL_COLORS.galv;
      const matPanelSide = new THREE.MeshStandardMaterial({ color: panelCfg.hex, roughness: panelCfg.roughness, metalness: panelCfg.metalness });
      panelMesh = instanced(panelGeo, [getCutMaterial(), matPanelSide], panelRows.length);
      panelRows.forEach(([x, y], pi) => setMT(pi, panelMesh, x, y, -zPost - 0.006));
    }
  }
  groups.panels = panelMesh;

  // ---- 角件 + 螺栓 ----
  // 后梁节点（每层每柱） + 前支撑梁节点（有梁层的每柱）
  const nRearNodes = postXs.length * (levels + 1);
  const nRailNodes = postXs.length * railRows.length;
  const nNodes = nRearNodes + nRailNodes;
  // Actual beam-end visual nodes; legacy nNodes procurement accounting stays unchanged.
  const nodeRows=[];
  for(let k=0;k<=levels;k++) {
    let bx=x0;
    for(let b=0;b<bays;b++) {
      for(const z of [-zPost,...(k===levels || decks[k]!=='none' ? [zPost] : [])]) {
        nodeRows.push([bx+.01,.02+k*LEVEL_PITCH-prof.h/2,z,1]);
        nodeRows.push([bx+bayWidths[b]-.01,.02+k*LEVEL_PITCH-prof.h/2,z,-1]);
      }
      bx+=bayWidths[b];
    }
  }
  const conn=instanced(connGeo,matConn,nodeRows.length);
  const bolts=instanced(boltGeo,matConn,nodeRows.length*2);
  const washers=instanced(washerGeo,matConn,nodeRows.length*2);
  nodeRows.forEach(([x,y,z,dir],ni)=>{
    setMT(ni,conn,x,y,z,0,dir===1?0:Math.PI,0);
    setMT(ni*2,washers,x+dir*.003,y-.014,z,0,dir*Math.PI/2,0);
    setMT(ni*2,bolts,x+dir*.0038,y-.014,z,0,dir*Math.PI/2,0);
    setMT(ni*2+1,washers,x+dir*.015,y-.003,z,Math.PI/2,0,0);
    setMT(ni*2+1,bolts,x+dir*.015,y-.0038,z,Math.PI/2,0,0);
  });
  groups.conn=conn;groups.bolts=bolts;groups.washers=washers;

  // ---- 悬挑托架（前侧：竖板贴柱前侧面 + 托舌伸入层板条下）----
  const bracketVGeo = new THREE.BoxGeometry(0.05, 0.032, 0.004);
  const tongueLen = (stripZFront - 0.002) - (zPost + 0.0105); // 托舌从柱前面到板条端内 2mm
  // First strip centre can be almost (0.03 + 2*RIB_SPACING)/2 from a post.
  // Reach its inner edge plus 4mm bearing; the old 50mm tongue missed narrow bays.
  // Visual support only: procurement quantity and assumed mass remain unchanged.
  const tongueWidth = 0.03 + 2 * RIB_SPACING - DECK_STRIP.w + 0.008;
  const bracketHGeo = new THREE.BoxGeometry(tongueWidth, 0.004, tongueLen);
  const nBrk = postXs.length * bracketTops.length;
  const brkV = instanced(bracketVGeo, matConn, nBrk);
  const brkH = instanced(bracketHGeo, matConn, nBrk);
  i = 0;
  for (const stripTop of bracketTops) {
    const stripBottom = stripTop - DECK_STRIP.h;
    for (const px of postXs) {
      // 竖板：贴柱前面，顶面与板条底面齐平
      setMT(i, brkV, px, stripBottom - 0.016, zPost + 0.012);
      // 托舌：顶面托住板条底面，前端略短于板条端头
      setMT(i, brkH, px, stripBottom - 0.002, (zPost + 0.0105 + stripZFront - 0.002) / 2);
      i++;
    }
  }
  groups.brkV = brkV;
  groups.brkH = brkH;

  // ---- 支脚 ----
  const feet = instanced(footGeo, matFoot, nPosts);
  i = 0;
  for (const px of postXs) {
    for (const sz of [1, -1]) setMT(i++, feet, px, 0.006, sz * zPost);
  }
  groups.feet = feet;

  // ---- 摆件（随机书包 / 书堆 / 花瓶 / 收纳盒）----
  let propsGroup = null;
  const propMatSets = getPropMaterials();
  if (withProps && deckTopYs.length) {
    propsGroup = new THREE.Group();
    propsGroup.name = 'props';
    // 确定性伪随机：seed 覆盖全部影响布局的输入（跨宽 / 层板配置 / 跨数 / 层数），
    // 同配置同布局，改任一相关配置才重排
    let seed = 42 + bays * 7 + levels * 13 + deckTopYs.length * 3;
    for (const w of bayWidths) seed = (seed * 31 + Math.round(w * 100)) % 2147483647;
    for (const d of decks) seed = (seed * 31 + d.charCodeAt(0)) % 2147483647;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const geoms = {
      bag: new THREE.BoxGeometry(0.30, 0.40, 0.14),                      // 书包主体
      bagFlap: new THREE.BoxGeometry(0.30, 0.16, 0.15),
      books: new THREE.BoxGeometry(0.22, 0.05, 0.16),                    // 书堆单本
      vase: new THREE.CylinderGeometry(0.055, 0.075, 0.24, 14),          // 花瓶
      box: new THREE.BoxGeometry(0.34, 0.20, 0.26),                      // 收纳盒
      boxLid: new THREE.BoxGeometry(0.35, 0.03, 0.27),
    };

    const kinds = ['bag', 'books', 'vase', 'box'];
    const perLevel = Math.max(1, Math.round(bays / 2));
    for (let li = 0; li < deckTopYs.length; li++) {
      const yTop = deckTopYs[li];
      const count = 1 + Math.floor(rand() * perLevel);
      for (let c = 0; c < count; c++) {
        const kind = kinds[Math.floor(rand() * kinds.length)];
        const bay = Math.floor(rand() * bays);
        const cx = x0 + bay * bayWidths[bay] + bayWidths[bay] / 2 + (rand() - 0.5) * (bayWidths[bay] - 0.42);
        const cz = (rand() - 0.5) * (DEPTH - 0.34);
        const mat = propMatSets[kind][Math.floor(rand() * propMatSets[kind].length)];
        if (kind === 'bag') {
          const g = new THREE.Group();
          const body = new THREE.Mesh(geoms.bag, mat);
          body.position.y = 0.20;
          const flap = new THREE.Mesh(geoms.bagFlap, mat);
          flap.position.set(0, 0.34, 0.005);
          g.add(body, flap);
          g.position.set(cx, yTop, cz);
          g.rotation.y = (rand() - 0.5) * 0.6;
          propsGroup.add(g);
        } else if (kind === 'books') {
          const g = new THREE.Group();
          const nBooks = 2 + Math.floor(rand() * 3);
          let y = 0;
          for (let bi2 = 0; bi2 < nBooks; bi2++) {
            const m = new THREE.Mesh(geoms.books, mat);
            m.position.set((rand() - 0.5) * 0.03, y + 0.025, (rand() - 0.5) * 0.02);
            m.rotation.y = (rand() - 0.5) * 0.24;
            y += 0.05;
            g.add(m);
          }
          g.position.set(cx, yTop, cz);
          propsGroup.add(g);
        } else if (kind === 'vase') {
          const g = new THREE.Group();
          const v = new THREE.Mesh(geoms.vase, mat);
          v.position.y = 0.12;
          g.add(v);
          g.position.set(cx, yTop, cz);
          propsGroup.add(g);
        } else {
          const g = new THREE.Group();
          const body = new THREE.Mesh(geoms.box, mat);
          body.position.y = 0.10;
          const lid = new THREE.Mesh(geoms.boxLid, mat);
          lid.position.y = 0.215;
          g.add(body, lid);
          g.position.set(cx, yTop, cz);
          g.rotation.y = (rand() - 0.5) * 0.4;
          propsGroup.add(g);
        }
      }
    }
    group.add(propsGroup);
  }
  groups.props = propsGroup;

  // ---- 入组 ----
  const layered = [
    ['posts', groups.posts],
    ['beamsB', groups.beamsB],
    ['beamsRail', groups.beamsRail],
    ['beamsSide', groups.beamsSide],
    ['deck', groups.deck],
    ['pane', groups.pane],
    ['panels', groups.panels],
    ['conn', groups.conn],
    ['bolts', groups.bolts],
    ['washers', groups.washers],
    ['pads', groups.pads],
    ['brkV', groups.brkV],
    ['brkH', groups.brkH],
    ['feet', groups.feet],
  ];
  for (const [name, mesh] of layered) {
    if (!mesh) continue;
    mesh.name = name;
    group.add(mesh);
  }

  // ---- 统计 ----
  const postLen = nPosts * H;
  const backBeamLen = nBeamRows * W;
  const railLen = railRows.reduce((a, [, w]) => a + w, 0);
  const sideBeamLen = nSideBeams * sideLen;
  const stripLenTotal = stripRows.length * stripLen;
  const panelLenTotal = panelRows.length * (LEVEL_PITCH - 0.05);
  // Preserve baseline procurement area; visual overlap does not alter purchasing.
  const paneArea = paneCells.reduce((a, [, , w]) => a + (w - .018) * paneDepth, 0);

  stats.profileLengthM = postLen + backBeamLen + railLen + sideBeamLen;
  stats.stripLengthM = stripLenTotal + panelLenTotal;
  const volAlu = postLen * postProf.area + (backBeamLen + railLen + sideBeamLen) * prof.area
    + stripLenTotal * DECK_STRIP.area + panelLenTotal * PANEL_RIB.area;
  stats.weightKg =
    volAlu * ALU_DENSITY +
    paneArea * PANE_THICKNESS * ACRYLIC_DENSITY +
    nNodes * CONN_MASS + nBrk * 0.02 + nPosts * FOOT_MASS;
  stats.partCount = nPosts + nBeamRows * bays + railRows.length + nSideBeams
    + stripRows.length + panelRows.length + paneCells.length
    + nNodes + nBrk * 2 + nPosts;

  // ---- 算料单 ----
  // len = 实际下料长（已按 beamCutLength 扣节点占位）；span = 名义净跨，两列同时输出可追溯
  const cutList = [];
  const addCut = (spec, section, len, qty, span = len) => {
    const prev = cutList.find(c => c.spec === spec && c.section === section && Math.abs(c.len - len) < 1e-6);
    if (prev) prev.qty += qty; else cutList.push({ spec, section, len, span, qty });
  };
  const postSec = `${postProf.w * 1000}×${postProf.h * 1000}`;
  const beamSec = `${prof.w * 1000}×${prof.h * 1000}`;
  addCut(postProf.label + ' 立柱', postSec, +H.toFixed(3), nPosts);
  for (let k = 0; k <= levels; k++) {
    for (let b = 0; b < bays; b++) {
      const span = +bayWidths[b].toFixed(3);
      addCut(series + ' 背横梁', beamSec, beamCutLength(span, postProf.w), 1, span);
    }
  }
  { // 前支撑梁（有层板的层每跨一根 + 顶行每跨一根）
    const railCuts = {};
    for (let k = 0; k < levels; k++) {
      if (decks[k] === 'none') continue;
      for (const w of bayWidths) railCuts[w.toFixed(3)] = (railCuts[w.toFixed(3)] || 0) + 1;
    }
    for (const w of bayWidths) railCuts[w.toFixed(3)] = (railCuts[w.toFixed(3)] || 0) + 1;
    for (const [span, qty] of Object.entries(railCuts)) {
      addCut(series + ' 前支撑梁', beamSec, beamCutLength(+span, postProf.w), qty, +span);
    }
  }
  addCut(series + ' 侧横梁', beamSec, +(sideLen - 2 * JOINT_GAP).toFixed(3), nSideBeams, +sideLen.toFixed(3));
  if (stripRows.length) addCut('型材层板条', '24×16', +stripLen.toFixed(3), stripRows.length);
  if (panelMesh) addCut('侧板条', '24×8', +(LEVEL_PITCH - 0.05).toFixed(3), panelRows.length);
  const hw = [
    { name: '压铸角件 26mm（前后节点）', qty: nNodes },
    { name: 'M8×12 T 螺栓+螺母', qty: nNodes * 2 },
    { name: '悬挑托架（竖板+托舌）', qty: nBrk * 2 },
    { name: '可调支脚 M10', qty: nPosts },
  ];
  if (paneCells.length) hw.push({ name: '亚克力支撑卡扣', qty: paneCells.length * 4 });

  stats.cutList = cutList;
  stats.hardware = hw;
  stats.paneCells = paneCells.length;
  // 板件清单（比价引擎按 areaM2 × 每平米参考价计价）
  stats.panes = paneCells.length
    ? [{ label: '磨砂亚克力层板', areaM2: +paneArea.toFixed(3), kind: 'acrylic' }]
    : [];

  function dispose() {
    for (const [, mesh] of layered) {
      if (!mesh) continue;
      group.remove(mesh);
      mesh.geometry.dispose();
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) mat.dispose();
    }
    if (propsGroup) {
      propsGroup.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      group.remove(propsGroup);
    }
  }

  return { group, dispose, stats, groups, bounds: { W, H, D: DEPTH, nodeTarget: new THREE.Vector3(x0 + .016, .02 + Math.max(0, decks.findIndex((d,k)=>k>0 && d!=='none')) * LEVEL_PITCH, zPost) }, config: cfg };
}

