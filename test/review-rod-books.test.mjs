import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildBookshelf } from '../src/core/buildBookshelf.js';
import { ROD_D, RAIL_D, ROD_DENSITY } from '../src/config/rodrack.js';

// Mock canvas for node test environment
globalThis.document = {
  createElement: () => ({
    width: 256, height: 256,
    getContext: () => new Proxy({}, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => (o[k] = v, true) }),
  }),
};

const near = (actual, expected, eps = 1e-4, msg = '') =>
  assert.ok(Math.abs(actual - expected) <= eps, `${msg} expected ${expected}, got ${actual} (diff ${Math.abs(actual - expected)})`);

function inst(mesh, i = 0) {
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  mesh.getMatrixAt(i, m);
  m.decompose(p, q, s);
  return { p, q, s, m };
}

// ----------------- ROD-01: 亚克力屏板夹与立柱断开 -----------------
test('ROD-01: 亚克力屏板夹具有连续过渡件回接立柱', () => {
  for (const width of [0.50, 0.80, 1.00]) {
    const r = buildRodRack({ style: 'acrylic', width, height: 1.2, shelf: 'none' });
    try {
      const { acr, clips, acrPostArms, posts } = r.groups;
      assert.ok(acr, 'acrylic board must exist');
      assert.equal(clips.count, 4, '4 edge clips');
      assert.ok(acrPostArms, 'transition arms/connectors connecting clip to post must exist');
      assert.equal(acrPostArms.count, 4, '4 transition arms for 4 clip nodes');

      // Check geometric continuity: for each clip, an arm connects from clip outer side to post inner surface
      const postXRight = width / 2;
      for (let i = 0; i < 4; i++) {
        const c = inst(clips, i);
        const arm = inst(acrPostArms, i);
        // Arm should reach near the post line
        const sx = Math.sign(c.p.x);
        const postX = sx * postXRight;
        near(arm.p.y, c.p.y, 0.01, 'arm height matches clip height');
        // Arm spans to column
        assert.ok(Math.abs(arm.p.x) > Math.abs(c.p.x), 'arm extends outwards from clip towards column');
      }
      assert.ok(r.stats.hardware.some(h => h.name.includes('亚克力') && h.name.includes('转接') && h.qty === 4));
    } finally {
      r.dispose();
    }
  }
});

// ----------------- ROD-02: poster/acrylic底盘横轴与底叉断开 -----------------
test('ROD-02: poster/acrylic横轴与底叉间有真实跨层过渡袖套', () => {
  for (const style of ['poster', 'acrylic']) {
    for (const casters of [false, true]) {
      const r = buildRodRack({ style, casters, width: 0.8, height: 1.2 });
      try {
        const sleeves = r.groups.axleSleeves || r.groups.panelOuterAxleSleeves;
        assert.ok(sleeves, `${style} must provide vertical bridge sleeves connecting axle to fork`);
        assert.equal(sleeves.count, 4, '4 axle sleeves bridging 4 axle-fork junctions');
        // Sleeve height should span between yFork (0.126) and yAxle (0.151)
        for (let i = 0; i < 4; i++) {
          const s = inst(sleeves, i);
          near(s.p.y, (0.126 + 0.151) / 2, 0.005, 'sleeve centered vertically between fork and axle');
        }
        assert.ok(r.stats.hardware.some(h => h.name.includes('外侧立柱底叉跨层过渡袖套') && h.qty === 4));
      } finally {
        r.dispose();
      }
    }
  }
});

// ----------------- ROD-03: poster/acrylic全深镀锌层板板底严格接触托梁且托梁接入侧框 -----------------
test('ROD-03: poster/acrylic全深镀锌层板板底严格接触托梁且托梁接入侧框', () => {
  for (const style of ['poster', 'acrylic']) {
    const r = buildRodRack({ style, shelf: 'deck', width: 0.8, height: 1.2 });
    try {
      const { rodDeck, rodJoists, deckClips } = r.groups;
      assert.ok(rodDeck, 'deck must exist');
      assert.ok(rodJoists, 'deck joists must exist');
      const d = inst(rodDeck, 0);
      const deckBottom = d.p.y - 0.001; // half thickness of boardHGeo (0.002)

      for (let i = 0; i < rodJoists.count; i++) {
        const j = inst(rodJoists, i);
        const joistTop = j.p.y + RAIL_D / 2; // diameter 0.012 -> radius 0.006
        near(joistTop, deckBottom, 0.0005, 'top of deck joist must touch underside of deck plate');
      }
      assert.ok(deckClips, 'deck clamps connecting joists to frame must exist');
      assert.equal(deckClips.count, 4, '4 deck clamps');
      assert.ok(r.stats.hardware.some(h => h.name.includes('层板托夹') && h.qty === 4));
    } finally {
      r.dispose();
    }
  }
});

test('ROD-03/BOM-01: 所有样式下deck托梁质量同源累计且开关差量扣除板/夹后与两根托梁精确一致', () => {
  for (const style of ['poster', 'acrylic', 'panel']) {
    const W = 0.8, H = 1.2;
    const rNone = buildRodRack({ style, shelf: 'none', width: W, height: H });
    const rDeck = buildRodRack({ style, shelf: 'deck', width: W, height: H });
    try {
      const deltaWeight = +(rDeck.stats.weightKg - rNone.stats.weightKg).toFixed(4);
      // Deck plate weight:
      const zFrame = 0.087;
      const shelfArea = (W - 0.06) * (zFrame * 2 + 0.03);
      const plateWeight = shelfArea * 0.0012 * 7850;
      // 4 deck clips weight (aluminum density 2700):
      const clipWeight = 4 * (0.03 * 0.75) * (0.024 * 0.65) * (0.034 * 0.75) * 2700;

      // 2 joists length and expected weight:
      const isPanel = style === 'panel';
      const railLen = W + (isPanel ? 0.026 : 0.08);
      const deckJoistLen = isPanel ? railLen : (W + 0.08);
      const joistsExpectedWeight = 2 * deckJoistLen * Math.PI * (RAIL_D / 2) ** 2 * ROD_DENSITY;

      // Any style-specific screen / frame changes when shelf is added:
      // acrylic: screen height is adjusted down to avoid penetrating shelf (ROD-04)
      const rNoneAcrPane = rNone.stats.panes?.find(p => p.kind === 'acrylic');
      const rDeckAcrPane = rDeck.stats.panes?.find(p => p.kind === 'acrylic');
      const acrAreaDelta = (rDeckAcrPane && rNoneAcrPane) ? (rDeckAcrPane.areaM2 - rNoneAcrPane.areaM2) * 0.0012 * 7850 : 0;
      // panel: frameEnds connects frame when shelf is enabled
      const frameEndsDelta = isPanel ? 2 * (zFrame - 0.02) * 2 * Math.PI * (RAIL_D / 2) ** 2 * ROD_DENSITY : 0;

      const remainingDelta = deltaWeight - plateWeight - clipWeight - acrAreaDelta - frameEndsDelta;
      near(remainingDelta, joistsExpectedWeight, 0.1, `${style} deck delta minus plate and clips matches joists`);

      // Verify BOM cutList has exactly 2 deck joists of length deckJoistLen
      const cutJoist = rDeck.stats.cutList.find(c => c.spec === '层板托梁');
      assert.ok(cutJoist, `${style} cutList has 层板托梁`);
      assert.equal(cutJoist.qty, 2);
      near(cutJoist.len, deckJoistLen, 0.002);
    } finally {
      rNone.dispose();
      rDeck.dispose();
    }
  }
});

// ----------------- ROD-04: 亚克力整屏穿过窄托板和全深层板 -----------------
test('ROD-04: acrylic与tray/deck实体不相穿', () => {
  for (const shelf of ['tray', 'deck']) {
    const r = buildRodRack({ style: 'acrylic', shelf, width: 0.8, height: 1.2 });
    try {
      const { acr, tray, rodDeck } = r.groups;
      assert.ok(acr, 'acrylic screen exists');
      const acrInst = inst(acr, 0);
      const acrHalfH = (acrInst.s.y * (acr.geometry.parameters.height ?? 1)) / 2;
      const acrBottomY = acrInst.p.y - acrHalfH;

      const shelfObj = shelf === 'tray' ? tray : rodDeck;
      const sInst = inst(shelfObj, 0);
      const shelfTopY = sInst.p.y + 0.001;

      // Screen bottom must not penetrate the horizontal shelf plate
      assert.ok(acrBottomY >= shelfTopY - 0.001, `acrylic bottom (${acrBottomY}) must sit above shelf top (${shelfTopY})`);
    } finally {
      r.dispose();
    }
  }
});

// ----------------- ROD-05: panel窄托板四只端夹与T块完全重复 -----------------
test('ROD-05: panel+tray端夹与T型夹块不产生完全重复实体', () => {
  const r = buildRodRack({ style: 'panel', shelf: 'tray', width: 0.8, height: 1.2 });
  try {
    const { trayClips, blocks } = r.groups;
    assert.equal(trayClips.count, 4, '4 tray end clips');
    // Check blocks do not have identical center coords with trayClips
    const trayPos = new Set();
    for (let i = 0; i < trayClips.count; i++) {
      const p = inst(trayClips, i).p;
      trayPos.add([p.x.toFixed(4), p.y.toFixed(4), p.z.toFixed(4)].join(':'));
    }
    for (let i = 0; i < blocks.count; i++) {
      const p = inst(blocks, i).p;
      const key = [p.x.toFixed(4), p.y.toFixed(4), p.z.toFixed(4)].join(':');
      assert.ok(!trayPos.has(key), `block at ${key} duplicates trayClip`);
    }
    // Check hardware BOM does not duplicate
    const trayClipItems = r.stats.hardware.filter(h => h.name.includes('窄托板承托端夹'));
    assert.equal(trayClipItems.length, 1);
  } finally {
    r.dispose();
  }
});

// ----------------- ROD-06: panel/acrylic隐藏普通背板仍进入采购清单 -----------------
test('ROD-06: panel/acrylic不应把普通海报背板和挂扣计入清单', () => {
  for (const style of ['panel', 'acrylic']) {
    const r = buildRodRack({ style, backPanel: 'poster', width: 0.8, height: 1.2 });
    try {
      assert.equal(r.groups.board, undefined, 'no ordinary poster board mesh');
      assert.ok(!r.stats.cutList.some(c => c.spec.includes('海报背板') || c.spec.includes('镀锌背板')), 'no phantom backboard in cutList');
      assert.ok(!r.stats.hardware.some(h => h.name === '背板挂扣'), 'no phantom backboard clips in hardware');
    } finally {
      r.dispose();
    }
  }
});

// ----------------- BOM-01: rod底盘过渡座采购总成与横轴规范下料 -----------------
test('BOM-01: rod底盘横轴按Ø20核重且过渡座以采购总成定义，无伪标准圆轴下料', () => {
  const r = buildRodRack({ style: 'poster', width: 0.8, height: 1.2, shelf: 'none', backPanel: 'none' });
  try {
    const cutAxle = r.stats.cutList.find(c => c.spec === '底盘横轴');
    assert.ok(cutAxle, '底盘横轴 exists in cutList');
    assert.equal(cutAxle.section, '⌀20');
    assert.equal(cutAxle.qty, 2);

    // review-evidence: forkZs不能武断作为4根标准圆轴下单，下料单不含伪标准圆轴
    const cutShort = r.stats.cutList.find(c => c.spec.includes('短轴'));
    assert.equal(cutShort, undefined, 'no pseudo standard round tube in cutList for forkZs');

    // BOM hardware: 每柱一套过渡座采购总成（共2套）
    const transHardware = r.stats.hardware.find(h => h.name.includes('过渡座总成'));
    assert.ok(transHardware, 'hardware BOM contains 过渡座总成');
    assert.equal(transHardware.qty, 2, '2 transition assemblies (1 per column)');

    // forkZs保留原始参考短座几何位置/20x12截面（ROD_D/2 by RAIL_D/2）
    const { forkZs } = r.groups;
    assert.equal(forkZs.count, 4);
    for (let i = 0; i < 4; i++) {
      const f = inst(forkZs, i);
      near(f.s.x, ROD_D / 2, 0.001, 'forkZ radius x is ROD_D/2 (20mm profile width)');
      near(f.s.y, RAIL_D / 2, 0.001, 'forkZ radius y is RAIL_D/2 (12mm profile height)');
      near(f.s.z, 0.11, 0.001, 'forkZ length is 110mm');
    }
  } finally {
    r.dispose();
  }
});

// ----------------- MODEL-01: rod/tower脚轮刹车模型 -----------------
test('MODEL-01: rod与tower脚轮按采购清单表达真实刹车踏板', () => {
  // rod with casters: 4 wheels including 2 with brakes
  const rod = buildRodRack({ style: 'poster', casters: true });
  try {
    const wheels = rod.groups.wheels;
    let brakeMesh = null;
    wheels.traverse(child => {
      if (child.name?.includes('brake')) brakeMesh = child;
    });
    assert.ok(brakeMesh, 'rod wheels must have brake mesh');
    assert.equal(brakeMesh.count, 2, 'rod wheels have 2 brakes for the front 2 wheels');
  } finally {
    rod.dispose();
  }

  // tower with base (casters): 4 wheels all with brakes
  const tower = buildBookshelf({ style: 'tower', base: true });
  try {
    const wheels = tower.groups.wheels;
    let brakeMesh = null;
    wheels.traverse(child => {
      if (child.name?.includes('brake')) brakeMesh = child;
    });
    assert.ok(brakeMesh, 'tower wheels must have brake mesh');
    assert.equal(brakeMesh.count, 4, 'tower wheels have 4 brakes');
  } finally {
    tower.dispose();
  }
});

// ----------------- BOOK-01: 外挂斜托和贯穿杆承托到有限层板 -----------------
test('BOOK-01: 全配置矩阵(3 depths x 3 tilts)下有限板底与外挂圆杆确有物理接触/搭接且计入核重', () => {
  for (const depth of [0.28, 0.34, 0.45]) {
    for (const tilt of [20, 30, 40]) {
      const b = buildBookshelf({ style: 'tower', depth, tilt, bays: 1, levels: 2, books: false, acrylic: false });
      try {
        const { panels, shelfBrackets } = b.groups;
        assert.ok(shelfBrackets, 'shelfBrackets exist');
        assert.equal(shelfBrackets.count, panels.count * 4, '4 brackets per panel');

        for (let i = 0; i < panels.count; i++) {
          const pan = inst(panels, i);
          const panelHalfLen = pan.s.y / 2;
          const panelThick = 0.014;
          const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pan.q);
          const tangent = new THREE.Vector3(0, 1, 0).applyQuaternion(pan.q);

          // Check left & right brackets for this panel
          for (let k = 0; k < 4; k++) {
            const brk = inst(shelfBrackets, i * 4 + k);
            const rel = brk.p.clone().sub(pan.p);
            const relNorm = rel.dot(normal);
            const relTang = rel.dot(tangent);

            // Bracket normal extent: center at -0.014, thickness 0.014 -> [-0.021, -0.007]
            // Panel underside is at normal = -panelThick / 2 = -0.007
            const brkTopNorm = relNorm + 0.014 / 2;
            near(brkTopNorm, -panelThick / 2, 0.0005, 'bracket top face touches panel underside');

            // Bracket spans along tangent inside the panel length
            assert.ok(Math.abs(relTang) < panelHalfLen, 'bracket sits within panel length range');

            // Bracket extends under the panel edge with >= 10mm overlap
            // and encompasses the diagonal brace axis
            const bndX = (b.config.bayW) / 2; // for 1 bay centered, post Xs are ±bndX
            const isRight = brk.p.x > 0;
            const braceX = isRight ? (bndX + 0.03) : (-bndX - 0.03);
            const panelEdgeX = isRight ? (bndX - 0.025) : (-bndX + 0.025);

            const brkMinX = brk.p.x - 0.080 / 2;
            const brkMaxX = brk.p.x + 0.080 / 2;

            // Encloses brace
            assert.ok(braceX >= brkMinX && braceX <= brkMaxX, 'bracket physically encompasses diagonal brace');
            // Encloses panel edge with overlap
            assert.ok(panelEdgeX >= brkMinX && panelEdgeX <= brkMaxX, 'bracket extends under panel underside');
            if (isRight) {
              assert.ok(panelEdgeX - brkMinX >= 0.010, '>=10mm lap under right panel edge');
            } else {
              assert.ok(brkMaxX - panelEdgeX >= 0.010, '>=10mm lap under left panel edge');
            }
          }
        }
        // Assert hardware BOM contains brackets
        assert.ok(b.stats.hardware.some(h => h.name === '斜层板承托托臂' && h.qty === panels.count * 4));
      } finally {
        b.dispose();
      }
    }
  }
});

// ----------------- BOOK-02: 展示塔亚克力前挡与独立支座两端连续连接且不穿书 -----------------
test('BOOK-02: 亚克力前挡支座两端连续连接且绝不穿入样书，核重计入支座', () => {
  for (const depth of [0.28, 0.34, 0.45]) {
    const b = buildBookshelf({ style: 'tower', depth, bays: 1, levels: 2, books: true, acrylic: true });
    try {
      const { acrylic, acrylicStandoffs, books, panels } = b.groups;
      assert.ok(acrylic && acrylicStandoffs && books && panels);

      for (let i = 0; i < panels.count; i++) {
        const pan = inst(panels, i);
        const book = books.children[i];
        const acr = inst(acrylic, i);

        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pan.q);

        // Standoffs connect both ends:
        // Panel front face is at +0.007
        // Acrylic back face is at acrCenter.normal - 0.005/2
        const acrRelNorm = acr.p.clone().sub(pan.p).dot(normal);
        const acrBackNorm = acrRelNorm - 0.005 / 2;
        const panelFrontNorm = 0.014 / 2; // 0.007

        for (let k = 0; k < 2; k++) {
          const so = inst(acrylicStandoffs, i * 2 + k);
          const soRelNorm = so.p.clone().sub(pan.p).dot(normal);
          const soLen = 0.028;
          const soBottomNorm = soRelNorm - soLen / 2;
          const soTopNorm = soRelNorm + soLen / 2;

          near(soBottomNorm, panelFrontNorm, 0.0005, 'standoff bottom strictly meets panel front surface');
          near(soTopNorm, acrBackNorm, 0.0005, 'standoff top strictly meets acrylic back surface');

          // Verify standoff does not penetrate sample book along X:
          const bookHalfW = book.scale.x / 2; // book width
          const bookLeft = book.position.x - bookHalfW;
          const bookRight = book.position.x + bookHalfW;
          assert.ok(so.p.x > bookRight + 0.05 || so.p.x < bookLeft - 0.05,
            `standoff at x=${so.p.x.toFixed(3)} must clear book [${bookLeft.toFixed(3)}, ${bookRight.toFixed(3)}]`);
        }
      }
      assert.ok(b.stats.hardware.some(h => h.name.includes('亚克力前挡（含 standoff）')));
    } finally {
      b.dispose();
    }
  }
});

// ----------------- BOOK-03: 展示塔前挡唇与斜板连续面接触且无体积穿透 -----------------
test('BOOK-03: 前挡唇贴合板前端面，切向接触面相等且无正穿透，法向覆盖板厚', () => {
  for (const depth of [0.28, 0.34, 0.45]) {
    for (const tilt of [20, 30, 40]) {
      const b = buildBookshelf({ style: 'tower', depth, tilt, bays: 1, levels: 2, books: false, acrylic: false });
      try {
        const { panels, lips } = b.groups;
        for (let i = 0; i < panels.count; i++) {
          const pan = inst(panels, i);
          const lip = inst(lips, i);

          const tangent = new THREE.Vector3(0, 1, 0).applyQuaternion(pan.q);
          const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(pan.q);

          const rel = lip.p.clone().sub(pan.p);
          const relTang = rel.dot(tangent);
          const relNorm = rel.dot(normal);

          const panelHalfLen = pan.s.y / 2;
          const lipThickTang = 0.012;
          const lipThickNorm = 0.028;

          // Tangent bounds:
          const lipTangMax = relTang + lipThickTang / 2;
          const panTangMin = -panelHalfLen;

          // Numerical assertion: contact plane equality
          near(lipTangMax, panTangMin, 1e-5, 'lip upper tangent face strictly matches panel lower edge');
          // Numerical assertion: zero positive box penetration
          const positivePenetration = Math.max(0, lipTangMax - panTangMin);
          near(positivePenetration, 0, 1e-5, 'zero positive penetration between lip and panel');

          // Normal bounds:
          const lipNormMin = relNorm - lipThickNorm / 2;
          const lipNormMax = relNorm + lipThickNorm / 2;
          const panNormMin = -0.014 / 2; // -0.007
          const panNormMax = 0.014 / 2;  // +0.007

          // Lip must completely cover panel thickness [-0.007, 0.007] at contact plane
          assert.ok(lipNormMin <= panNormMin + 1e-5, 'lip covers panel bottom corner');
          assert.ok(lipNormMax >= panNormMax, 'lip covers panel top corner and extends upward');
          // And extends above panel by >= 10mm as book lip
          assert.ok(lipNormMax - panNormMax >= 0.010, 'lip sticks out above panel to retain books');
        }
      } finally {
        b.dispose();
      }
    }
  }
});

// ----------------- BOOK-04: TILT倾角控件修改配置实际改变模型 -----------------
test('BOOK-04: tilt从20到40度实际改变层板倾角及联动构件', () => {
  const b20 = buildBookshelf({ style: 'tower', tilt: 20 });
  const b40 = buildBookshelf({ style: 'tower', tilt: 40 });
  try {
    const p20 = inst(b20.groups.panels, 0);
    const p40 = inst(b40.groups.panels, 0);
    // Slope angles should differ
    const slope20 = new THREE.Vector3(0, 1, 0).applyQuaternion(p20.q);
    const slope40 = new THREE.Vector3(0, 1, 0).applyQuaternion(p40.q);
    const angle20 = Math.atan2(slope20.y, Math.abs(slope20.z)) * 180 / Math.PI;
    const angle40 = Math.atan2(slope40.y, Math.abs(slope40.z)) * 180 / Math.PI;

    near(angle20, 20, 1.0, '20 deg tilt produces 20 deg inclination');
    near(angle40, 40, 1.0, '40 deg tilt produces 40 deg inclination');
    assert.ok(Math.abs(angle40 - angle20) > 15, 'tilt angle must differ significantly between 20 and 40');
  } finally {
    b20.dispose();
    b40.dispose();
  }
});

// ----------------- TABLE-01: 长桌支撑点标记数据 -----------------
test('TABLE-01: 长桌填充stats.supports且与真实脚垫点位一致', () => {
  for (const tBays of [1, 2, 3]) {
    const b = buildBookshelf({ style: 'table', tBays, tBayW: 0.7, depth: 0.45 });
    try {
      assert.ok(b.stats.supports, 'stats.supports must exist for table');
      assert.equal(b.stats.supports.kind, 'feet');
      const expectedCount = (tBays + 1) * 2;
      assert.equal(b.stats.supports.points.length, expectedCount);
      // Verify points match tableLevelFeet positions
      const feet = b.groups.tableLevelFeet;
      for (let i = 0; i < feet.count; i++) {
        const f = inst(feet, i);
        const match = b.stats.supports.points.some(pt =>
          Math.abs(pt[0] - f.p.x) < 0.001 && Math.abs(pt[2] - f.p.z) < 0.001
        );
        assert.ok(match, `foot ${i} position must match a support point`);
      }
    } finally {
      b.dispose();
    }
  }
});

// ----------------- TABLE-02: 开启玻璃副层板及支承自重变化 -----------------
test('TABLE-02: glassTop开关严格影响长桌总重', () => {
  const withoutGlass = buildBookshelf({ style: 'table', glassTop: false });
  const withGlass = buildBookshelf({ style: 'table', glassTop: true });
  try {
    const delta = withGlass.stats.weightKg - withoutGlass.stats.weightKg;
    assert.ok(delta > 10, `weight difference (${delta}kg) must reflect 8mm glass + metal stands`);
    // Expected glass weight alone is ~ (W-0.04)*(D-0.02)*0.008*2500
    const W = withGlass.config.tBays * withGlass.config.tBayW;
    const D = withGlass.config.depth + 0.3;
    const glassWeight = (W - 0.04) * (D - 0.02) * 0.008 * 2500;
    assert.ok(delta >= glassWeight, `delta (${delta}) must be >= glass sheet weight (${glassWeight})`);
  } finally {
    withoutGlass.dispose();
    withGlass.dispose();
  }
});

// ----------------- Supports Caster Center Trailing Offset -----------------
test('stats.supports轮中心包含真实拖尾偏移', () => {
  // rod
  const rod = buildRodRack({ style: 'poster', casters: true });
  try {
    assert.equal(rod.stats.supports.kind, 'casters');
    // Each outer caster has trail = 0.023 shifted away from center
    for (const pt of rod.stats.supports.points) {
      const sx = Math.sign(pt[0]);
      // original mount is at ±0.40. Trailing outward means |x| = 0.40 + 0.023 = 0.423
      assert.ok(Math.abs(pt[0]) > 0.41, `rod caster point X (${pt[0]}) must include 23mm trail offset`);
    }
  } finally {
    rod.dispose();
  }

  // tower
  const tower = buildBookshelf({ style: 'tower', base: true });
  try {
    assert.equal(tower.stats.supports.kind, 'casters');
    // Each tower caster has trail = 0.01 shifted away from center
    for (const pt of tower.stats.supports.points) {
      const origMountX = Math.sign(pt[0]) * (tower.config.bays * tower.config.bayW / 2 - 0.06);
      assert.ok(Math.abs(pt[0]) > Math.abs(origMountX) + 0.005,
        `tower caster point X (${pt[0]}) must include 10mm trail offset`);
    }
  } finally {
    tower.dispose();
  }
});
