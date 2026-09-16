# GLB 精确节点配置恢复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 GLB 精确节点模式修正截面朝向，并恢复参考估价、阳极氧化颜色、摆件与背面侧挡板，同时保持标准参数架回归基线不变。

**Architecture:** 在 `src/core/buildGlbFrame.js` 内拆分精确模式的布局、算料、材质、摆件与背板职责；通过 `src/main.js` 接线层同步精确模式价格注记。严格不修改仓库列为不可动的 `buildShelf.js / profiles.js / panel.js / store.js / product.js / dimensions.js / hotspots.js`。

**Tech Stack:** Three.js 0.170、Node.js `node:test`、Vite 5 单文件构建、Windows cmd。

---

## 文件结构

- Modify `src/core/buildGlbFrame.js`
  - 保留 `glbLayout()` 与正式构建契约 `{ group, groups, layout, stats, bounds, dispose }`。
  - 增加结构算料、颜色材质、摆件、背板、开放侧端面元数据。
- Modify `src/main.js`
  - 只在型材精确模式统计同步后更新价格注记文本；不改动标准参数架行为。
- Modify `test/glb-node-placement.test.mjs`
  - 更新截面方向契约，断言开放侧精确端面。
- Create `test/glb-config-restoration.test.mjs`
  - 覆盖价格算料、未计价项、颜色、摆件、背板。
- Modify `test/glb-material-isolation.test.mjs`
  - 在彩色材质下继续验证 reveal 分组材质隔离。
- Create/modify `.openclaw/tmp/alu-stage/**`
  - 仓库 AGENTS.md 要求所有代码先放入 staging，通过 `node --check` 后再 `robocopy` 回仓库。
- No git commit step: 当前 `F:\Autoclaw\alu_extrusion` 不是 git 仓库；每个任务完成后用对应测试作为检查点。

---

## 运行与验证约定

- 全量测试命令：`npm test`
- 构建命令：`npm run build`
- 语法检查命令：`node --check <file>`
- 标准参数架回归基线由 `test/geometry-support.test.mjs` 中的 byte-for-byte 基线保护；实施完成时还必须运行：
  `node -e "import('./src/core/buildShelf.js').then(async({buildShelf})=>{globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};const s=buildShelf({bays:6,levels:6,series:'2040',decks:Array(6).fill('rib'),bayWidths:Array(6).fill(.57),sidePanels:true,props:false,color:'silver'},false);console.log(s.stats.weightKg.toFixed(1),s.stats.partCount,s.stats.profileLengthM.toFixed(1));s.dispose()})"`
  预期关键输出：`177.8 1956 104.0`（若输出与基线不一致，不得宣称完成）。

---

## Task 1: 反转 GLB 进深构件截面方向

**Files:**
- Modify: `F:/Autoclaw/alu_extrusion/src/core/buildGlbFrame.js`
- Test: `F:/Autoclaw/alu_extrusion/test/glb-node-placement.test.mjs`
- Staging: `F:/Autoclaw/alu_extrusion/.openclaw/tmp/alu-stage/src/core/buildGlbFrame.js`

- [ ] **Step 1: 将现有文件复制到 staging，并追加失败测试到现有测试文件**

在 `test/glb-node-placement.test.mjs` 顶部保持现有导入，并新增 Three.js 导入。完整测试文件替换为：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { glbLayout, buildGlbFrame } from '../src/core/buildGlbFrame.js';

test('GLB layout has no invented floating mid-bay connector grid', () => {
  const a = glbLayout({ bayWidths: [.57, .57], levels: 3 });
  assert.equal(a.rows.connectors, undefined);
  assert.equal(a.rows.bolts, undefined);
});

test('exact joint section is installed on depth members at post lines', () => {
  const a = glbLayout({ bayWidths: [.57, .57], levels: 3 });
  assert.deepEqual([...new Set(a.rows.depth.map(r => r[0]))], [-.57, 0, .57]);
  const b = buildGlbFrame({ bayWidths: [.57, .57], levels: 3 });
  assert.equal(b.groups.connectors, undefined);
  assert.equal(b.groups.bolts, undefined);
  assert.ok(b.groups.depth);
  b.dispose();
});

test('depth member keeps GLB extent while exposing the original section on the open side', () => {
  const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 3 });
  assert.ok(built.layout.ends, 'layout must expose depth end metadata');
  assert.equal(built.layout.ends.backSideZ, -.20);
  assert.equal(built.layout.ends.openSideZ, .17);
  assert.equal(built.layout.ends.exposedSectionZ, .17);

  const matrix = new THREE.Matrix4();
  built.groups.depth.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.z - .17) < 1e-9);

  built.groups.depth.geometry.computeBoundingBox();
  const box = built.groups.depth.geometry.boundingBox.clone().applyMatrix4(matrix);
  assert.ok(Math.abs(box.min.z - -.20) < 1e-6);
  assert.ok(Math.abs(box.max.z - .17) < 1e-6);
  built.dispose();
});
```

把测试文件按仓库 AGENTS.md 工作流先写入 staging 对应位置 `F:/Autoclaw/alu_extrusion/.openclaw/tmp/alu-stage/test/glb-node-placement.test.mjs`，再用 Windows 命令复制回仓库：

```bat
if not exist .openclaw\tmp\alu-stage\test mkdir .openclaw\tmp\alu-stage\test
copy /y test\glb-node-placement.test.mjs .openclaw\tmp\alu-stage\test\glb-node-placement.test.mjs
node --check .openclaw\tmp\alu-stage\test\glb-node-placement.test.mjs
copy /y .openclaw\tmp\alu-stage\test\glb-node-placement.test.mjs test\glb-node-placement.test.mjs
```

- [ ] **Step 2: 运行新增测试并确认失败**

Run:

```bat
npm test -- --test-name-pattern "depth member keeps GLB extent"
```

Expected: FAIL；`layout.ends` 为 `undefined`。如果测试立即通过，停止并检查测试是否误测既有行为。

- [ ] **Step 3: 在 staging 修改 `src/core/buildGlbFrame.js` 实现固定方向**

将当前紧凑实现替换为同职责的可读实现（完整文件）：

```js
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

const DEPTH_BACK_Z = -0.20;
const DEPTH_OPEN_Z = 0.17;

export function glbLayout({ bayWidths = [.57, .57, .57, .57, .57, .57], levels = 5 } = {}) {
  if (!Array.isArray(bayWidths) || !bayWidths.length || bayWidths.some(w => !Number.isFinite(w) || w < .3 || w > 1.2) || !Number.isInteger(levels) || levels < 1 || levels > 8) {
    throw Error('Invalid reference dimensions');
  }
  const W = bayWidths.reduce((a, b) => a + b, 0);
  const H = levels * .46 + .03;
  const xs = [-W / 2];
  for (const w of bayWidths) xs.push(xs.at(-1) + w);
  const rows = { posts: [], segments: [], depth: [], strips: [], battens: [] };
  for (const x of xs) {
    rows.posts.push([x, 0, .185]);
    for (let k = 0; k < levels; k++) rows.segments.push([x, k * .46 + .03, -.185]);
    for (let k = 0; k <= levels; k++) rows.depth.push([x, k * .46 + .015, DEPTH_OPEN_Z]);
  }
  for (let k = 0; k <= levels; k++) {
    for (let b = 0; b < bayWidths.length; b++) {
      const n = Math.floor((bayWidths[b] - .03) / .02 + 1e-7);
      const start = (xs[b] + xs[b + 1]) / 2 - (n - 1) * .01;
      for (let r = 0; r < n; r++) {
        const x = start + r * .02;
        if (Math.abs(x) < .020) continue;
        rows.strips.push([x, k * .46 + .01, DEPTH_BACK_Z]);
      }
    }
    // Derived visual continuous rails, NOT a claim about supplier splice locations.
    for (const z of [-.14439, -.12439, .07615, .09615, .11615, .13615]) {
      rows.battens.push([0, k * .46 - .005, z]);
    }
  }
  return {
    W,
    H,
    rows,
    ends: {
      backSideZ: DEPTH_BACK_Z,
      openSideZ: DEPTH_OPEN_Z,
      exposedSectionZ: DEPTH_OPEN_Z,
    },
  };
}

function orientDepthGeometry(geometry) {
  // Local extrusion starts at z=0; reverse it so the original extracted end cap
  // faces the open side while the world-space extent remains [-0.20, +0.17].
  geometry.rotateY(Math.PI);
  geometry.translate(0, 0, DEPTH_OPEN_Z - DEPTH_BACK_Z);
  return geometry;
}

export function buildGlbFrame(config) {
  const layout = glbLayout(config);
  const group = new THREE.Group();
  const groups = {};
  const side = new THREE.MeshStandardMaterial({ color: 0xb9c2c9, metalness: .65, roughness: .4 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xdce0e3, metalness: .45, roughness: .65 });
  const geometries = {
    posts: extrudeUp(makeTSlotShape(.03, .03), layout.H),
    segments: extrudeUp(makeTSlotShape(.03, .03), .43),
    depth: orientDepthGeometry(extrudeAlongZ(makeGlbJointShape(), .37)),
    strips: extrudeAlongZ(makeGlbStripShape(), .4),
    battens: extrudeAlongX(makeTSlotShape(.02, .01), layout.W + .03),
  };
  for (const [key, rows] of Object.entries(layout.rows)) {
    const mesh = new THREE.InstancedMesh(geometries[key], [cap.clone(), side.clone()], rows.length);
    mesh.name = key;
    rows.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    groups[key] = mesh;
  }
  const stats = {
    cutList: [],
    hardware: [],
    panes: [],
    partCount: Object.values(layout.rows).reduce((n, r) => n + r.length, 0),
    profileLengthM: 0,
    weightKg: 0,
    referenceOnly: true,
  };
  const bounds = { W: layout.W, H: layout.H, D: .40 };
  return {
    group,
    groups,
    layout,
    stats,
    bounds,
    dispose() {
      Object.values(geometries).forEach(g => g.dispose());
      for (const mesh of Object.values(groups)) {
        for (const mat of mesh.material) mat.dispose();
      }
      side.dispose();
      cap.dispose();
    },
  };
}
```

Staging workflow:

```bat
if not exist .openclaw\tmp\alu-stage\src\core mkdir .openclaw\tmp\alu-stage\src\core
rem 将上面的完整内容写入 .openclaw\tmp\alu-stage\src\core\buildGlbFrame.js
node --check .openclaw\tmp\alu-stage\src\core\buildGlbFrame.js
copy /y .openclaw\tmp\alu-stage\src\core\buildGlbFrame.js src\core\buildGlbFrame.js
```

- [ ] **Step 4: 运行目标测试确认通过**

Run:

```bat
npm test -- --test-name-pattern "depth member keeps GLB extent"
```

Expected: PASS。

- [ ] **Step 5: 运行 GLB 既有测试确认无回归**

Run:

```bat
npm test -- --test-name-pattern "GLB"
```

Expected: PASS；若 `strips` 或旧方向测试失败，只更新测试断言的方向含义，不改变用户确认的 B 方向。

- [ ] **Step 6: 检查点**

Record: 修改文件、目标测试输出、GLB 测试输出。当前仓库无 git，不执行 commit。

---

## Task 2: 精确模式结构算料与参考估价

**Files:**
- Modify: `F:/Autoclaw/alu_extrusion/src/core/buildGlbFrame.js`
- Test: `F:/Autoclaw/alu_extrusion/test/glb-config-restoration.test.mjs`

- [ ] **Step 1: 创建失败测试文件**

Create `F:/Autoclaw/alu_extrusion/test/glb-config-restoration.test.mjs`（先经 staging，再复制回仓库）：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlbFrame } from '../src/core/buildGlbFrame.js';
import { calcMarketPrice } from '../src/ui/marketPrice.js';

test('GLB exact mode emits real cut list, positive mass and explicit unpriced reference items', () => {
  const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 3, props: false, sidePanels: false });
  assert.ok(built.stats.cutList.length >= 5);
  assert.ok(built.stats.profileLengthM > 1);
  assert.ok(built.stats.weightKg > 0.5);

  const quote = calcMarketPrice(built.stats);
  assert.ok(quote.total > 0);
  assert.equal(quote.complete, false);
  assert.ok(quote.unpriced.some(name => /30×30/.test(name)));
  assert.ok(quote.unpriced.some(name => /连接方式/.test(name)));
  assert.ok(built.stats.cutList.some(c => c.section === '20×20'));

  built.dispose();
});

test('GLB exact mode stats respond to bays and levels', () => {
  const small = buildGlbFrame({ bayWidths: [.57, .57], levels: 2, props: false, sidePanels: false });
  const large = buildGlbFrame({ bayWidths: [.57, .57, .8], levels: 3, props: false, sidePanels: false });
  assert.ok(large.stats.profileLengthM > small.stats.profileLengthM);
  assert.ok(large.stats.weightKg > small.stats.weightKg);
  assert.ok(large.stats.partCount > small.stats.partCount);
  small.dispose();
  large.dispose();
});
```

Staging workflow:

```bat
copy /y test\glb-config-restoration.test.mjs .openclaw\tmp\alu-stage\test\glb-config-restoration.test.mjs
node --check .openclaw\tmp\alu-stage\test\glb-config-restoration.test.mjs
copy /y .openclaw\tmp\alu-stage\test\glb-config-restoration.test.mjs test\glb-config-restoration.test.mjs
```

- [ ] **Step 2: 运行新测试并确认失败**

Run:

```bat
npm test -- --test-name-pattern "GLB exact mode"
```

Expected: FAIL，第一处失败为 `built.stats.cutList.length >= 5`。

- [ ] **Step 3: 在 `buildGlbFrame.js` 增加独立算料函数**

在 `buildGlbFrame(config)` 之前插入：

```js
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

  const sectionAreas = {
    '30×30': 1.8e-4,
    '20×20': 1.18e-4,
    '20×10': 5.9e-5,
  };
  const profileLengthM = cutList.reduce((sum, c) => sum + c.len * c.qty, 0);
  const weightKg = cutList.reduce((sum, c) => sum + c.len * c.qty * sectionAreas[c.section], 0) * 2700;

  return {
    cutList,
    hardware: [
      { name: 'GLB 精确节点连接方式（未核价）', qty: depth },
    ],
    panes: [],
    partCount: posts + segments + depth + strips + battens,
    profileLengthM: +profileLengthM.toFixed(1),
    weightKg: +weightKg.toFixed(1),
    referenceOnly: true,
  };
}
```

并把 `buildGlbFrame()` 中现有硬编码 `stats` 对象替换为：

```js
const stats = makeGlbStats(layout, config);
```

Staging workflow:

```bat
node --check .openclaw\tmp\alu-stage\src\core\buildGlbFrame.js
copy /y .openclaw\tmp\alu-stage\src\core\buildGlbFrame.js src\core\buildGlbFrame.js
```

- [ ] **Step 4: 运行新测试确认通过**

Run:

```bat
npm test -- --test-name-pattern "GLB exact mode"
```

Expected: PASS。

- [ ] **Step 5: 运行价格回归与 GLB 测试**

Run:

```bat
npm test -- --test-name-pattern "GLB|未知规格|BOM计价"
```

Expected: PASS；既有价格规则不被破坏。

- [ ] **Step 6: 检查点**

Record: 新测试输出与价格回归输出。当前仓库无 git，不执行 commit。

---

## Task 3: 恢复精确模式阳极氧化颜色

**Files:**
- Modify: `F:/Autoclaw/alu_extrusion/src/core/buildGlbFrame.js`
- Test: `F:/Autoclaw/alu_extrusion/test/glb-config-restoration.test.mjs`
- Modify: `F:/Autoclaw/alu_extrusion/test/glb-material-isolation.test.mjs`

- [ ] **Step 1: 追加失败颜色测试**

在 `test/glb-config-restoration.test.mjs` 末尾追加：

```js
test('GLB exact mode applies anodized color while keeping cut faces distinct', () => {
  const expected = { silver: 0x9ba1a8, black: 0x24262a, champagne: 0xb89f78 };
  for (const [color, hex] of Object.entries(expected)) {
    const built = buildGlbFrame({ bayWidths: [.57, .57], levels: 2, props: false, sidePanels: false, color });
    const sideMaterial = built.groups.posts.material[1];
    const capMaterial = built.groups.posts.material[0];
    assert.equal(sideMaterial.color.getHex(), hex);
    assert.notEqual(capMaterial.color.getHex(), sideMaterial.color.getHex());
    built.dispose();
  }
});
```

同时把 `test/glb-material-isolation.test.mjs` 中的构建调用改为彩色配置：

```js
const b = buildGlbFrame({ bayWidths: [.57, .57], levels: 3, color: 'champagne' });
```

Staging workflow:

```bat
node --check .openclaw\tmp\alu-stage\test\glb-config-restoration.test.mjs
node --check .openclaw\tmp\alu-stage\test\glb-material-isolation.test.mjs
copy /y .openclaw\tmp\alu-stage\test\glb-config-restoration.test.mjs test\glb-config-restoration.test.mjs
copy /y .openclaw\tmp\alu-stage\test\glb-material-isolation.test.mjs test\glb-material-isolation.test.mjs
```

- [ ] **Step 2: 运行颜色测试并确认失败**

Run:

```bat
npm test -- --test-name-pattern "anodized color"
```

Expected: FAIL，silver 期望 `0x9ba1a8`，当前为 `0xb9c2c9`。

- [ ] **Step 3: 添加精确模式材质工厂并接入 build**

在 `buildGlbFrame.js` 中导入颜色配置：

```js
import { COLORS } from '../config/product.js';
```

在 `buildGlbFrame(config)` 内替换材质创建：

```js
const colorCfg = COLORS[config?.color] || COLORS.silver;
const side = new THREE.MeshStandardMaterial({
  color: colorCfg.hex,
  metalness: colorCfg.metalness,
  roughness: colorCfg.roughness,
});
const cap = new THREE.MeshStandardMaterial({
  color: colorCfg.hex,
  metalness: Math.max(.25, colorCfg.metalness - .15),
  roughness: Math.min(.8, colorCfg.roughness + .3),
});
```

注意：现有 `mesh.material[0]` 是 `cap.clone()`，材料名保持 `[cap, side]` 顺序。

- [ ] **Step 4: 运行颜色与材质隔离测试**

Run:

```bat
npm test -- --test-name-pattern "anodized color|materials"
```

Expected: PASS。

- [ ] **Step 5: 运行全量测试**

Run:

```bat
npm test
```

Expected: PASS。

- [ ] **Step 6: 检查点**

Record: 全量测试输出。当前仓库无 git，不执行 commit。

---

## Task 4: 恢复精确模式摆件开关

**Files:**
- Modify: `F:/Autoclaw/alu_extrusion/src/core/buildGlbFrame.js`
- Test: `F:/Autoclaw/alu_extrusion/test/glb-config-restoration.test.mjs`

- [ ] **Step 1: 追加失败摆件测试**

在 `test/glb-config-restoration.test.mjs` 末尾追加：

```js
test('GLB exact mode props switch creates deterministic display-only props on deck levels', () => {
  const cfg = {
    bayWidths: [.57, .57],
    levels: 3,
    decks: ['rib', 'none', 'rib'],
    sidePanels: false,
    color: 'silver',
    props: true,
  };
  const a = buildGlbFrame(cfg);
  const b = buildGlbFrame(cfg);
  assert.ok(a.groups.props);
  assert.equal(a.groups.props.userData.displayOnly, true);
  assert.ok(a.groups.props.children.length > 0);
  assert.equal(a.groups.props.children.length, b.groups.props.children.length);
  assert.ok(a.groups.props.children.every(child => Math.abs(child.position.y - (.01 + .02)) < 1e-9 || Math.abs(child.position.y - (.92 + .01 + .02)) < 1e-9));

  const off = buildGlbFrame({ ...cfg, props: false });
  assert.equal(off.groups.props, undefined);
  a.dispose();
  b.dispose();
  off.dispose();
});
```

- [ ] **Step 2: 运行摆件测试并确认失败**

Run:

```bat
npm test -- --test-name-pattern "props switch"
```

Expected: FAIL，`groups.props` 当前不存在。

- [ ] **Step 3: 实现独立摆件构建器**

在 `buildGlbFrame.js` 顶部导入材质：

```js
import { getPropMaterials } from './materials.js';
```

在 `makeGlbStats()` 前插入：

```js
function buildGlbProps(layout, config) {
  const decks = Array.isArray(config.decks) ? config.decks : [];
  const bayWidths = config.bayWidths || [.57];
  const levels = config.levels || 1;
  const xs = [-layout.W / 2];
  for (const w of bayWidths) xs.push(xs.at(-1) + w);

  const root = new THREE.Group();
  root.name = 'props';
  root.userData.displayOnly = true;
  const propMaterials = getPropMaterials();
  let seed = 42 + bayWidths.length * 7 + levels * 13;
  for (const w of bayWidths) seed = (seed * 31 + Math.round(w * 100)) % 2147483647;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const geometries = {
    bag: new THREE.BoxGeometry(.30, .40, .14),
    books: new THREE.BoxGeometry(.22, .05, .16),
    vase: new THREE.CylinderGeometry(.055, .075, .24, 14),
    box: new THREE.BoxGeometry(.34, .20, .26),
  };
  const heights = { bag: .40, books: .15, vase: .24, box: .20 };
  const kinds = Object.keys(geometries);
  const deckTopY = k => k * .46 + .01 + .02;

  for (let k = 0; k < levels; k++) {
    if (decks[k] === 'none') continue;
    const count = Math.max(1, Math.round(bayWidths.length / 2));
    for (let n = 0; n < count; n++) {
      const kind = kinds[Math.floor(rand() * kinds.length)];
      const bay = Math.floor(rand() * bayWidths.length);
      const margin = .22;
      const x = xs[bay] + margin + rand() * Math.max(.05, bayWidths[bay] - margin * 2);
      const z = (rand() - .5) * .24;
      const mesh = new THREE.Mesh(
        geometries[kind],
        propMaterials[kind][Math.floor(rand() * propMaterials[kind].length)],
      );
      mesh.position.set(x, deckTopY(k) + heights[kind] / 2, z);
      mesh.rotation.y = (rand() - .5) * .6;
      root.add(mesh);
    }
  }

  return { root, geometries };
}
```

在 `buildGlbFrame(config)` 中 `groups` 创建后、stats 创建前加入：

```js
let propsAssets = null;
if (config?.props) {
  propsAssets = buildGlbProps(layout, config);
  if (propsAssets.root.children.length) {
    group.add(propsAssets.root);
    groups.props = propsAssets.root;
  }
}
```

在 `dispose()` 中释放：

```js
if (propsAssets) {
  Object.values(propsAssets.geometries).forEach(g => g.dispose());
  propsAssets.root.traverse(o => {
    if (o.isMesh && o.material && !Object.values(getPropMaterials()).flat().includes(o.material)) o.material.dispose();
  });
}
```

说明：`getPropMaterials()` 返回共享缓存材质，不逐摆件释放；`disposeMaterialCache()` 负责共享材质生命周期。

- [ ] **Step 4: 运行摆件测试确认通过**

Run:

```bat
npm test -- --test-name-pattern "props switch"
```

Expected: PASS。

- [ ] **Step 5: 运行几何与材质测试**

Run:

```bat
npm test -- --test-name-pattern "props switch|GLB exact|materials"
```

Expected: PASS。

- [ ] **Step 6: 检查点**

Record: 目标测试输出。当前仓库无 git，不执行 commit。

---

## Task 5: 恢复精确模式背面侧挡板

**Files:**
- Modify: `F:/Autoclaw/alu_extrusion/src/core/buildGlbFrame.js`
- Test: `F:/Autoclaw/alu_extrusion/test/glb-config-restoration.test.mjs`

- [ ] **Step 1: 追加失败背板测试**

在 `test/glb-config-restoration.test.mjs` 末尾追加：

```js
test('GLB exact mode sidePanels switch places back panels on wall side only', () => {
  const cfg = {
    bayWidths: [.57, .57],
    levels: 3,
    decks: ['rib', 'none', 'rib'],
    props: false,
    sidePanels: true,
    color: 'silver',
  };
  const built = buildGlbFrame(cfg);
  assert.ok(built.groups.panels);
  assert.equal(built.groups.panels.count, 2);
  const matrix = new THREE.Matrix4();
  built.groups.panels.getMatrixAt(0, matrix);
  const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(pos.z < built.layout.ends.backSideZ + .03);
  assert.ok(pos.z > -.25);

  const off = buildGlbFrame({ ...cfg, sidePanels: false });
  assert.equal(off.groups.panels, undefined);
  built.dispose();
  off.dispose();
});
```

并在文件顶部加入：

```js
import * as THREE from 'three';
```

- [ ] **Step 2: 运行背板测试并确认失败**

Run:

```bat
npm test -- --test-name-pattern "sidePanels"
```

Expected: FAIL，`groups.panels` 当前不存在。

- [ ] **Step 3: 实现背板组**

在 `buildGlbFrame.js` 中新增几何与布局：

在 `buildGlbProps()` 前插入：

```js
function glbBackPanelRows(layout, config) {
  const rows = [];
  const decks = Array.isArray(config.decks) ? config.decks : [];
  const levels = config.levels || 1;
  for (let k = 0; k < levels; k++) {
    if (decks[k] === 'none') continue;
    rows.push([0, k * .46 + .20, -.206]);
  }
  return rows;
}
```

在 `buildGlbFrame(config)` 中：

```js
if (config?.sidePanels) {
  const panelRows = glbBackPanelRows(layout, config);
  if (panelRows.length) {
    const panelGeometry = new THREE.BoxGeometry(layout.W - .03, .36, .012);
    geometries.panels = panelGeometry;
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xc7cdd1, metalness: .45, roughness: .52 });
    const mesh = new THREE.InstancedMesh(panelGeometry, panelMaterial, panelRows.length);
    mesh.name = 'panels';
    panelRows.forEach(([x, y, z], i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    groups.panels = mesh;
  }
}
```

把 `geometries` 从固定字面量改为可变对象：

```js
const geometries = { ... };
// 保持为 const，但动态加入 panels 合法；dispose 遍历 Object.values 已覆盖 panels。
```

背板材质不需逐实例隔离；它是单一 `InstancedMesh`，由 `dispose()` 统一释放。

- [ ] **Step 4: 运行背板测试确认通过**

Run:

```bat
npm test -- --test-name-pattern "sidePanels"
```

Expected: PASS。

- [ ] **Step 5: 运行 GLB 与动画材质隔离测试**

Run:

```bat
npm test -- --test-name-pattern "GLB|materials|sidePanels"
```

Expected: PASS。

- [ ] **Step 6: 检查点**

Record: 目标测试输出。当前仓库无 git，不执行 commit。

---

## Task 6: 精确模式价格注记与导出保护

**Files:**
- Modify: `F:/Autoclaw/alu_extrusion/src/main.js`
- Test: `F:/Autoclaw/alu_extrusion/test/glb-config-restoration.test.mjs`

- [ ] **Step 1: 追加失败接线测试**

在 `test/glb-config-restoration.test.mjs` 末尾追加：

```js
test('GLB exact mode marks its price as a partial reference estimate and protects cut-list export', async () => {
  const source = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'));
  assert.match(source, /data-price-note/);
  assert.match(source, /参考估价（有未计价项时为已计价小计）/);
  assert.match(source, /frameMode === 'glb'.*参考估价/);
});
```

- [ ] **Step 2: 运行接线测试并确认失败**

Run:

```bat
npm test -- --test-name-pattern "partial reference estimate"
```

Expected: FAIL，当前 `main.js` 无该同步逻辑。

- [ ] **Step 3: 在 `main.js` 增加精确模式价格注记同步**

在 `let current = null;` 之后插入：

```js
function syncPriceNote() {
  const note = panelRoot.querySelector('.price-note');
  if (note) {
    note.textContent = store.get().frameMode === 'glb'
      ? '参考估价（有未计价项时为已计价小计）'
      : '示例材料估价';
  }
}
```

在 `profileActions.onAdd` 前不改变其逻辑；在 `mountActiveProduct()` 的型材分支中，`panel = createPanel(panelRoot, profileActions);` 后立即调用：

```js
syncPriceNote();
```

在 store 订阅的型材分支中，`rebuild()` 与 `syncStatsOnly()` 后调用：

```js
syncPriceNote();
```

为避免重复，把订阅回调改为：

```js
if (productKind === 'profile') { rebuild(); if (webglFailed) syncStatsOnly(); syncPriceNote(); }
```

- [ ] **Step 4: 运行接线测试确认通过**

Run:

```bat
npm test -- --test-name-pattern "partial reference estimate"
```

Expected: PASS。

- [ ] **Step 5: 保护导出路径**

当前 `onExport` 已检查 `!s || !s.cutList`，精确模式已有非空 `cutList`，无需改逻辑。补充测试确认 `stats.referenceOnly === true`，防止被误当正式采购 BOM：

在 `test/glb-config-restoration.test.mjs` 第一个测试中追加：

```js
assert.equal(built.stats.referenceOnly, true);
```

运行：

```bat
npm test -- --test-name-pattern "GLB exact mode emits"
```

Expected: PASS。

- [ ] **Step 6: 检查点**

Record: 接线测试输出。当前仓库无 git，不执行 commit。

---

## Task 7: 全量回归、构建与可见浏览器验证

**Files:**
- Verify only; no source changes unless a regression requires returning to the relevant task.

- [ ] **Step 1: 运行全量测试**

Run:

```bat
npm test
```

Expected: 全部通过；数量应至少包含新增 `glb-config-restoration.test.mjs` 的 5 个测试，并保持既有全部测试通过。

- [ ] **Step 2: 运行生产构建**

Run:

```bat
npm run build
```

Expected: PASS，生成 `dist/index.html`。

- [ ] **Step 3: 运行标准参数架回归基线命令**

Run:

```bat
node -e "import('./src/core/buildShelf.js').then(async({buildShelf})=>{globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};const s=buildShelf({bays:6,levels:6,series:'2040',decks:Array(6).fill('rib'),bayWidths:Array(6).fill(.57),sidePanels:true,props:false,color:'silver'},false);console.log(s.stats.weightKg.toFixed(1),s.stats.partCount,s.stats.profileLengthM.toFixed(1));s.dispose()})"
```

Expected: 输出 `177.8 1956 104.0`。

- [ ] **Step 4: 可见浏览器验证**

打开：

```text
file:///F:/Autoclaw/alu_extrusion/dist/index.html#profile/node
```

验证以下可观察事实：

1. 价格不再是固定 `¥ 0`。
2. 价格注记为 `参考估价（有未计价项时为已计价小计）`。
3. 市场来源行出现 `有未计价项`，并列出 30×30 或未核价节点。
4. 自重与主型材总长不再为 `0.0`。
5. 切换银/黑/香槟后，铝构件颜色立即变化。
6. 打开摆件开关出现摆件；关闭后消失。
7. 打开背面侧挡板出现墙面侧板；关闭后消失。
8. 节点近看中，露出的精确截面位于开放观看侧，不朝背板墙面。

如果任一可见事实失败，不要猜修；回到对应任务从失败测试开始修正。

- [ ] **Step 5: 最终交付说明**

报告必须包含：

- 修改文件列表；
- `npm test` 结果；
- `npm run build` 结果与 `dist/index.html` 大小；
- 标准参数架基线命令输出；
- 浏览器可见验证的 8 项结果；
- 未部署声明（除非用户另行明确授权部署）。

---

## 自检记录

- Spec coverage:
  - 截面 B 方向 → Task 1、Task 7.4。
  - 参考估价 C、未计价项 → Task 2、Task 6、Task 7.4。
  - 阳极颜色 → Task 3、Task 7.4。
  - 摆件 → Task 4、Task 7.4。
  - 背面侧挡板 → Task 5、Task 7.4。
  - 标准参数架基线 → Task 7.3。
  - 不修改受保护文件 → 文件结构与全部任务限定。
- Placeholder scan: 无 TBD/TODO/“稍后实现”；每个代码步骤给出完整代码或精确替换片段。
- Type consistency:
  - `buildGlbFrame()` 继续返回 `{ group, groups, layout, stats, bounds, dispose }`。
  - `layout.ends = { backSideZ, openSideZ, exposedSectionZ }`。
  - `stats` 字段保持报价引擎所需 `cutList/hardware/panes/partCount/profileLengthM/weightKg`。
  - 价格注记选择器使用 `.price-note`（现有 CSS/DOM），测试正则检查该同步逻辑。
