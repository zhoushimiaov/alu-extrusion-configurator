// 光轴书架参数化装配（Villa Medici 阅读装置：可移动展示塔 + 阅读长桌）
//
// 坐标系：X = 宽度，Y = 高度，Z = 深度（前后 ±D/2），产品整体居中于原点
//
// 展示塔 tower：
//   铬管立柱（每跨边界前后各一，顶部出头）+ 每层前后横杆
//   + 斜面展板（下沿前横杆、上沿后横杆，前挡唇；可选亚克力前挡）
//   + 每跨每层交叉拉索 + 木箱脚轮基座（或调平地脚）
// 阅读长桌 table：
//   木台面 + 可选玻璃副层板（standoff 支撑）+ 光轴桌腿（每节边界前后各一）
//   + 底部前后横杆 + 每节中部横杆
import * as THREE from 'three';
import { computeEnvelope } from './envelope.js';
import {
  PANEL_MATERIALS, FRAME_COLORS, DEFAULT_BOOKSHELF_CONFIG,
} from '../config/bookshelf.js';
import { getRodMaterials } from './materials.js';
import { getSpangleTexture } from './spangleTexture.js';
import { buildCasters, buildLevelFeet, outwardYaw } from './casters.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

function setMT(i, mesh, x, y, z, sx = 1, sy = 1, sz = 1) {
  _q.identity();
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m4.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m4);
}

// 任意两点间圆杆（拉索/斜杆）：位置取中点，四元数对齐方向
function setDir(i, mesh, ax, ay, az, bx, by, bz, r) {
  _dir.set(bx - ax, by - ay, bz - az);
  const len = _dir.length();
  _q.setFromUnitVectors(UP, _dir.clone().normalize());
  _p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  _s.set(r, len, r);
  _m4.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m4);
}

function instanced(geo, mat, count) {
  return count > 0 ? new THREE.InstancedMesh(geo, Array.isArray(mat) ? mat.map(m => m.clone()) : mat.clone(), count) : null;
}

const STEEL_DENSITY = 7850;  // 铬管钢 kg/m3
const MDF_DENSITY = 9.5;     // 展板密度 kg/m3（约 12mm 板）
const WOOD_DENSITY = 8.2;    // 木箱基座 kg/m3
const GLASS_DENSITY = 2500;   // 钢化玻璃密度 kg/m3
const ALU_DENSITY = 2700;    // 铝合金五金件密度 kg/m3

export function buildBookshelf(config) {
  const cfg = { ...DEFAULT_BOOKSHELF_CONFIG, ...config };
  const mat = getRodMaterials(cfg.color);

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [], panes: [] };
  let rodLen = 0;        // 光轴总长（管件累计）
  let steelVol = 0;      // 钢材体积 m3
  let boardArea = 0;     // 展板面积 m2
  let woodVol = 0;       // 木材体积 m3
  let glassWeight = 0;   // 玻璃总重 kg
  let bracketWeight = 0; // 斜层板托臂总重 kg
  let standoffWeight = 0; // 亚克力standoff总重 kg
  let partCount = 0;

  const railGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  railGeo.rotateZ(Math.PI / 2); // X 向杆
  const railZGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  railZGeo.rotateX(Math.PI / 2); // Z 向杆
  const strutGeo = new THREE.CylinderGeometry(1, 1, 1, 10); // 任意方向（拉索/斜杆，用 setDir）
  const postR = 0.009, railR = 0.006, wireR = 0.0012;

  if (cfg.style === 'table') {
    // ================ 阅读长桌 ================
    const W = cfg.tBays * cfg.tBayW;
    const D = cfg.depth + 0.3;
    const tableH = 0.88;
    const legR = 0.009;

    // 木台面
    const topGeo = new THREE.BoxGeometry(W + 0.06, 0.028, D + 0.04);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.65, metalness: 0.02 });
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = tableH - 0.014;
    group.add(top);
    groups.tableTop = top;
    // 面板的前后实木封边采用薄于台面厚度的细线条，非悬浮饰件。
    const edgeVeneerMat = new THREE.MeshStandardMaterial({color:0xb8a997,roughness:0.7});
    const edgeVeneerGeo = new THREE.BoxGeometry(W+0.06,0.005,0.003);
    const edgeVeneers=instanced(edgeVeneerGeo,edgeVeneerMat,2);
    for(let i=0;i<2;i++)setMT(i,edgeVeneers,0,tableH-0.014,
      (i?-1:1)*((D+0.04)/2-0.0015));
    group.add(edgeVeneers);
    groups.tableEdgeBand=edgeVeneers;
    woodVol += (W + 0.06) * (D + 0.04) * 0.028;
    stats.cutList.push({ spec: '长桌台面（实木拼板）', section: '板',
      len: +(W + 0.06).toFixed(3), width:+(D+0.04).toFixed(3),
      thickness:0.028,qty:1 });

    // 玻璃副层板 + standoff
    if (cfg.glassTop !== false) {
      const glassGeo = new THREE.BoxGeometry(W - 0.04, 0.008, D - 0.02);
      const glassMat=mat.acrylicClear.clone();
      glassMat.color.setHex(0xcad8de);
      glassMat.transmission=0.24;
      glassMat.roughness=0.30;
      glassMat.transparent=true;
      glassMat.opacity=0.85;
      glassMat.depthWrite=true;
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = tableH + 0.1;
      group.add(glass);
      groups.tableGlass=glass;
      const glassArea = (W - 0.04) * (D - 0.02);
      glassWeight = glassArea * 0.008 * GLASS_DENSITY;
      stats.cutList.push({ spec: '玻璃副层板 8mm', section: '板',
        len:+(W-0.04).toFixed(3),width:+(D-0.02).toFixed(3),thickness:0.008,
        qty:1,pricedViaPane:true });
      stats.panes.push({ label: '玻璃副层板（8mm）', areaM2: +glassArea.toFixed(3), kind: 'glass' });
      // 默认三跨桌固定八个支点：保留支柱在玻璃内侧的安全边距，
      // 点位只由台面宽度锁定，不随下部框架重建而重排。
      // 支撑上沿0.094、减震垫0.094~0.096、玻璃底面0.096，严格连续接触。
      const glassSupportXs=[-W/2+0.035,-W/6,W/6,W/2-0.035];
      const glassSupportZs=[D/2-0.045,-D/2+0.045];
      const nStand=glassSupportXs.length*2;
      const standGeo=new THREE.CylinderGeometry(0.005,0.005,0.094,12);
      const stands=instanced(standGeo,mat.block,nStand);
      const padGeo=new THREE.CylinderGeometry(0.011,0.011,0.002,16);
      const padMat=new THREE.MeshStandardMaterial({color:0xb1bdc2,roughness:0.82,metalness:0.03,transparent:true,opacity:0.8});
      const standPads=instanced(padGeo,padMat,nStand);
      const headGeo=new THREE.CylinderGeometry(0.012,0.012,0.004,16);
      const heads=instanced(headGeo,mat.block,nStand);
      let si=0;
      for(const x of glassSupportXs){
        for(const z of glassSupportZs){
          setMT(si,stands,x,tableH+0.047,z);
          setMT(si,standPads,x,tableH+0.095,z);
          setMT(si,heads,x,tableH+0.002,z);
          si++;
        }
      }
      group.add(stands,standPads,heads);
      groups.tableGlassStandoffs=stands;
      groups.tableGlassPads=standPads;
      groups.tableStandoffFeet=heads;
      partCount+=3*nStand;
      const standVol = nStand * Math.PI * 0.005 * 0.005 * 0.094;
      const headVol = nStand * Math.PI * 0.012 * 0.012 * 0.004;
      steelVol += standVol + headVol;
      stats.hardware.push(
        {name:'玻璃副层板支承立柱 Ø10 ×94mm',qty:nStand},
        {name:'玻璃端座/金属帽',qty:nStand},
        {name:'玻璃隔振垫 2mm',qty:nStand},
      );
    }

    // 桌腿：每节边界前后各一。外圈腿轴线内收到固定玻璃支点，
    // 中间跨边界保持原位，从而上下连续传力且不移动玻璃支点。
    const bndXs = [];
    for (let b = 0; b <= cfg.tBays; b++) {
      const rawX = -W / 2 + b * cfg.tBayW;
      bndXs.push(b === 0 ? -W / 2 + 0.035
        : b === cfg.tBays ? W / 2 - 0.035 : rawX);
    }
    const legs = instanced(strutGeo, mat.rod, bndXs.length * 2);
    let li = 0;
    const legLen = tableH - 0.02;
    const legZ = D / 2 - 0.045;
    for (const x of bndXs) {
      setDir(li++, legs, x, 0.015, legZ, x, legLen, legZ, legR);
      setDir(li++, legs, x, 0.015, -legZ, x, legLen, -legZ, legR);
      rodLen += legLen * 2;
      steelVol += Math.PI * legR * legR * legLen * 2;
      stats.cutList.push({ spec: '光轴桌腿 ⌀18', section: '18', len: +legLen.toFixed(3), qty: 2 });
    }
    partCount += li;
    group.add(legs);

    // 顶板底面增加两根通长连续承托光轴：杆顶实际接触木板底面，
    // 上端与每节竖直光轴柱交汇，不再靠一整块木台面独自悬在立柱上。
    const topUnderRails=instanced(railGeo,mat.rod,2);
    for(let i=0;i<2;i++)setMT(i,topUnderRails,0,tableH-0.034,
      (i?-1:1)*legZ,W,railR,railR);
    group.add(topUnderRails);
    groups.tableUnderRails=topUnderRails;
    partCount+=2;
    rodLen+=2*W;
    steelVol+=Math.PI*railR*railR*2*W;
    stats.cutList.push({spec:'阅读长桌台面承托光轴 Ø12',section:'⌀12',len:+W.toFixed(3),qty:2});
    // 真正连续的光轴框架：上下两档均是前后各一根 X 向通长杆，
    // 所有跨中立柱穿过完整横杆，杜绝 10mm/20mm 分段断口悬空。
    const jointZ=[legZ,-legZ];
    const railLevels=[0.10,0.42];
    const nRails=jointZ.length*railLevels.length;
    const rails=instanced(railGeo,mat.rod,nRails);
    let ri=0;
    for(const y of railLevels)for(const z of jointZ)
      setMT(ri++,rails,0,y,z,W+0.026,railR,railR);
    group.add(rails);
    groups.tableContinuousRails=rails;
    rodLen+=nRails*(W+0.026);
    steelVol+=Math.PI*railR*railR*nRails*(W+0.026);
    partCount+=nRails;

    // 每条立柱线在底部、中部各一根 Z 向贯通拉杆，接成四边形框架，
    // 两端原本只有各一根短Z杆，内侧桌腿没有进深连接，视觉与结构都松散。
    const nTies=bndXs.length*railLevels.length;
    const ties=instanced(railZGeo,mat.rod,nTies);
    let ti=0;
    for(const y of railLevels)for(const x of bndXs)
      setMT(ti++,ties,x,y,0,railR,railR,D-0.06);
    group.add(ties);
    groups.tableDepthTies=ties;
    rodLen+=nTies*(D-0.06);
    steelVol+=Math.PI*railR*railR*nTies*(D-0.06);
    partCount+=nTies;

    // 三个标高的金属立柱穿轴抱箍：底部0.10m、中间0.42m、台面下0.846m。
    // Ø30×26mm比18mm光轴外径大6mm，包络同时与X、Z横杆实际相交。
    const nLegPoints=bndXs.length*2;
    const collarGeo=new THREE.CylinderGeometry(0.015,0.015,0.026,18);
    const collars=instanced(collarGeo,mat.blockAlu||mat.block,nLegPoints*3);
    let ci=0;
    for(const y of [...railLevels,tableH-0.034])for(const x of bndXs)
      for(const z of jointZ)setMT(ci++,collars,x,y,z);
    group.add(collars);
    groups.tableJointCollars=collars;
    partCount+=ci;
    stats.hardware.push({name:'光轴穿杆三向金属连接抱箍 Ø30',qty:ci});

    // 每个光轴腿根部有真实可见的可调地脚圆盘，最低点离地0.002m。
    const feet=instanced(new THREE.CylinderGeometry(0.022,0.022,0.014,18),
      mat.blockAlu||mat.block,nLegPoints);
    let fti=0;
    for(const x of bndXs)for(const z of jointZ)setMT(fti++,feet,x,0.009,z);
    group.add(feet);
    groups.tableLevelFeet=feet;
    partCount+=fti;
    stats.hardware.push({name:'阅读长桌调平脚垫 Ø44',qty:fti});

    // 台面托片不能只停留在杆上：圆垫顶面严格接触28mm木台面底面。
    const footGeo=new THREE.CylinderGeometry(0.018,0.018,0.006,16);
    const footClips=instanced(footGeo,mat.block,nLegPoints);
    let fi=0;
    for(const x of bndXs)for(const z of jointZ)
      setMT(fi++,footClips,x,tableH-0.031,z);
    group.add(footClips);
    groups.tableTopJoints=footClips;
    partCount+=fi;
    stats.hardware.push({name:'台面承托连接座 Ø36',qty:fi});

    stats.cutList.push(
      {spec:'底层/中层横向连续光轴 ⌀12',section:'⌀12',len:+(W+0.026).toFixed(3),qty:nRails},
      {spec:'底层/中层进深贯通拉杆 ⌀12',section:'⌀12',len:+(D-0.06).toFixed(3),qty:nTies},
    );

    // 支撑点标记数据（TABLE-01）：与真实脚垫点位完全一致
    stats.supports = {
      kind: 'feet',
      points: bndXs.flatMap(x => jointZ.map(z => [x, 0, z])),
    };
  } else {
    // ================ 展示塔 ================
    const W = cfg.bays * cfg.bayW;
    const D = cfg.depth;
    const pitch = 0.40;
    const boxH = cfg.base ? 0.16 : 0;
    const baseY0 = cfg.base ? 0.05 : 0.02;
    const postBase = baseY0 + boxH;
    const frameH = cfg.levels * pitch;
    const postTop = postBase + frameH + 0.07; // 立柱顶部出头
    const tiltRad = (cfg.tilt * Math.PI) / 180;
    const dz = D - 0.055;
    const dy = dz * Math.tan(tiltRad);
    const len = Math.hypot(dy, dz);

    // ---- 立柱：每跨边界前后各一，顶部出头 ----
    const bndXs = [];
    for (let b = 0; b <= cfg.bays; b++) bndXs.push(-W / 2 + b * cfg.bayW);
    const postLen = postTop - postBase;
    const posts = instanced(strutGeo, mat.rod, bndXs.length * 2);
    let pi = 0;
    for (const x of bndXs) {
      setDir(pi++, posts, x, postBase, D / 2, x, postTop, D / 2, postR);
      setDir(pi++, posts, x, postBase, -D / 2, x, postTop, -D / 2, postR);
      rodLen += postLen * 2;
      steelVol += Math.PI * postR * postR * postLen * 2;
    }
    stats.cutList.push({ spec: '光轴立柱 ⌀18', section: '18', len: +postLen.toFixed(3), qty: bndXs.length * 2 });
    partCount += pi;
    group.add(posts);
    groups.posts = posts;

    // ---- 每层横杆：前低杆 / 后高杆（每跨分段）+ 顶层后杆 ----
    const railSegs = [];
    for (let i = 0; i < cfg.levels; i++) {
      const yLow = postBase + i * pitch + 0.04;
      const yHigh = yLow + dy + 0.024;
      for (let b = 0; b < cfg.bays; b++) {
        const x0 = bndXs[b], x1 = bndXs[b + 1];
        railSegs.push([x0, yLow, D / 2, x1, yLow, D / 2]);
        railSegs.push([x0, yHigh, -D / 2, x1, yHigh, -D / 2]);
      }
    }
    // 顶档只需补前杆：最顶层的后高杆已经位于 postBase+frameH、Z=-D/2。
    // 以前重复生成同一根顶后杆，带来 z-fighting、重复杆长和重复夹箍判定。
    for (let b = 0; b < cfg.bays; b++) {
      const x0 = bndXs[b], x1 = bndXs[b + 1];
      railSegs.push([x0, postBase + frameH, D / 2, x1, postBase + frameH, D / 2]);
    }
    // 塔式横杆全部为 X 向平行杆：railGeo 长度轴在局部 X，直接定长缩放
    // （此前误用 setDir——预旋转几何的长度轴在局部 X，len 被乘到半径轴上，
    //   渲染成 6mm 长 × 2m 直径的巨管横贯画面）
    const rails = instanced(railGeo, mat.rod, railSegs.length);
    railSegs.forEach((sg, i) => {
      const segLen = Math.abs(sg[3] - sg[0]);
      setMT(i, rails, (sg[0] + sg[3]) / 2, sg[1], sg[2], segLen, railR, railR);
      rodLen += segLen;
      steelVol += Math.PI * railR * railR * segLen;
    });
    stats.cutList.push({ spec: '光轴横杆 ⌀12', section: '12', len: +(cfg.bayW - 0.002).toFixed(3), qty: railSegs.length });
    partCount += railSegs.length;
    group.add(rails);
    groups.rails = rails;

    // ---- P2：真实节点语义：银色立柱抱箍，而不是覆盖整根柱子的 30mm 黑方块 ----
    // 开口金属抱箍，内部原有的 ⌀18 竖杆可以透过端面看到。
    // 同一坐标可能被相邻两跨/顶层前后杆重复引用，需去重避免夹块叠面。
    const clampNodes = new Map();
    const addClampNode = (x, y, z) => {
      clampNodes.set([x, y, z].map(v => v.toFixed(4)).join(':'), [x, y, z]);
    };
    railSegs.forEach((sg) => {
      addClampNode(sg[0], sg[1], sg[2]);
      addClampNode(sg[3], sg[4], sg[5]);
    });
    const clampPositions = [...clampNodes.values()];
    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x939da4, metalness: 0.86, roughness: 0.29,
    });
    const collarGeometry = () => new THREE.CylinderGeometry(0.013, 0.013, 0.024, 16, 1, true);
    const clamps = instanced(collarGeometry(), jointMaterial, clampPositions.length);
    clampPositions.forEach(([x, y, z], i) => setMT(i, clamps, x, y, z));
    group.add(clamps);
    groups.clamps = clamps;
    partCount += clampPositions.length;
    stats.hardware.push({ name: '竖向光轴金属抱箍', qty: clampPositions.length });

    // ---- joint：立柱顶端球头端帽（参考照片的圆头出头）----
    const capGeo = new THREE.SphereGeometry(0.014, 12, 10);
    const caps = instanced(capGeo, mat.rod, bndXs.length * 2);
    let capi = 0;
    for (const x of bndXs) {
      setMT(capi++, caps, x, postTop, D / 2, 1, 1, 1);
      setMT(capi++, caps, x, postTop, -D / 2, 1, 1, 1);
    }
    group.add(caps);
    groups.caps = caps;
    partCount += capi;
    stats.hardware.push({ name: '立柱球头端帽', qty: capi });

    // ---- 斜面展板 + 前挡唇（+ 亚克力前挡）----
    const panelCfg = PANEL_MATERIALS[cfg.panelMat] || PANEL_MATERIALS.gray;
    const panelMat = new THREE.MeshStandardMaterial({ color: panelCfg.hex, roughness: panelCfg.roughness, metalness: panelCfg.metalness });
    if (panelCfg.spangle) {
      panelMat.color.set(0xffffff); // 纹理灰度已按实拍标定
      const tex = getSpangleTexture().clone();
      tex.repeat.set(3, 1); // 展板约 1m × 0.33m → 锌花约 1cm（与型材架背板同密度）
      tex.needsUpdate = true;
      panelMat.map = tex;
    }
    const nPanels = cfg.levels * cfg.bays;
    const panelGeo = new THREE.BoxGeometry(1, 1, 0.014);
    const panels = instanced(panelGeo, panelMat, nPanels);
    const lipTangentThickness = 0.012;
    const lipNormalHeight = 0.028;
    const lipGeo = new THREE.BoxGeometry(1, lipTangentThickness, lipNormalHeight);
    const lips = instanced(lipGeo, panelMat, nPanels);
    const panelPlacements = []; // 与层板同源的书本摆放姿态，避免各自计算造成角度偏差
    let bi = 0;
    for (let i = 0; i < cfg.levels; i++) {
      const yLow = postBase + i * pitch + 0.04;
      const yHigh = yLow + dy + 0.024;
      for (let b = 0; b < cfg.bays; b++) {
        const cx = (bndXs[b] + bndXs[b + 1]) / 2;
        const w = cfg.bayW - 0.05;
        // 板：下沿在前横杆上方，上沿靠后横杆下方
        const yb = yLow + 0.012, zb = D / 2 - 0.025;
        const yt = yHigh - 0.012, zt = -D / 2 + 0.03;
        // 旋转：BoxGeometry 的长度轴为 Y，绕 X 轴旋转 θ 后 Y 轴指向 (0, cosθ, -sinθ)
        // 需要 Y 轴对齐 (0, dy, -dz)/len → θ = atan2(dz, dy)
        _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan2(-dz, dy));
        _p.set(cx, (yb + yt) / 2, (zb + zt) / 2);
        _s.set(w, len, 1);
        _m4.compose(_p, _q, _s);
        panels.setMatrixAt(bi, _m4);
        // 层板局部 XY 平面旋转后的坡向与正面法线（单位向量）。
        panelPlacements.push({
          cx, level: i, bay: b,
          center: _p.clone(),
          rotation: _q.clone(),
          width: w,
          length: len,
          tangent: new THREE.Vector3(0, dy / len, -dz / len),
          normal: new THREE.Vector3(0, dz / len, dy / len),
        });
        // 前挡唇：竖向小条贴在板下沿前方
        // 直接从真实层板的坡向/法线推导，绝不使用独立的“层高 + 经验角度”。
        // 切向中心在 -len/2 - lipTangentThickness/2，法向中心对齐层板半厚 0.014/2，
        // 形成完全贴合前端面的无穿透面接触（法向覆盖层板厚并凸出14mm作为挡书边唇）
        const lipTangentOffset = -len / 2 - lipTangentThickness / 2;
        const lipNormalOffset = 0.014 / 2;
        const lipPos = _p.clone()
          .addScaledVector(new THREE.Vector3(0, dy / len, -dz / len), lipTangentOffset)
          .addScaledVector(new THREE.Vector3(0, dz / len, dy / len), lipNormalOffset);
        _m4.compose(lipPos, _q, _s.set(w, 1, 1));
        lips.setMatrixAt(bi, _m4);
        boardArea += w * len;
        partCount += 2;
        bi++;
      }
    }
    group.add(panels);
    group.add(lips);
    groups.panels = panels;
    groups.lips = lips;

    // ---- P1：斜层板侧向光轴支承 ----
    // 每跨左右斜撑外挂于立柱外侧30mm，轴心位于板下表面下7mm（杆半径5mm + 2mm净距）。
    // 其两端与前后整根 X 向贯穿横杆在同一个 Y/Z 平面交汇。
    // 斜撑外挂在每跨边界立柱外侧，而非藏在跨内。
    // 每层前、后各一整根杆，跨数变化时仍是连续的一根而非节点拼接件。
    // 斜杆端的转接抱箍沿杆轴线套入；贯穿横杆则由立柱金属抱箍固定。
    // 从斜板中心出发，沿坡向延长到前后节点 Z 截面，保证斜撑始终与斜板平行。
    // 杆中心在整架的 X=0 位置：左右各外伸100mm，穿过所有立柱与外挂斜撑接头。
    // 与原横杆抱箍位置近乎重合的节点不再重复套筒；贯穿横杆在各柱心处抱紧。
    const diagRadius = 0.005;
    const stubRadius = 0.0055;
    const outerOffset = 0.03; // 立柱轴线到外挂斜撑轴线：30mm
    const rodOverhang = 0.10; // 每层贯穿横杆在最外侧立柱外各伸出100mm
    const throughRodLength = W + rodOverhang * 2;
    const normalClearance = 0.014 / 2 + diagRadius + 0.002;
    const zFrontJoint = D / 2 - 0.004;
    const zBackJoint = -D / 2 + 0.004;
    const sideDiagSupports = instanced(strutGeo, mat.rod, nPanels * 2);
    const sideStubSupports = instanced(railGeo, mat.rod, cfg.levels * 2);
    const sideDiagCouplers = instanced(strutGeo, jointMaterial, nPanels * 4);
    const endpointsOf = (panel) => {
      const axisCenter = panel.center.clone().addScaledVector(panel.normal, -normalClearance);
      const atZ = z => axisCenter.clone().addScaledVector(
        panel.tangent, (z - axisCenter.z) / panel.tangent.z,
      );
      return [atZ(zFrontJoint), atZ(zBackJoint)];
    };
    let di = 0;
    let couplingIndex = 0;
    let sideDiagLen = 0;
    for (const panel of panelPlacements) {
      const [front, back] = endpointsOf(panel);
      const slope = back.clone().sub(front).normalize();
      const sleeveHalfLen = 0.011;
      for (const x of [bndXs[panel.bay] - outerOffset, bndXs[panel.bay + 1] + outerOffset]) {
        setDir(di++, sideDiagSupports, x, front.y, front.z, x, back.y, back.z, diagRadius);
        for (const endpoint of [front, back]) {
          const a = endpoint.clone().addScaledVector(slope, -sleeveHalfLen);
          const b = endpoint.clone().addScaledVector(slope, sleeveHalfLen);
          setDir(couplingIndex++, sideDiagCouplers, x, a.y, a.z, x, b.y, b.z, 0.008);
        }
        sideDiagLen += front.distanceTo(back);
      }
    }
    let si = 0;
    for (let i = 0; i < cfg.levels; i++) {
      const [front, back] = endpointsOf(panelPlacements[i * cfg.bays]);
      for (const p of [front, back]) {
        setMT(si++, sideStubSupports, 0, p.y, p.z, throughRodLength, stubRadius, stubRadius);
      }
    }

    const sideCollarPoints = [];
    const isNearbyCollar = (a, b) =>
      Math.abs(a[0] - b[0]) < 0.001 &&
      Math.abs(a[1] - b[1]) < 0.018 &&
      Math.abs(a[2] - b[2]) < 0.012;
    for (let i = 0; i < cfg.levels; i++) {
      const [front, back] = endpointsOf(panelPlacements[i * cfg.bays]);
      for (const x of bndXs) {
        for (const p of [front, back]) {
          const candidate = [x, p.y, p.z];
          if (![...clampPositions, ...sideCollarPoints].some(c => isNearbyCollar(candidate, c))) {
            sideCollarPoints.push(candidate);
          }
        }
      }
    }
    const sidePostCollars = sideCollarPoints.length
      ? instanced(collarGeometry(), jointMaterial, sideCollarPoints.length) : null;
    sideCollarPoints.forEach(([x, y, z], i) => setMT(i, sidePostCollars, x, y, z));

    // 层板承托托臂（BOOK-01）：将有限层板下表面桥接到外挂斜撑
    // 80mm 宽铝合金承托托臂（厚14mm、沿坡向深30mm），从外挂斜撑中心延伸至板底边缘内侧
    const bracketWidth = 0.080;
    const bracketTangentLen = 0.030;
    const bracketNormalThick = 0.014;
    const bracketGeo = new THREE.BoxGeometry(bracketWidth, bracketTangentLen, bracketNormalThick);
    const shelfBrackets = instanced(bracketGeo, mat.blockAlu || mat.block, nPanels * 4);
    let bki = 0;
    for (const panel of panelPlacements) {
      const leftBraceX = bndXs[panel.bay] - outerOffset;
      const rightBraceX = bndXs[panel.bay + 1] + outerOffset;
      const leftPanelEdgeX = bndXs[panel.bay] + 0.025;
      const rightPanelEdgeX = bndXs[panel.bay + 1] - 0.025;
      const leftBracketX = (leftBraceX + leftPanelEdgeX) / 2;
      const rightBracketX = (rightBraceX + rightPanelEdgeX) / 2;

      for (const bx of [leftBracketX, rightBracketX]) {
        for (const tFrac of [-0.28, 0.28]) {
          // 法向中心设在 -bracketNormalThick (-0.014)，上表面对齐板底 -0.007，底面及中心完全包裹斜撑圆杆（轴心位于 -0.014）
          const bPos = panel.center.clone()
            .addScaledVector(panel.tangent, tFrac * panel.length)
            .addScaledVector(panel.normal, -bracketNormalThick);
          bPos.x = bx;
          _s.set(1, 1, 1);
          _m4.compose(bPos, panel.rotation, _s);
          shelfBrackets.setMatrixAt(bki++, _m4);
        }
      }
    }
    group.add(shelfBrackets);
    groups.shelfBrackets = shelfBrackets;
    partCount += nPanels * 4;
    stats.hardware.push({ name: '斜层板承托托臂', qty: nPanels * 4 });
    const bracketVol = (nPanels * 4) * bracketWidth * bracketTangentLen * bracketNormalThick;
    bracketWeight = bracketVol * ALU_DENSITY;

    group.add(sideDiagSupports, sideStubSupports, sideDiagCouplers);
    if (sidePostCollars) group.add(sidePostCollars);
    groups.sideDiagSupports = sideDiagSupports;
    groups.sideStubSupports = sideStubSupports; // 保留已有引用名
    groups.sideThroughSupports = sideStubSupports;
    groups.sideDiagCouplers = sideDiagCouplers;
    groups.sidePostCollars = sidePostCollars;
    partCount += di + si + couplingIndex + sideCollarPoints.length;
    stats.hardware.push(
      { name: '斜撑杆端金属转接套', qty: couplingIndex },
      { name: '贯穿横杆立柱抱箍', qty: sideCollarPoints.length },
    );
    rodLen += sideDiagLen + si * throughRodLength;
    steelVol += Math.PI * diagRadius * diagRadius * sideDiagLen
      + Math.PI * stubRadius * stubRadius * si * throughRodLength;
    stats.cutList.push(
      { spec: '斜层板侧托光轴 ⌀10', section: '⌀10', len: +(sideDiagLen / di).toFixed(3), qty: di },
      { spec: '前后贯穿横向光轴 ⌀11', section: '⌀11', len: +throughRodLength.toFixed(3), qty: si },
    );

    // ---- 样书：局部 XY 面必须与斜层板的局部 XY 面重合，厚度沿 Z 法线 ----
    if (cfg.books) {
      const bookColors = [0xb7c0c4, 0xd9cbb2, 0xc7a98d, 0x8f9a8c, 0xd6d2cb, 0xa8b0b8];
      const bookThickness = 0.018; // 18mm 的平铺样书；比层板薄
      const panelThickness = 0.014;
      const surfaceGap = 0.002; // 避免与斜面展板发生 z-fighting
      // 复用层板本身的倾斜旋转，不能将 XZ 面的书套用 XY 面的旋转。
      // 书中心在板长从前下沿起的28%处（原38%），靠近下部挡唇，仍不越出板边。
      // 书的下表面位于层板上表面之上 2mm；法线与层板始终一致。
      const booksGroup = new THREE.Group();
      booksGroup.name = 'displayBooks';
      booksGroup.userData.displayOnly = true;
      const bookGeo = new THREE.BoxGeometry(1, 1, 1);
      panelPlacements.forEach((panel, index) => {
        const bm = new THREE.MeshStandardMaterial({
          color: bookColors[index % bookColors.length], roughness: 0.8, metalness: 0.02,
        });
        const book = new THREE.Mesh(bookGeo, bm);
        book.name = `displayBook_${index}`;
        book.position.copy(panel.center)
          .addScaledVector(panel.tangent, -panel.length * 0.22)
          .addScaledVector(panel.normal, panelThickness / 2 + bookThickness / 2 + surfaceGap);
        book.quaternion.copy(panel.rotation);
        book.scale.set(panel.width * 0.66, panel.length * 0.5, bookThickness);
        booksGroup.add(book);
      });
      group.add(booksGroup);
      partCount += panelPlacements.length;
      groups.books = booksGroup;
    }
    stats.cutList.push({ spec: `斜面展板 ${panelCfg.label}`, section: '板', len: +(cfg.bayW - 0.05).toFixed(2), qty: nPanels, pricedViaPane: true });
    stats.panes = [{ label: `斜面展板 ${panelCfg.label}`, areaM2: +boardArea.toFixed(3), kind: 'board' }];

    // ---- 亚克力前挡 ----
    // （BOOK-02：具有足够净容纳厚度不穿书，且含两侧独立 standoff）
    if (cfg.acrylic) {
      const acrThickness = 0.005;
      const acrGeo = new THREE.BoxGeometry(1, 1, acrThickness);
      const acr = instanced(acrGeo, mat.acrylicClear, nPanels);
      // standoff 从层板前表面 (0.014/2 = 0.007) 延伸至亚克力后表面
      // 间隙包含 0.002 表面间隙 + 0.018 样书厚度 + 0.008 书前余量 = 0.028m
      const standoffLen = 0.028;
      const standoffRadius = 0.006;
      const standoffGeo = new THREE.CylinderGeometry(standoffRadius, standoffRadius, 1, 12);
      standoffGeo.rotateX(Math.PI / 2);
      const standoffs = instanced(standoffGeo, mat.blockAlu || mat.block, nPanels * 2);
      let ai = 0, soi = 0;
      const acrNormalOffset = 0.014 / 2 + standoffLen + acrThickness / 2; // = 0.0375
      const standoffNormalPos = 0.014 / 2 + standoffLen / 2; // = 0.021
      for (const panel of panelPlacements) {
        const acrCenter = panel.center.clone()
          .addScaledVector(panel.tangent, -panel.length * 0.20)
          .addScaledVector(panel.normal, acrNormalOffset);
        const acrLen = panel.length * 0.45;
        _s.set(panel.width - 0.02, acrLen, 1);
        _m4.compose(acrCenter, panel.rotation, _s);
        acr.setMatrixAt(ai++, _m4);

        // 真实支座 standoff：位于样书两侧（X 间距远避开样书，绝不穿书），两端分别严格贴合板前表面与亚克力后表面
        for (const sx of [-1, 1]) {
          const soPos = panel.center.clone()
            .addScaledVector(new THREE.Vector3(1, 0, 0), sx * (panel.width / 2 - 0.025))
            .addScaledVector(panel.tangent, -panel.length * 0.20)
            .addScaledVector(panel.normal, standoffNormalPos);
          _s.set(1, 1, standoffLen);
          _m4.compose(soPos, panel.rotation, _s);
          standoffs.setMatrixAt(soi++, _m4);
        }
      }
      group.add(acr, standoffs);
      groups.acrylic = acr;
      groups.acrylicStandoffs = standoffs;
      partCount += nPanels + nPanels * 2;
      stats.hardware.push({ name: '亚克力前挡（含 standoff）', qty: nPanels });
      const standoffVol = (nPanels * 2) * Math.PI * (standoffRadius ** 2) * standoffLen;
      standoffWeight = standoffVol * ALU_DENSITY;
    }

    // ---- 交叉拉索：布在每跨边界的侧面（前后立柱之间的窄面），防前后晃、不挡取书 ----
    // （此前误布在每跨正面，X 交叉正好横在斜面板前，书无法放入——用户实拍指出）
    if (cfg.wires) {
      const nWires = cfg.levels * (cfg.bays + 1) * 2;
      const wires = instanced(strutGeo, mat.rod, nWires);
      let wi = 0;
      const zF = D / 2 + 0.006, zB = -D / 2 - 0.006; // 拉索贴柱外侧，避免与立柱穿模
      for (let i = 0; i < cfg.levels; i++) {
        const y0 = postBase + i * pitch + 0.06;
        const y1 = postBase + (i + 1) * pitch;
        for (let b = 0; b <= cfg.bays; b++) {
          const x = bndXs[b];
          setDir(wi++, wires, x, y0, zF, x, y1, zB, wireR);
          setDir(wi++, wires, x, y0, zB, x, y1, zF, wireR);
          rodLen += Math.hypot(zF - zB, y1 - y0) * 2;
          partCount += 2;
        }
      }
      group.add(wires);
      groups.wires = wires;
      // X钢索对应精确切料长度与两个独立端部张紧件；不再只按“件”粗略估价。
      const cableLength = Math.hypot(zF - zB, pitch - 0.06);
      stats.cutList.push({
        spec: '侧面X拉索不锈钢丝绳 Ø2.4', section: '钢索Ø2.4',
        len: +cableLength.toFixed(3), qty: nWires,
      });
      steelVol += nWires * cableLength * Math.PI * wireR * wireR;
      // 两端小套筒与主体立柱重合于真实连接点；端件必须与采购件数一致。
      const ends = instanced(new THREE.CylinderGeometry(0.006, 0.006, 0.022, 10), mat.blockAlu, nWires * 2);
      let ei = 0;
      for (let i = 0; i < cfg.levels; i++) {
        const y0 = postBase + i * pitch + 0.06, y1 = postBase + (i + 1) * pitch;
        for (const x of bndXs) for (const yy of [y0,y1]) for (const zz of [zF,zB])
          setMT(ei++, ends, x, yy, zz);
      }
      group.add(ends);
      groups.wireEnds = ends;
      partCount += nWires * 2;
      stats.hardware.push({ name: 'X拉索张紧端件 Ø2.4', qty: nWires * 2 });
    }

    // ---- 基座：木箱 + 脚轮 / 调平地脚 ----
    if (cfg.base) {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.65, metalness: 0.02 });
      const boxGeo = new THREE.BoxGeometry(W + 0.04, boxH, D + 0.02);
      const box = new THREE.Mesh(boxGeo, woodMat);
      box.position.y = baseY0 + boxH / 2;
      group.add(box);
      woodVol += (W + 0.04) * (D + 0.02) * boxH;
      partCount++;
      stats.cutList.push({ spec: '木箱基座', section: '板', len: +(W + 0.04).toFixed(2), qty: 1 });
      stats.hardware.push({ name: '万向脚轮 1.5 寸（带刹车）', qty: 4 });
      // 木箱底四角低矮万向轮（安装面 = 木箱底面 baseY0）
      const pts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
        const x = sx * (W / 2 - 0.06), z = sz * (D / 2 - 0.04);
        return { x, z, yaw: outwardYaw(x, z, 'x') };
      }));
      const wheels = buildCasters(pts, { H: baseY0, wheelD: 0.034, wheelW: 0.015, trail: 0.01, mount: 'plate', plate: 0.036, brake: true, palette: 'black' });
      group.add(wheels);
      groups.wheels = wheels;
      const towerTrail = 0.01;
      stats.supports = {
        kind: 'casters',
        points: pts.map(p => [
          p.x - towerTrail * Math.cos(p.yaw || 0),
          0,
          p.z + towerTrail * Math.sin(p.yaw || 0)
        ]),
      };
      partCount += 4;
    } else {
      const feet = buildLevelFeet(bndXs.flatMap((x) => [{ x, z: D / 2 }, { x, z: -D / 2 }]), { H: baseY0, palette: cfg.color === 'black' ? 'black' : 'chrome' });
      const fi = bndXs.length * 2;
      group.add(feet);
      groups.feet = feet;
      partCount += fi;
      stats.supports = {
        kind: 'feet',
        points: bndXs.flatMap((x) => [D / 2, -D / 2].map((z) => [x, 0, z])),
      };
      stats.hardware.push({ name: '调平地脚', qty: fi });
    }
  }

  // ---- 统计 ----
  stats.profileLengthM = +rodLen.toFixed(1);
  stats.partCount = partCount;
  stats.weightKg = +(
    steelVol * STEEL_DENSITY
    + boardArea * MDF_DENSITY
    + woodVol * WOOD_DENSITY
    + bracketWeight + standoffWeight
    + (cfg.style === 'table' && cfg.glassTop !== false ? glassWeight : 0)
  ).toFixed(1);
  stats.envelope = computeEnvelope(group);
  return {
    group,
    groups,
    stats,
    bounds: stats.envelope,
    config: cfg,
    dispose() {
      group.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mm => mm?.dispose?.());
      });
      while (group.children.length) group.remove(group.children[0]);
    },
  };
}
