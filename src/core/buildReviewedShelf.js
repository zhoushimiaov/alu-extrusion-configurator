// 复核型材置物架装配工厂（buildReviewedShelf）：
// 包装旧版 buildShelf，经几何装配与后处理修正以下审查缺陷：
// 1. F02: 修复背板首条穿入立柱角部的几何干涉，背板条严格居中于两柱净跨内；
// 2. F03: 修复 2040（及 2020）最低排角件挂落柱底以下 Y<0 的缺陷，改为底梁顶面朝上安装；
// 3. F06: 统一下料单与构件统计口径，角件、螺栓、立柱/支脚、亚克力板块与 EVA 缓冲垫片均取自实际实例，消灭名义估算偏差；
// 4. F09: 输出真实三维几何包络 stats.envelope = computeEnvelope(group)。
//
// 保持原封文件 src/core/buildShelf.js 字节不变，供历史 baseline 对照；
// 外部调用契约与 buildShelf(config, withProps) 完全同构。

import * as THREE from 'three';
import { buildShelf } from './buildShelf.js';
import { computeEnvelope } from './envelope.js';
import {
  PROFILE_SERIES, ALU_DENSITY, ACRYLIC_DENSITY, PANE_THICKNESS,
  RIB_SPACING, DECK_STRIP, PANEL_RIB, normalizeConfig, DEPTH, LEVEL_PITCH,
} from '../config/product.js';

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);

function setMT(i, mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m4.compose(new THREE.Vector3(x, y, z), _q, _s);
  mesh.setMatrixAt(i, _m4);
}

/**
 * 构建经复核与几何修正的标准型材置物架
 * @param {object} config 货架配置
 * @param {boolean} withProps 是否创建陈设摆件
 */
export function buildReviewedShelf(config = {}, withProps = true) {
  // 调用原封构建器生成基准对象
  const built = buildShelf(config, withProps);
  const cfg = normalizeConfig(config);
  const { bayWidths, levels, decks, backs, series, sidePanels } = cfg;
  const prof = PROFILE_SERIES[series] || PROFILE_SERIES['2040'];
  const postProf = PROFILE_SERIES['2020'];
  const W = bayWidths.reduce((a, b) => a + b, 0);
  const postXs = [-W / 2];
  for (const w of bayWidths) postXs.push(postXs.at(-1) + w);
  const zPost = DEPTH / 2 - 0.01;
  const BEAM_TOP = prof.h / 2;

  // ---------------------------------------------------------------------------
  // F02 后处理修正：背板条居中排布，严禁穿入立柱实心材
  // 原实现 postXs[p] + 0.02 让首条左边缘 (x-0.012) 达到 postXs[p]+0.008，穿入立柱 (0.010) 达 2mm。
  // 修正为各跨净跨内严格居中，首末条距立柱边缘均保持安全净距。
  // ---------------------------------------------------------------------------
  if (sidePanels && built.groups.panels) {
    let pi = 0;
    for (let k = 0; k < levels; k++) {
      if (backs[k] === 'none') continue;
      const y = 0.02 + k * LEVEL_PITCH + BEAM_TOP;
      for (let p = 0; p < postXs.length - 1; p++) {
        const wNext = bayWidths[p];
        const n = Math.max(4, Math.floor((wNext - 0.03) / RIB_SPACING));
        // 净跨居中起始点：确保左右对称且不碰到两端立柱
        const startX = postXs[p] + (wNext - (n - 1) * RIB_SPACING) / 2;
        for (let r = 0; r < n; r++) {
          setMT(pi++, built.groups.panels, startX + r * RIB_SPACING, y, -zPost - 0.006);
        }
      }
    }
    built.groups.panels.instanceMatrix.needsUpdate = true;
    if (built.groups.panels.geometry) built.groups.panels.geometry.computeBoundingBox();
  }

  // ---------------------------------------------------------------------------
  // F03 后处理修正：底排角件及螺栓移至底梁顶面朝上安装，消灭 Y<0 穿地节点
  // 2040 系列底梁高度 0.04m，原实现将角件置于 y=0.00 并向 -Y 悬垂到 -0.024，螺栓落于 -0.014。
  // 修正为安装于底梁顶面 yTop = 0.02 + prof.h/2，朝上贴附立柱槽与梁顶槽。
  // ---------------------------------------------------------------------------
  if (built.groups.conn && built.groups.washers && built.groups.bolts) {
    const yTop = 0.02 + prof.h / 2;
    let ni = 0;
    let bx = -W / 2;
    for (let b = 0; b < bayWidths.length; b++) {
      const zs = [-zPost, ...(decks[0] !== 'none' ? [zPost] : [])];
      for (const z of zs) {
        for (const [x, dir] of [[bx + 0.01, 1], [bx + bayWidths[b] - 0.01, -1]]) {
          // L 角件放置在梁顶面朝上（水平边贴梁顶 yTop，竖直边贴立柱侧面 x）
          setMT(ni, built.groups.conn, x, yTop, z, Math.PI, dir === 1 ? 0 : Math.PI, 0);
          // 柱侧螺栓与垫圈（位于 yTop + 0.014，水平旋入立柱内侧槽）
          setMT(ni * 2, built.groups.washers, x + dir * 0.003, yTop + 0.014, z, 0, dir * Math.PI / 2, 0);
          setMT(ni * 2, built.groups.bolts, x + dir * 0.0038, yTop + 0.014, z, 0, dir * Math.PI / 2, 0);
          // 梁顶螺栓与垫圈（位于 yTop + 0.0038，垂直旋入横梁顶槽）
          setMT(ni * 2 + 1, built.groups.washers, x + dir * 0.015, yTop + 0.003, z, -Math.PI / 2, 0, 0);
          setMT(ni * 2 + 1, built.groups.bolts, x + dir * 0.015, yTop + 0.0038, z, -Math.PI / 2, 0, 0);
          ni++;
        }
      }
      bx += bayWidths[b];
    }
    built.groups.conn.instanceMatrix.needsUpdate = true;
    built.groups.washers.instanceMatrix.needsUpdate = true;
    built.groups.bolts.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // F06 修正：统一下料单、构件五金与重量统计口径，消灭名义估算虚假差异
  // ---------------------------------------------------------------------------
  const cutList = built.stats.cutList;
  const profileCuts = cutList.filter(c => c.section && c.section.includes('×') && !c.spec.includes('板'));
  const profileLengthM = +profileCuts.reduce((s, c) => s + c.len * c.qty, 0).toFixed(3);

  const totalCorners = built.groups.conn ? built.groups.conn.count : 0;
  const totalBolts = totalCorners * 2;
  const nBrk = built.groups.brkV ? built.groups.brkV.count : 0;
  // 立柱分前后两排：6 跨对应 7 轴线 × 2 排 = 14 根立柱与 14 个可调支脚，从真实实例数获取
  const nPosts = built.groups.feet ? built.groups.feet.count : (built.groups.posts ? built.groups.posts.count : (bayWidths.length + 1) * 2);

  // 亚克力层板块数与净面积：从真实 groups.pane 实例矩阵及几何尺寸计算，杜绝双重扣减
  let paneCount = 0;
  let totalPaneArea = 0;
  const panes = [];
  const paneCuts = new Map();
  if (built.groups.pane) {
    paneCount = built.groups.pane.count;
    const paneGeo = built.groups.pane.geometry;
    const depth = paneGeo?.parameters?.depth || (2 * zPost - 0.02);
    const m4 = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    for (let i = 0; i < paneCount; i++) {
      built.groups.pane.getMatrixAt(i, m4);
      scale.setFromMatrixScale(m4);
      totalPaneArea += scale.x * depth;
      const len = +scale.x.toFixed(3);
      const key = `${len}:${depth}`;
      if (paneCuts.has(key)) paneCuts.get(key).qty++;
      else paneCuts.set(key, {
        spec: '磨砂亚克力层板', section: '板', len, width: depth,
        thickness: PANE_THICKNESS, qty: 1, pricedViaPane: true,
      });
    }
    if (paneCount > 0) {
      panes.push({
        label: '磨砂亚克力层板',
        qty: paneCount,
        areaM2: +totalPaneArea.toFixed(3),
        kind: 'acrylic',
      });
    }
  }
  cutList.push(...paneCuts.values());

  // 亚克力承托与 EVA 缓冲垫片：
  // 3D 渲染中的 groups.pads 为 EVA 缓冲垫片（每个亚克力隔间 4 处）；
  // 当前装配不含独立卡扣实体，清单仅计真实垫片，避免继承旧版幽灵卡扣。
  const padCount = built.groups.pads ? built.groups.pads.count : (paneCount * 4);

  const hardware = [
    { name: '压铸角件 26mm（前后节点）', qty: totalCorners },
    { name: 'M8×12 T 螺栓+螺母', qty: totalBolts },
    { name: '悬挑托架（竖板+托舌）', qty: nBrk * 2 },
    { name: '可调支脚 M10', qty: nPosts },
  ];
  if (paneCount > 0) {
    hardware.push(
      { name: 'EVA 缓冲垫片', qty: padCount }
    );
  }

  // 铝型材体积与自重：仅针对型材截面下料项累计，非铝材料不使用默认截面猜测
  const sectionAreas = {
    '20×40': PROFILE_SERIES['2040'].area,
    '20×20': PROFILE_SERIES['2020'].area,
    '24×16': DECK_STRIP.area,
    '24×8': PANEL_RIB.area,
  };
  const aluCuts = cutList.filter(c => c.section && sectionAreas[c.section]);
  const volAlu = aluCuts.reduce((sum, c) => sum + c.len * c.qty * sectionAreas[c.section], 0);

  const weightKg = +(
    volAlu * ALU_DENSITY +
    totalPaneArea * PANE_THICKNESS * ACRYLIC_DENSITY +
    totalCorners * 0.075 +
    nBrk * 0.02 +
    nPosts * 0.03 +
    padCount * 0.001
  ).toFixed(1);

  const partCount = aluCuts.reduce((s, c) => s + c.qty, 0)
    + paneCount
    + padCount
    + totalCorners
    + totalBolts
    + nBrk * 2
    + nPosts;

  const reviewedStats = {
    ...built.stats,
    cutList,
    hardware,
    panes,
    paneCells: paneCount,
    profileLengthM,
    weightKg,
    partCount,
    envelope: computeEnvelope(built.group),
    legacyNominal: {
      profileLengthM: built.stats.profileLengthM,
      corners: built.stats.hardware[0]?.qty,
      boltSets: built.stats.hardware[1]?.qty,
    },
  };

  return {
    ...built,
    stats: reviewedStats,
  };
}
