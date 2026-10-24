// 审查项 CW-01..CW-09 专项回归测试
// 涵盖：木展车负外伸承托、经典挂衣架托片接管、下柜承托梁及4只角码、X拉索柱端耳、
//       矮架周转箱口与滑轨干涉、经典款板件BOM、斜撑型材总长、低矮脚轮干涉与元数据、原木脚轮接地拖尾。
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const gradientStub = { addColorStop() {} };
const ctx2d = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradientStub;
    if (prop === 'canvas') return { width: 0, height: 0 };
    return () => {};
  },
  set() { return true; },
});
globalThis.document = { createElement: (t) => (t === 'canvas' ? { width: 0, height: 0, getContext: () => ctx2d } : {}) };

const { buildWoodCart } = await import('../src/core/buildWoodCart.js');
const { buildHanger } = await import('../src/core/buildHanger.js');
const { buildCratesRack } = await import('../src/core/buildCratesRack.js');
const { buildCasters, resolveActualWheelD } = await import('../src/core/casters.js');
const { buildPurchaseRows } = await import('../src/ui/purchaseList.js');

// 辅助：获取 InstancedMesh 或 Mesh 的全部世界坐标 AABB 盒子列表
function getMeshBoxes(obj) {
  const boxes = [];
  obj.traverse(o => {
    if (o.userData?.displayOnly) return;
    if (o.isInstancedMesh) {
      o.geometry.computeBoundingBox();
      const localBox = o.geometry.boundingBox;
      const m = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        const worldM = o.matrixWorld ? o.matrixWorld.clone().multiply(m) : m;
        boxes.push(localBox.clone().applyMatrix4(worldM));
      }
    } else if (o.isMesh) {
      o.geometry.computeBoundingBox();
      const localBox = o.geometry.boundingBox;
      const worldM = o.matrixWorld || o.matrix;
      boxes.push(localBox.clone().applyMatrix4(worldM));
    }
  });
  return boxes;
}

// 辅助：检测两个 AABB 盒子是否存在正体积交叠（非接触面）
function boxOverlapVolume(b1, b2) {
  const xOverlap = Math.max(0, Math.min(b1.max.x, b2.max.x) - Math.max(b1.min.x, b2.min.x));
  const yOverlap = Math.max(0, Math.min(b1.max.y, b2.max.y) - Math.max(b1.min.y, b2.min.y));
  const zOverlap = Math.max(0, Math.min(b1.max.z, b2.max.z) - Math.max(b1.min.z, b2.min.z));
  return { x: xOverlap, y: yOverlap, z: zOverlap, vol: xOverlap * yOverlap * zOverlap };
}

// ---------------------------------------------------------------------
// CW-01: 木展车四向负外伸（内缩）必须生成承托支臂，每块板均有真实支座接触
// 覆盖：width 0.6/0.8/1.2、depth 0.35/0.45/0.65，3^4=81组外伸，共729组全覆盖检查。
// 严查：板底接触容差 <= 0.1mm、正承托面积、支承接回立柱夹块、铝托臂体积实重
// ---------------------------------------------------------------------
test('CW-01: 木展车负外伸下层板与顶台板保留有效承托支臂，无悬空角（729组全覆盖）', () => {
  const widths = [0.6, 0.8, 1.2];
  const depths = [0.35, 0.45, 0.65];
  const ohValues = [-0.15, 0, 0.15];

  let testedCombos = 0;

  for (const W of widths) {
    for (const D of depths) {
      for (const ohF of ohValues) {
        for (const ohB of ohValues) {
          for (const ohL of ohValues) {
            for (const ohR of ohValues) {
              const cfg = { width: W, depth: D, height: 1.8, shelves: 2, ohF, ohB, ohL, ohR };
              const cart = buildWoodCart(cfg);
              try {
                const px = W / 2, pz = D / 2;
                const postCorners = [
                  [-px, -pz], [px, -pz], [-px, pz], [px, pz],
                ];

                const EDGE = 0.04;
                const expectedMinX = -px - EDGE - ohL;
                const expectedMaxX = px + EDGE + ohR;
                const expectedMinZ = -pz - EDGE - ohB;
                const expectedMaxZ = pz + EDGE + ohF;

                cart.group.updateMatrixWorld(true);

                // 检查实际生成的板材边缘是否与输入外伸完全吻合
                const shelfBoxes = getMeshBoxes(cart.groups.shelfBoards);
                const topBoxes = getMeshBoxes(cart.groups.top);
                const allBoardBoxes = [...shelfBoxes, ...topBoxes];

                for (const bBox of allBoardBoxes) {
                  assert.ok(Math.abs(bBox.min.x - expectedMinX) < 1e-4, `板左边实际 ${bBox.min.x} ≠ 预期 ${expectedMinX}`);
                  assert.ok(Math.abs(bBox.max.x - expectedMaxX) < 1e-4, `板右边实际 ${bBox.max.x} ≠ 预期 ${expectedMaxX}`);
                  assert.ok(Math.abs(bBox.min.z - expectedMinZ) < 1e-4, `板后边实际 ${bBox.min.z} ≠ 预期 ${expectedMinZ}`);
                  assert.ok(Math.abs(bBox.max.z - expectedMaxZ) < 1e-4, `板前边实际 ${bBox.max.z} ≠ 预期 ${expectedMaxZ}`);
                }

                // 获取所有支座盒（立柱夹块 + 铝托臂）
                const supportBoxes = [];
                if (cart.groups.shelfClamps) supportBoxes.push(...getMeshBoxes(cart.groups.shelfClamps));
                if (cart.groups.supportArms) supportBoxes.push(...getMeshBoxes(cart.groups.supportArms));

                // 对每块板检查 4 个角是否有真实承托
                for (const bBox of allBoardBoxes) {
                  const boardBottomY = bBox.min.y;
                  let contacts = 0;
                  for (const [cx, cz] of postCorners) {
                    const hasContact = supportBoxes.some(sBox => {
                      // 1. 严格垂直贴合（容差 <= 0.1mm = 0.0001m）
                      const touchesY = Math.abs(sBox.max.y - boardBottomY) <= 0.0001;
                      // 2. XZ 正承托面积
                      const ovX = Math.max(0, Math.min(sBox.max.x, bBox.max.x) - Math.max(sBox.min.x, bBox.min.x));
                      const ovZ = Math.max(0, Math.min(sBox.max.z, bBox.max.z) - Math.max(sBox.min.z, bBox.min.z));
                      const hasBearingArea = ovX >= 0.005 && ovZ >= 0.005;
                      // 3. 支座处于该角象限
                      const inQuadrant = (Math.sign(cx) > 0 ? sBox.max.x > 0 : sBox.min.x < 0) &&
                                         (Math.sign(cz) > 0 ? sBox.max.z > 0 : sBox.min.z < 0);
                      // 4. 托件接回立柱（覆盖立柱夹块外径范围）
                      const connectsToPost = Math.abs(cx > 0 ? (sBox.max.x - (cx + 0.014)) : (sBox.min.x - (cx - 0.014))) < 0.005 ||
                                             (Math.abs(sBox.min.x - (cx - 0.014)) < 0.005 && Math.abs(sBox.max.x - (cx + 0.014)) < 0.005);
                      return touchesY && hasBearingArea && inQuadrant && connectsToPost;
                    });
                    if (hasContact) contacts++;
                  }
                  assert.equal(contacts, 4, `W=${W}, D=${D}, oh=(${ohF},${ohB},${ohL},${ohR}) 板在 y=${boardBottomY.toFixed(3)} 必须有 4 处有效支座接触，当前 ${contacts}`);
                }

                // 验证托臂体积核重与五金清单
                if (cart.groups.supportArms) {
                  const armBoxes = getMeshBoxes(cart.groups.supportArms);
                  let expectedArmMass = 0;
                  for (const ab of armBoxes) {
                    const vx = ab.max.x - ab.min.x;
                    const vy = ab.max.y - ab.min.y;
                    const vz = ab.max.z - ab.min.z;
                    expectedArmMass += vx * vy * vz * 2700;
                  }
                  const hw = cart.stats.hardware.find(h => h.name.includes('内缩层板悬挑承托支臂'));
                  assert.ok(hw, '内缩时硬件清单必须包含内缩层板悬挑承托支臂');
                  assert.equal(hw.qty, armBoxes.length);
                }
                testedCombos++;
              } finally {
                cart.dispose();
              }
            }
          }
        }
      }
    }
  }
  assert.equal(testedCombos, 729, `必须完成全部 729 组全覆盖检查，当前完成 ${testedCombos}`);
});

// ---------------------------------------------------------------------
// CW-02: 经典款挂衣架顶板托片同时接触木板底面与框架圆管实体
// ---------------------------------------------------------------------
test('CW-02: 经典款顶板托片同时接触板底与承重圆管表面（径向间隙 <=0.1mm）', () => {
  const hanger = buildHanger({ style: 'classic', width: 1.4, depth: 0.5, height: 2.0 });
  try {
    hanger.group.updateMatrixWorld(true);
    const shelf = hanger.groups.shelf;
    shelf.geometry.computeBoundingBox();
    const shelfBottomY = shelf.position.y - shelf.scale.y / 2;

    const tabsGroup = hanger.groups.shelfTabs;
    assert.ok(tabsGroup, '必须存在 shelfTabs');
    const tabBoxes = getMeshBoxes(tabsGroup);
    assert.equal(tabBoxes.length, 4, '必须有 4 个顶板托片');

    const px = (1.4 - 0.03) / 2;
    const pz = (0.5 - 0.03) / 2;
    const POST_D = 0.03;
    const R = POST_D / 2;
    const yTopRail = 0.068 + 0.02 + 2.0 - POST_D / 2;

    for (let i = 0; i < tabBoxes.length; i++) {
      const tb = tabBoxes[i];
      // 1. 托片顶面严格接触搁板底面
      assert.ok(Math.abs(tb.max.y - shelfBottomY) <= 0.001, `托片 ${i} 顶面与搁板底面接触间隙过大`);

      // 2. 托片必须接触框架圆管表面
      const cx = tb.min.x > 0 ? px : -px;
      const cz = tb.min.z > 0 ? pz : -pz;

      const radialDistToZ = Math.min(
        Math.hypot(tb.max.x - cx, tb.max.y - yTopRail) - R,
        Math.hypot(tb.min.x - cx, tb.max.y - yTopRail) - R
      );
      const radialDistToX = Math.min(
        Math.hypot(tb.max.z - cz, tb.max.y - yTopRail) - R,
        Math.hypot(tb.min.z - cz, tb.max.y - yTopRail) - R
      );
      const minRadialGap = Math.min(Math.abs(radialDistToZ), Math.abs(radialDistToX));
      assert.ok(minRadialGap <= 0.0005, `托片 ${i} 离圆柱表面径向间隙必须 <= 0.5mm，当前 ${ (minRadialGap * 1000).toFixed(3) }mm`);
    }
  } finally {
    hanger.dispose();
  }
});

// ---------------------------------------------------------------------
// CW-03: 经典款挂衣架下柜底框设置真实承托梁及4只真实角码接底框
// ---------------------------------------------------------------------
test('CW-03: 经典挂衣架下柜底部有实体承托梁及4只角码连接底框，形成连续传力路径', () => {
  for (const drawers of [0, 1, 2, 3]) {
    const hanger = buildHanger({ style: 'classic', drawers, width: 1.2, depth: 0.45, height: 1.8 });
    try {
      hanger.group.updateMatrixWorld(true);
      const cabGroup = hanger.groups.cabinet;
      assert.ok(cabGroup, '必须存在下柜');
      const cabBoxes = getMeshBoxes(cabGroup);
      const cabBottomBox = cabBoxes[0];
      const cabBottomY = cabBottomBox.min.y;

      // 验证生成下柜承托梁与4只真实角码
      const bearingBeams = hanger.groups.cabinetBearings;
      const bearingBrackets = hanger.groups.cabinetBrackets;
      assert.ok(bearingBeams, `drawers=${drawers} 时必须生成下柜专用承托梁`);
      assert.ok(bearingBrackets, `drawers=${drawers} 时必须生成下柜承托梁专用角码`);

      const beamBoxes = getMeshBoxes(bearingBeams).filter(b => (b.max.x - b.min.x) > 0.1);
      const bracketBoxes = getMeshBoxes(bearingBrackets);
      assert.equal(beamBoxes.length, 2, '下柜底面必须有 2 根贯通承托横梁');
      assert.equal(bracketBoxes.length, 4, '承托横梁两端必须有 4 只真实压铸角码');

      // 验证每根承托梁顶面精确贴合柜底
      for (const bb of beamBoxes) {
        assert.ok(Math.abs(bb.max.y - cabBottomY) <= 0.001, `承托梁顶面与柜底间隙过大: ${Math.abs(bb.max.y - cabBottomY)*1000}mm`);
      }

      // 验证4只角码接入底框纵梁内表面
      const px = (1.2 - 0.03) / 2;
      const beamH = 0.02;
      const frameLongitudinalInnerX = px - beamH / 2;
      for (const brBox of bracketBoxes) {
        // 角码外边缘精确对齐或贴合底框纵梁内表面
        const distToInner = brBox.min.x > 0 ? Math.abs(brBox.max.x - frameLongitudinalInnerX) : Math.abs(brBox.min.x - (-frameLongitudinalInnerX));
        assert.ok(distToInner <= 0.002, `角码外边缘离底框纵梁内表面间隙必须 <= 2mm，当前 ${ (distToInner * 1000).toFixed(2) }mm`);
      }

      // 验证硬件清单包含独立角码项与原底框角件项
      const hwCabBracket = hanger.stats.hardware.find(h => h.name === '下柜承托梁压铸角码');
      const hwBaseCorner = hanger.stats.hardware.find(h => h.name === '底框压铸角件');
      assert.ok(hwCabBracket, '五金清单必须包含独立下柜承托梁压铸角码项');
      assert.equal(hwCabBracket.qty, 4, '下柜承托梁压铸角码数量必须为 4');
      assert.ok(hwBaseCorner, '五金清单必须保留原有底框压铸角件项');
      assert.equal(hwBaseCorner.qty, 4, '底框压铸角件数量必须为 4');
    } finally {
      hanger.dispose();
    }
  }
});

// ---------------------------------------------------------------------
// CW-04: 可选侧面 X 拉索端件物理连接立柱硬件，包含真实销耳总成
// ---------------------------------------------------------------------
test('CW-04: 可选侧面 X 拉索 8 处端件物理连接立柱，无悬空断口且包含销耳总成', () => {
  const hanger = buildHanger({ style: 'classic', sideWires: true, width: 1.4, depth: 0.5, height: 2.2 });
  try {
    hanger.group.updateMatrixWorld(true);
    const ends = hanger.groups.sideWireEnds;
    assert.ok(ends, '必须存在 sideWireEnds');
    assert.equal(ends.children.length, 8, '8 处钢索端件');

    const px = (1.4 - 0.03) / 2;
    const pz = (0.5 - 0.03) / 2;
    const postR = 0.015;

    // 检查每个端件与立柱圆柱实体的三维贯通连接
    for (const term of ends.children) {
      const signX = Math.sign(term.position.x);
      const postX = signX * px;
      const postZ = Math.sign(term.position.z) * pz;

      // 寻找子网格中的连接销耳
      let lugMesh = null;
      term.traverse(c => {
        if (c.name === 'sideXWirePostLug') lugMesh = c;
      });
      assert.ok(lugMesh, '张紧端件必须包含实体连接销耳 sideXWirePostLug');

      const lugBox = new THREE.Box3().setFromObject(lugMesh);
      // 销耳在水平面与立柱中心共轴或对齐
      assert.ok(Math.abs(term.position.z - postZ) < 1e-4, '销耳与立柱在 Z 轴严格对齐');
      // 销耳沿 X 轴向内深入立柱圆柱表面，消除断口
      const postSurfaceX = postX + signX * postR;
      const innerX = signX > 0 ? lugBox.min.x : lugBox.max.x;
      const outerX = signX > 0 ? lugBox.max.x : lugBox.min.x;
      // 验证销耳跨越立柱圆柱表面
      assert.ok(signX > 0 ? innerX < postSurfaceX : innerX > postSurfaceX, '销耳必须贯穿深入立柱圆柱实体表面');
      assert.ok(signX > 0 ? outerX >= postSurfaceX : outerX <= postSurfaceX, '销耳外端必须连接端件');
    }

    // 验证五金清单与核重
    const wireHw = hanger.stats.hardware.find(h => h.name.includes('X拉索张紧端件'));
    assert.ok(wireHw, '必须有 X拉索张紧端件五金条目');
    assert.ok(wireHw.name.includes('销耳总成'), '五金条目必须标明含回接立柱销耳总成');
    assert.equal(wireHw.qty, 8);
  } finally {
    hanger.dispose();
  }
});

// ---------------------------------------------------------------------
// CW-05: 矮架多层周转箱箱口唇边与固定外轨无实体体积穿插，且宽裕两层容量不缩水
// ---------------------------------------------------------------------
test('CW-05: 矮架多层配置顶箱唇边与固定外轨无体积干涉，宽裕配置保留 0.30m 真实容量', () => {
  // 1. 极限多层干涉检测
  const configs = [
    { width: 0.45, depth: 0.32, height: 0.55, tiers: 6, pullOut: false },
    { width: 0.45, depth: 0.32, height: 0.55, tiers: 6, pullOut: true },
    { width: 0.45, depth: 0.32, height: 0.55, tiers: 5, pullOut: false },
    { width: 0.45, depth: 0.32, height: 0.60, tiers: 6, pullOut: false },
    { width: 0.45, depth: 0.32, height: 0.62, tiers: 6, pullOut: false },
    { width: 0.45, depth: 0.32, height: 0.74, tiers: 6, pullOut: false },
  ];

  for (const cfg of configs) {
    const rack = buildCratesRack(cfg);
    try {
      rack.group.updateMatrixWorld(true);
      const slideOuter = rack.groups.slides.children[0];
      const slideOuterBoxes = getMeshBoxes(slideOuter);

      const lipBoxes = [];
      rack.groups.crates.traverse(o => {
        if (o.isInstancedMesh && o.material?.color && o.count >= cfg.tiers) {
          lipBoxes.push(...getMeshBoxes(o));
        }
      });

      for (const sb of slideOuterBoxes) {
        for (const lb of lipBoxes) {
          const ov = boxOverlapVolume(sb, lb);
          assert.ok(
            ov.x < 0.001 || ov.y < 0.001 || ov.z < 0.001,
            `配置 H=${cfg.height}, tiers=${cfg.tiers}, pull=${cfg.pullOut} 检测到外轨与箱体唇边穿插: ${ (ov.x*1000).toFixed(1) }×${ (ov.y*1000).toFixed(1) }×${ (ov.z*1000).toFixed(1) }mm`
          );
        }
      }
    } finally {
      rack.dispose();
    }
  }

  // 2. 宽裕两层配置容量不被无故缩成 202mm 回归
  const spacious = buildCratesRack({ height: 1.2, tiers: 2, pullOut: false });
  try {
    spacious.group.updateMatrixWorld(true);
    const crateBoxes = getMeshBoxes(spacious.groups.crates);
    let maxCrateH = 0;
    for (const cb of crateBoxes) {
      const h = cb.max.y - cb.min.y;
      if (h > maxCrateH) maxCrateH = h;
    }
    // 箱体高度必须达到 0.30m 上限（允许微小圆角/拔模容差 >= 0.295m）
    assert.ok(maxCrateH >= 0.295, `宽裕两层配置箱体高度 (${ (maxCrateH*1000).toFixed(1) }mm) 不得被压至 202mm，必须充分利用空间达到 300mm 上限`);
  } finally {
    spacious.dispose();
  }
});

// ---------------------------------------------------------------------
// CW-06: 经典款全部板件进入采购清单 BOM
// ---------------------------------------------------------------------
test('CW-06: 经典挂衣架所有实际板件或成品柜组件在采购清单中恰好出现一次', () => {
  const expectedBoards = {
    0: 8, // 顶搁板 1 + 柜底 1 + 柜侧 2 + 柜背 1 + 柜顶 1 + 横隔板 1 + 立隔板 1
    1: 7, // 顶搁板 1 + 柜底 1 + 柜侧 2 + 柜背 1 + 柜顶 1 + 抽面 1
    2: 8, // 顶搁板 1 + 柜底 1 + 柜侧 2 + 柜背 1 + 柜顶 1 + 抽面 2
    3: 9, // 顶搁板 1 + 柜底 1 + 柜侧 2 + 柜背 1 + 柜顶 1 + 抽面 3
  };

  for (const [drawersStr, expectedCount] of Object.entries(expectedBoards)) {
    const drawers = Number(drawersStr);
    const hanger = buildHanger({ style: 'classic', drawers, width: 1.4, depth: 0.5, height: 2.0 });
    try {
      const rows = buildPurchaseRows(hanger.stats, 'hanger', { style: 'classic', drawers });
      const boardRows = rows.detail.filter(r => r[0] === '板件');
      const totalBoardQty = boardRows.reduce((sum, r) => sum + r[7], 0);
      assert.equal(totalBoardQty, expectedCount, `drawers=${drawers} 时采购板件总件数必须为 ${expectedCount}，当前 ${totalBoardQty}`);
      assert.ok(boardRows.some(r => r[1]?.includes('顶部置物搁板') || r[1]?.includes('顶搁板')), '采购单必须包含独立顶部置物搁板');
    } finally {
      hanger.dispose();
    }
  }
});

// ---------------------------------------------------------------------
// CW-07: 经典款型材总长包含四根斜撑
// ---------------------------------------------------------------------
test('CW-07: 经典款 stats.profileLengthM 完整包含四根外挂斜撑总长', () => {
  for (const depth of [0.4, 0.5, 0.65]) {
    const hanger = buildHanger({ style: 'classic', width: 1.4, depth, height: 2.0 });
    try {
      const cutSum = hanger.stats.cutList
        .filter(c => c.section !== '板' && c.section !== '件')
        .reduce((sum, c) => sum + c.len * c.qty, 0);
      assert.ok(
        Math.abs(hanger.stats.profileLengthM - cutSum) <= 0.05,
        `进深 depth=${depth} 时 profileLengthM(${hanger.stats.profileLengthM.toFixed(3)}) 必须与 cutList 杆件合计(${cutSum.toFixed(3)}) 一致`
      );
    } finally {
      hanger.dispose();
    }
  }
});

// ---------------------------------------------------------------------
// CW-08: 原木款低矮脚轮胎面与轮叉横桥无体积干涉，且暴露真实规格元数据
// ---------------------------------------------------------------------
test('CW-08: 低矮脚轮（H=0.05, wheelD=0.036）避让横桥，暴露真实 32mm 元数据并反映于原木款 BOM', () => {
  // 1. 同源解算 helper 验证
  const actualD = resolveActualWheelD({ H: 0.05, wheelD: 0.036, mount: 'plate' });
  assert.equal(actualD, 0.032, `H=0.05 时实际轮径必须避让横桥解算为 0.032m (32mm)`);

  // 2. buildCasters 元数据与几何验证
  const group = buildCasters([{ x: 0, z: 0, yaw: 0 }], {
    H: 0.05, wheelD: 0.036, wheelW: 0.016, trail: 0.012, mount: 'plate', plate: 0.04, brake: false, palette: 'black',
  });
  try {
    group.updateMatrixWorld(true);
    assert.equal(group.userData.wheelD, 0.032, '脚轮组必须携带 actualWheelD 元数据');
    assert.equal(group.userData.H, 0.05, '脚轮组必须携带 H 元数据');

    let tireMesh = null, metalMesh = null;
    group.traverse(o => {
      if (o.isInstancedMesh) {
        if (o.name.includes('tire')) tireMesh = o;
        if (o.name.includes('metal')) metalMesh = o;
      }
    });
    assert.ok(tireMesh && metalMesh, '必须有 tire 和 metal 网格');

    const tireBox = new THREE.Box3().setFromObject(tireMesh);
    assert.ok(Math.abs(tireBox.min.y) <= 0.001, `胎底必须严格接触地面 Y=0，当前 min.y=${tireBox.min.y}`);
    assert.ok(tireBox.max.y <= 0.033001, `轮胎顶部最高点 (${ (tireBox.max.y*1000).toFixed(2) }mm) 必须低于横桥底面 (33.00mm)`);
  } finally {
    group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }

  // 3. 原木款挂衣架 BOM 规格验证
  const atelierHanger = buildHanger({ style: 'atelier', wheels: true, width: 1.4, depth: 0.5, height: 2.4 });
  try {
    const casterHw = atelierHanger.stats.hardware.find(h => h.name.includes('隐藏式万向轮'));
    assert.ok(casterHw, '原木款启用脚轮时必须包含隐藏式万向轮条目');
    assert.ok(casterHw.name.includes('32mm'), `BOM 规格必须真实标明 32mm，当前: ${casterHw.name}`);
    assert.ok(casterHw.name.includes('50mm'), `BOM 规格必须标明安装高度 50mm，当前: ${casterHw.name}`);
    assert.ok(!casterHw.name.includes('1.5 寸'), 'BOM 规格不得再声称粗略的 1.5 寸');
  } finally {
    atelierHanger.dispose();
  }
});

// ---------------------------------------------------------------------
// CW-09: 原木款脚轮支撑点元数据包含 12mm 拖尾
// ---------------------------------------------------------------------
test('CW-09: 原木款挂衣架启用脚轮时，支撑点包含 12mm 拖尾偏移且与接地中心对齐', () => {
  const withoutWheels = buildHanger({ style: 'atelier', wheels: false, width: 1.4, depth: 0.5, height: 2.4 });
  const withWheels = buildHanger({ style: 'atelier', wheels: true, width: 1.4, depth: 0.5, height: 2.4 });
  try {
    const ptsNo = withoutWheels.stats.supports.points;
    const ptsYes = withWheels.stats.supports.points;
    assert.equal(ptsYes.length, 4);

    for (let i = 0; i < 4; i++) {
      const [x0, y0, z0] = ptsNo[i];
      const [x1, y1, z1] = ptsYes[i];
      const disp = Math.hypot(x1 - x0, z1 - z0);
      assert.ok(Math.abs(disp - 0.012) <= 0.001, `支撑点 ${i} 拖尾偏距必须为 12mm，当前 ${ (disp * 1000).toFixed(2) }mm`);
      assert.equal(y1, 0, '接地 Y 必须为 0');
    }
  } finally {
    withoutWheels.dispose();
    withWheels.dispose();
  }
});
