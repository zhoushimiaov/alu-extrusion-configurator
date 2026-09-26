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

export function buildBookshelf(config) {
  const cfg = { ...DEFAULT_BOOKSHELF_CONFIG, ...config };
  const mat = getRodMaterials(cfg.color);

  const group = new THREE.Group();
  const groups = {};
  const stats = { profileLengthM: 0, weightKg: 0, partCount: 0, cutList: [], hardware: [] };
  let rodLen = 0;        // 光轴总长（管件累计）
  let steelVol = 0;      // 钢材体积 m3
  let boardArea = 0;     // 展板面积 m2
  let woodVol = 0;       // 木材体积 m3
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
    const topGeo = new THREE.BoxGeometry(W + 0.06, 0.035, D + 0.04);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.65, metalness: 0.02 });
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = tableH - 0.0175;
    group.add(top);
    woodVol += (W + 0.06) * (D + 0.04) * 0.035;
    stats.cutList.push({ spec: '长桌台面（实木拼板）', section: '板', len: +(W + 0.06).toFixed(2), qty: cfg.tBays });

    // 玻璃副层板 + standoff
    if (cfg.glassTop !== false) {
      const glassGeo = new THREE.BoxGeometry(W - 0.04, 0.008, D - 0.02);
      const glass = new THREE.Mesh(glassGeo, mat.acrylicClear);
      glass.position.y = tableH + 0.1;
      group.add(glass);
      const nStand = Math.max(4, cfg.tBays * 2 + 2);
      const standGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.1, 10);
      const stands = instanced(standGeo, mat.block, nStand);
      let si = 0;
      for (let b = 0; b <= cfg.tBays; b++) {
        const x = -W / 2 + b * cfg.tBayW;
        if (b > 0 && b < cfg.tBays) {
          setMT(si++, stands, x, tableH + 0.05, D / 2 - 0.05);
          setMT(si++, stands, x, tableH + 0.05, -D / 2 + 0.05);
        }
      }
      setMT(si++, stands, -W / 2 + 0.05, tableH + 0.05, 0);
      setMT(si++, stands, W / 2 - 0.05, tableH + 0.05, 0);
      group.add(stands);
      partCount += si;
      stats.hardware.push({ name: '玻璃副层板 standoff 支撑', qty: si });
    }

    // 桌腿：每节边界前后各一
    const bndXs = [];
    for (let b = 0; b <= cfg.tBays; b++) bndXs.push(-W / 2 + b * cfg.tBayW);
    const legs = instanced(strutGeo, mat.rod, bndXs.length * 2);
    let li = 0;
    const legLen = tableH - 0.02;
    for (const x of bndXs) {
      setDir(li++, legs, x, 0.015, D / 2 - 0.03, x, legLen, D / 2 - 0.03, legR);
      setDir(li++, legs, x, 0.015, -D / 2 + 0.03, x, legLen, -D / 2 + 0.03, legR);
      rodLen += legLen * 2;
      steelVol += Math.PI * legR * legR * legLen * 2;
      stats.cutList.push({ spec: '光轴桌腿 ⌀18', section: '18', len: +legLen.toFixed(3), qty: 2 });
    }
    partCount += li;
    group.add(legs);

    // 底部前后横杆（通长）+ 每节中部横杆 + 端部 Z 向杆
    const nRails = 2 + 2 + cfg.tBays * 2 + 2;
    const rails = instanced(railGeo, mat.rod, nRails);
    let ri = 0;
    setMT(ri++, rails, 0, 0.10, D / 2 - 0.03, W, railR, railR);
    setMT(ri++, rails, 0, 0.10, -D / 2 + 0.03, W, railR, railR);
    rodLen += W * 2; steelVol += Math.PI * railR * railR * W * 2;
    for (let b = 0; b < cfg.tBays; b++) {
      const cx = -W / 2 + (b + 0.5) * cfg.tBayW;
      setMT(ri++, rails, cx, 0.42, D / 2 - 0.03, cfg.tBayW - 0.02, railR, railR);
      setMT(ri++, rails, cx, 0.42, -D / 2 + 0.03, cfg.tBayW - 0.02, railR, railR);
      rodLen += (cfg.tBayW - 0.02) * 2;
      steelVol += Math.PI * railR * railR * (cfg.tBayW - 0.02) * 2;
    }
    const zEnds = instanced(railZGeo, mat.rod, 2);
    setMT(0, zEnds, -W / 2, 0.10, 0, railR, railR, D - 0.06);
    setMT(1, zEnds, W / 2, 0.10, 0, railR, railR, D - 0.06);
    rodLen += (D - 0.06) * 2; steelVol += Math.PI * railR * railR * (D - 0.06) * 2;
    group.add(rails);
    group.add(zEnds);
    partCount += nRails + 2;
    stats.cutList.push({ spec: '光轴横杆 ⌀12', section: '12', len: +(cfg.tBayW - 0.02).toFixed(3), qty: cfg.tBays * 2 + 2 });

    stats.hardware.push({ name: '台面连接夹块', qty: bndXs.length * 2 });
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
      const yLow = postBase + i * pitch + 0.05;
      const yHigh = postBase + (i + 1) * pitch;
      for (let b = 0; b < cfg.bays; b++) {
        const x0 = bndXs[b], x1 = bndXs[b + 1];
        railSegs.push([x0, yLow, D / 2, x1, yLow, D / 2]);
        railSegs.push([x0, yHigh, -D / 2, x1, yHigh, -D / 2]);
      }
    }
    // 顶档前后杆
    for (let b = 0; b < cfg.bays; b++) {
      const x0 = bndXs[b], x1 = bndXs[b + 1];
      railSegs.push([x0, postBase + frameH, D / 2, x1, postBase + frameH, D / 2]);
      railSegs.push([x0, postBase + frameH, -D / 2, x1, postBase + frameH, -D / 2]);
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

    // ---- joint：每根横杆两端 T 型夹块（横杆抱住立柱的连接件）----
    const clampGeo = new THREE.BoxGeometry(0.028, 0.03, 0.03);
    const clamps = instanced(clampGeo, mat.block, railSegs.length * 2);
    let ci = 0;
    railSegs.forEach((sg) => {
      setMT(ci++, clamps, sg[0], sg[1], sg[2], 1, 1, 1);
      setMT(ci++, clamps, sg[3], sg[4], sg[5], 1, 1, 1);
    });
    group.add(clamps);
    groups.clamps = clamps;
    partCount += ci;
    stats.hardware.push({ name: 'T 型光轴夹块', qty: ci });

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
      const tex = getSpangleTexture().clone();
      tex.repeat.set(2, 1);
      tex.needsUpdate = true;
      panelMat.map = tex;
    }
    const nPanels = cfg.levels * cfg.bays;
    const panelGeo = new THREE.BoxGeometry(1, 1, 0.014);
    const panels = instanced(panelGeo, panelMat, nPanels);
    const lipGeo = new THREE.BoxGeometry(1, 0.03, 0.012);
    const lips = instanced(lipGeo, panelMat, nPanels);
    let bi = 0;
    for (let i = 0; i < cfg.levels; i++) {
      const yLow = postBase + i * pitch + 0.05;
      const yHigh = postBase + (i + 1) * pitch;
      for (let b = 0; b < cfg.bays; b++) {
        const cx = (bndXs[b] + bndXs[b + 1]) / 2;
        const w = cfg.bayW - 0.05;
        // 板：下沿在前横杆上方，上沿靠后横杆下方
        const yb = yLow + 0.012, zb = D / 2 - 0.025;
        const yt = yHigh - 0.012, zt = -D / 2 + 0.03;
        const dy = yt - yb, dz = zb - zt;
        const len = Math.hypot(dy, dz);
        setMT(bi, panels, cx, (yb + yt) / 2, (zb + zt) / 2, w, len, 1);
        // 旋转：BoxGeometry 的长度轴为 Y，绕 X 轴旋转 θ 后 Y 轴指向 (0, cosθ, -sinθ)
        // 需要 Y 轴对齐 (0, dy, -dz)/len → θ = atan2(dz, dy)
        _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan2(-dz, dy));
        _p.set(cx, (yb + yt) / 2, (zb + zt) / 2);
        _s.set(w, len, 1);
        _m4.compose(_p, _q, _s);
        panels.setMatrixAt(bi, _m4);
        // 前挡唇：竖向小条贴在板下沿前方
        setMT(bi, lips, cx, yb + 0.012, zb + 0.012, w - 0.004, 1, 1);
        boardArea += w * len;
        partCount += 2;
        bi++;
      }
    }
    group.add(panels);
    group.add(lips);
    groups.panels = panels;
    groups.lips = lips;

    // ---- 样书：每层斜面板上平躺一本大开本（跟随倾角，靠前挡唇）----
    if (cfg.books) {
      // 颜色池：低饱和杂志色
      const bookColors = [0xb7c0c4, 0xd9cbb2, 0xc7a98d, 0x8f9a8c, 0xd6d2cb, 0xa8b0b8];
      const nBooks = cfg.levels * cfg.bays;
      const bookGeo = new THREE.BoxGeometry(1, 0.03, 1);
      // 每块板一本（材质各异 → 用非实例 Mesh，量小可接受）
      let bookAdded = 0;
      for (let i = 0; i < cfg.levels; i++) {
        const yLow = postBase + i * pitch + 0.05;
        const yHigh = postBase + (i + 1) * pitch;
        for (let b = 0; b < cfg.bays; b++) {
          const cx = (bndXs[b] + bndXs[b + 1]) / 2;
          const w = cfg.bayW - 0.05;
          const yb = yLow + 0.012, zb = D / 2 - 0.025;
          const yt = yHigh - 0.012, zt = -D / 2 + 0.03;
          const dy = yt - yb, dz = zb - zt;
          const len = Math.hypot(dy, dz);
          const bm = new THREE.MeshStandardMaterial({ color: bookColors[(i * cfg.bays + b) % bookColors.length], roughness: 0.8, metalness: 0.02 });
          const book = new THREE.Mesh(bookGeo, bm);
          // 书平铺在板面上：板中心略偏下（靠前挡唇），厚度沿板法线抬起
          const nz = dy / len, ny = dz / len; // 板法线 (0, ny, nz) 归一（朝前上）
          const fx = 0.62; // 沿坡向下偏移比例（靠近前挡唇）
          const bx = cx, by = yb + dy * (1 - fx) + ny * 0.02, bz = zb - dz * (1 - fx) + nz * 0.02;
          _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan2(-dz, dy));
          _p.set(bx, by, bz);
          _s.set(w * 0.66, 0.028, len * 0.5);
          _m4.compose(_p, _q, _s);
          book.applyMatrix4(_m4);
          group.add(book);
          bookAdded++;
        }
      }
      partCount += bookAdded;
      groups.books = group.children[group.children.length - 1];
    }
    stats.cutList.push({ spec: `斜面展板 ${panelCfg.label}`, section: '板', len: +(cfg.bayW - 0.05).toFixed(2), qty: nPanels });
    stats.panes = [{ label: `斜面展板 ${panelCfg.label}`, areaM2: +boardArea.toFixed(3), kind: 'board' }];

    // ---- 亚克力前挡 ----
    if (cfg.acrylic) {
      const acrGeo = new THREE.BoxGeometry(1, 1, 0.005);
      const acr = instanced(acrGeo, mat.acrylicClear, nPanels);
      let ai = 0;
      for (let i = 0; i < cfg.levels; i++) {
        const yLow = postBase + i * pitch + 0.05;
        const yHigh = postBase + (i + 1) * pitch;
        for (let b = 0; b < cfg.bays; b++) {
          const cx = (bndXs[b] + bndXs[b + 1]) / 2;
          const w = cfg.bayW - 0.05;
          const yb = yLow + 0.012, zb = D / 2 - 0.025;
          const yt = yHigh - 0.012, zt = -D / 2 + 0.03;
          const dy = yt - yb, dz = zb - zt;
          const len = Math.hypot(dy, dz) - 0.06;
          _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan2(-dz, dy));
          _p.set(cx, (yb + yt) / 2, (zb + zt) / 2 + 0.028);
          _s.set(w - 0.02, len, 1);
          _m4.compose(_p, _q, _s);
          acr.setMatrixAt(ai++, _m4);
          partCount++;
        }
      }
      group.add(acr);
      groups.acrylic = acr;
      stats.hardware.push({ name: '亚克力前挡（含 standoff）', qty: nPanels });
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
      stats.hardware.push({ name: '交叉拉索（含弹簧端）', qty: nWires });
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
      const wheelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16);
      wheelGeo.rotateX(Math.PI / 2);
      const wheels = instanced(wheelGeo, mat.block, 4);
      const forkGeo = new THREE.BoxGeometry(0.012, 0.03, 0.03);
      const forks = instanced(forkGeo, mat.block, 4);
      let wi2 = 0;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const x = sx * (W / 2 - 0.06), z = sz * (D / 2 - 0.04);
          setMT(wi2, wheels, x, 0.025, z, 1, 1, 1);
          setMT(wi2, forks, x, 0.042, z, 1, 1, 1);
          wi2++;
        }
      }
      group.add(wheels);
      group.add(forks);
      partCount += 8;
    } else {
      const footGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.02, 12);
      const feet = instanced(footGeo, mat.block, bndXs.length * 2);
      let fi = 0;
      for (const x of bndXs) {
        setMT(fi++, feet, x, 0.01, D / 2, 1, 1, 1);
        setMT(fi++, feet, x, 0.01, -D / 2, 1, 1, 1);
      }
      group.add(feet);
      partCount += fi;
      stats.hardware.push({ name: '调平地脚', qty: fi });
    }
  }

  // ---- 统计 ----
  stats.profileLengthM = +rodLen.toFixed(1);
  stats.partCount = partCount;
  stats.weightKg = +(steelVol * STEEL_DENSITY + boardArea * MDF_DENSITY + woodVol * WOOD_DENSITY).toFixed(1);
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
