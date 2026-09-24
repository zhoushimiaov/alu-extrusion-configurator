# MODULO 移动端全屏、全品类爆炸图、光轴拖拽手柄与按钮 Hover 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现移动端全屏查看 3D 模型模式、打通全部产品（6 种）的结构爆炸图、将光轴展架拖拽手柄重构为极简工业图纸风、增强视口与面板底部全部按钮的 Hover 微动效与质感。

**Architecture:**
1. 移动端全屏：在视口挂载全屏/沉浸切换按钮，切换 `#layout` 的 `.mode-fullscreen-model`，动态收起 `#panel` 并重算视口与相机投影。
2. 全品类爆炸图：在所有产品 builder 中暴露规范的 `groups` 字典，并在 `anims.js` 的 `explode` 动作库中按部件分类配置三维爆炸位移与过渡动画，在 `main.js` 中接线 `active()?.groups`。
3. 光轴拖拽手柄：重写 `rodHandles.js`，采用极简工业图纸风的双向端子与导轨线，加入动态数值跟随徽标与放大高亮微交互。
4. 底部按钮 Hover：更新 `styles.css`，为 `#hud-right` 的 `chip`/`chip-toggle`、面板底部的 `.cta`/`.cta-ghost`/`.btn-diag` 等增加 `translateY(-2px)` 微浮起、柔和阴影与高亮。

**Tech Stack:** Three.js, Vanilla JS (ES Modules), CSS3 Variables / Grid / Transitions, Vite (Singlefile plugin).

## Global Constraints
- `src/core/buildShelf.js`、`src/core/profiles.js`、`src/ui/panel.js`、`src/ui/store.js`、`src/config/product.js`、`src/core/dimensions.js`、`src/core/hotspots.js` 为原封文件，绝对不可修改。
- `buildRodRack.js` 的物理结构尺寸保持与 `assets_src/guangzhou02-parts.json` 一致，改动前后均必须通过 `node rodtest.mjs`。
- 型材基线保持 177.8 kg / 1956 件 / 104.0 m 不变。
- 单文件构建必须通过 `npm run build` 产出有效的 `dist/index.html`。
- 测试必须保持 `npm test` 84/84 绿灯。

---

### Task 1: 移动端全屏看模型模式

**Files:**
- Modify: `index.html` (添加全屏切换按钮)
- Modify: `src/styles.css` (全屏模式样式)
- Modify: `src/main.js` (按钮点击与尺寸同步事件)

- [ ] **Step 1: 在 `index.html` 视口区域增加移动端全屏切换按钮**
  在 `#viewport` 内增加 `#btn-mobile-fullscreen` 胶囊按钮。
- [ ] **Step 2: 在 `src/styles.css` 中编写移动端全屏样式**
  - 默认桌面端隐藏；
  - 移动端（$\le 919\text{px}$）置于视口右上角；
  - `.mode-fullscreen-model #layout` 将轨道设为 `100dvh 0`，隐藏 `#panel`；
  - 全屏状态下的按钮样式切换（变成「返回配置」与高亮）。
- [ ] **Step 3: 在 `src/main.js` 中接线全屏切换逻辑**
  监听 `#btn-mobile-fullscreen` 点击，切换类名，触发 `window.dispatchEvent(new Event('resize'))`，支持 Esc 键退出。
- [ ] **Step 4: 验证移动端全屏逻辑与测试回归**
  运行 `node --check src/main.js` 与 `npm test`。
- [ ] **Step 5: 提交更改**
  `git commit -m "feat(ui): 支持移动端一键全屏沉浸看模型与平滑返回"`

---

### Task 2: 全品类爆炸图架构重构（光轴、边几、箱架、展车、挂衣架）

**Files:**
- Modify: `src/core/buildRodRack.js` (暴露 `groups`)
- Modify: `src/core/buildCartTable.js` (暴露 `groups`)
- Modify: `src/core/buildWoodCart.js` (暴露 `groups`)
- Modify: `src/core/buildCratesRack.js` (补全 `groups` 键位)
- Modify: `src/core/buildHanger.js` (补全 `groups` 键位)
- Modify: `src/core/anims.js` (扩展多产品爆炸动作库)
- Modify: `src/main.js` (接线 `active()?.groups` 与切品类同步)

- [ ] **Step 1: 在 `buildRodRack.js` 中结构化返回 `groups`**
  将 `posts`, `socks`, `rails`, `frameEnds`, `diags`, `diagBlocks`, `panels`, `board`, `papers`, `acr`, `strips`, `clips`, `tray`, `deck`, `joists`, `blocks`, `wheels`, `feet`, `forks`, `axles`, `forkZs` 挂载到 `groups`。
  运行 `node rodtest.mjs` 确认无任何物理几何漂移。
- [ ] **Step 2: 在 `buildCartTable.js` 中结构化返回 `groups`**
  将 `aluPosts`, `woodPosts`, `bolts`, `beamX: f`, `beamZ: fz`, `kicks`, `glass: g`, `acrylic: a`, `rails`, `clamps`, `corners`, `wheels`, `hubs`, `forks`, `mounts`, `feet` 挂载到 `groups`。
- [ ] **Step 3: 在 `buildWoodCart.js` 中结构化返回 `groups`**
  将 `sides`, `bottom`, `top`, `peg`, `divider`, `posts`, `flanges`, `shelfBoards`, `shelfClamps`, `rails`, `railClamps`, `sideRails`, `wheels`, `forks`, `feet` 挂载到 `groups`。
- [ ] **Step 4: 检查并统一 `buildCratesRack.js` 与 `buildHanger.js` 的 `groups`**
  确保周转箱 `crates`、挂衣架等关键部件都在 `groups` 内。
- [ ] **Step 5: 在 `src/core/anims.js` 中编写多产品部件爆炸位移动作**
  为光轴横杆、背板、海报、箱架周转箱（向前抽出）、边几台面、展车层板等配置合理的爆炸向量。
- [ ] **Step 6: 在 `src/main.js` 中更新 `actions.setExplode` 与切品类逻辑**
  使用 `active()?.groups`，并在切换产品且当前处于爆炸状态时维持同步。
- [ ] **Step 7: 运行 `node rodtest.mjs` 与 `npm test` 验证**
- [ ] **Step 8: 提交更改**
  `git commit -m "feat(core): 全品类支持结构爆炸图联动动画与部件分解"`

---

### Task 3: 光轴展架（第二个产品）拖拽手柄重构为极简工业图纸风

**Files:**
- Modify: `src/core/rodHandles.js`
- Modify: `src/styles.css` (手柄跟随标签与光标样式)

- [ ] **Step 1: 重构 `src/core/rodHandles.js`**
  - 替换粗糙的纯色圆锥/圆柱，改用极简双向极细导轨与端子圆环/箭头标记；
  - 增加透明隐形拾取碰撞体（Raycast Hit Box），兼顾视觉极简与操作易触控；
  - 实现拖拽动态数值徽标（跟随显示实时宽度/高度数值）；
  - 增强 Hover 放大高亮与 Active 拖拽反馈。
- [ ] **Step 2: 验证拖拽更新与边界保护**
  确保鼠标与触控拖拽能正确修改 `rodStore` 的 `width` 与 `height` 并受限于 `limits`。
- [ ] **Step 3: 运行 `node rodtest.mjs` 与 `npm test` 确认**
- [ ] **Step 4: 提交更改**
  `git commit -m "feat(ui): 光轴展架拖拽手柄重构为极简工业图纸风"`

---

### Task 4: 底部控件与操作按钮 Hover 动效全面提升

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: 提升视口底部浮动控制条（`#hud-right`）按钮 Hover 动效**
  增加 `translateY(-2px)`、柔和阴影 `box-shadow`、纯白底色与 active 按压缩放。
- [ ] **Step 2: 提升配置面板底部行动按钮（`.cta`、`.cta-ghost`、`.btn-diag`）Hover 动效**
  增加悬浮微浮起、深邃弥散投影、细边框高亮。
- [ ] **Step 3: 提升左侧工具条与顶部分类切换按钮 Hover 反馈**
- [ ] **Step 4: 增加 `@media (hover: hover)` 规避触屏设备悬浮态粘连**
- [ ] **Step 5: 提交更改**
  `git commit -m "style(ui): 强化视口底栏与面板底栏全部按钮的 Hover 交互质感"`

---

### Task 5: 综合验证、单文件构建与 Git Push

**Files:**
- All modified files
- Output: `dist/index.html`

- [ ] **Step 1: 运行完整自动化测试套件**
  - `node rodtest.mjs`
  - `npm test`
- [ ] **Step 2: 执行生产环境单文件构建**
  `npm run build`，确保 `dist/index.html` 生成无报错。
- [ ] **Step 3: 检验型材架基线**
  验证基线 177.8 kg / 1956 件 / 104.0 m 保持绝对一致。
- [ ] **Step 4: Git Push 至远程仓库**
  `git push origin main`
- [ ] **Step 5: 形成完整交付记录并报告**
