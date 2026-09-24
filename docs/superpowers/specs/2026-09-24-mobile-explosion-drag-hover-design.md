# MODULO 配置器优化方案规范：移动端全屏、全品类爆炸图、光轴拖拽手柄与按钮 Hover

## 1. 概述与背景

针对用户提出的 4 项核心体验问题进行全方位系统化提升：
1. **移动端全屏看模型**：移动端视口被下方配置面板大量文字遮挡，需支持一键切换「全屏沉浸模型预览」，释放 100% 屏幕空间给 3D 渲染，并可随时平滑返回编辑。
2. **全品类爆炸图支持**：当前爆炸图动画仅与型材架绑死，其它 5 类产品（光轴展架、移动边几、周转箱架、木展车、挂衣架）点击爆炸无响应。需重构爆炸调用体系，并在全部产品上实现物理合理的零件爆炸/抽出动画。
3. **光轴展架（第二个产品）拖拽箭头美化**：当前拖拽箭头采用高饱和度粗锥体与圆柱，与 MODULO 极简暖白/工业图纸风格冲突。重构为极简工业图纸风的双向端子与精细标尺导轨，并补充实时数值跟随与高亮反馈。
4. **底部按钮组 Hover 动效强化**：增强视口底部浮动控制条（正视/侧视/轴测/爆炸/自转等）以及面板底部操作按钮（加入配置清单、导出算料单、导出 3D 模型）的微浮起、柔和阴影与高亮反馈，消除生硬感。

---

## 2. 详细技术方案

### 2.1 移动端全屏看模型（沉浸预览）

#### 交互设计
- 在移动端媒体查询（$\le 919\text{px}$）下，3D 视口内右上角增加「全屏查看」磨砂胶囊按钮 `#btn-mobile-fullscreen`（包含展开全屏 SVG 图标与文本）。
- 用户点击后，为容器 `#layout` 添加 `.mode-fullscreen-model` 样式类：
  - `#layout` 的 grid 轨道由 `52dvh 48dvh` 变为 `100dvh 0`（完全隐藏配置面板）；
  - `#panel` 设置 `display: none` / `height: 0`；
  - 触发 `window.dispatchEvent(new Event('resize'))`，Three.js 摄像机与渲染视口无缝自适应全屏；
  - 按钮文本切换为「返回配置」，图标切换为收起折叠图标，视觉呈半透明高亮底色；
  - 支持快捷退出（再次点击按钮或按 Esc 键）；
  - 全屏模式下，视口顶部产品横栏与辅助读数精简弱化，为模型留出绝对充裕的触控旋转、捏合缩放空间。

#### DOM 与 CSS
- DOM：在 `#viewport` 中新增 `<button id="btn-mobile-fullscreen" class="btn-mobile-fullscreen" aria-label="全屏沉浸预览"><svg ...></svg><span>全屏</span></button>`。
- CSS：
  - 默认桌面端 `display: none`；
  - 移动端浮动展示在视口右上（与品牌/清单按钮自然排布）；
  - `.mode-fullscreen-model #panel { display: none !important; }`
  - `.mode-fullscreen-model #layout { grid-template-rows: 100dvh 0 !important; }`

---

### 2.2 全品类爆炸图架构重构（Multi-Product Explosion）

#### 现状分析与断点修复
1. `src/main.js` 中 `actions.setExplode` 仅传入了 `current.groups`（`current` 专属于型材架）。
2. 在切换为其它产品时，`active()` 指向 `rodCurrent`、`cartCurrent` 等，但这些产品的 `groups` 没有传递，且部分 builder 返回对象中未挂载 `groups` 属性。
3. `src/core/anims.js` 中的 `explode(parts, on)` 内部硬编码了型材架专用部件名数组 `moves`，未包含其它产品的部件分组。

#### 重构方案
1. **各产品构建器结构化挂载 `groups`**：
   - `buildRodRack.js`：返回 `groups: { posts, socks, rails, frameEnds, diags, diagBlocks, panels, board, papers, acr, strips, clips, tray, deck, joists, blocks, wheels, feet, forks, axles, forkZs }`；
   - `buildCartTable.js`：返回 `groups: { aluPosts, woodPosts, bolts, beamX: f, beamZ: fz, kicks, glass: g, acrylic: a, rails, clamps, corners, wheels, hubs, forks, mounts, feet }`；
   - `buildWoodCart.js`：返回 `groups: { sides, bottom, top, peg, divider, posts, flanges, shelfBoards, shelfClamps, rails, railClamps, sideRails, wheels, forks, feet }`；
   - `buildCratesRack.js` 与 `buildHanger.js` 已有 `groups` 基础，补齐未入组的关键部件（如周转箱 `crates`、滑轨 `rails`、箱架框梁等）。
2. **`anims.js` 统一位移动作库**：
   - 扩充 `moves` 字典，各部件定义物理合理的爆炸方向与位移量：
     - **光轴展架**：横杆与卡夹沿 Z 前移、背板/海报后移、底盘斜撑外扩、托板前移、底叉与轮组微下移；
     - **移动边几**：顶层玻璃台面向上浮起、亚克力中板前移抽出、侧挂光轴外扩、脚轮下移；
     - **周转箱架**：周转箱箱体阶梯式向前抽拉（Z 向 +0.35m，极具视觉冲击力！）、顶横梁上浮、滑轨侧移；
     - **光轴木展车**：层板前移、抽屉/柜身前移、洞洞板后移、顶挂杆上浮；
     - **挂衣架**：抽屉向前拉出、顶挂杆上浮、侧柱横向微外扩。
3. **`main.js` 接线**：
   - `setExplode: (on) => { const act = active(); if (!webglFailed && act?.groups) anims.explode(act.groups, on); }`；
   - 产品切换（`switchProduct`）时，若当前处于爆炸状态，自动将新产品也平滑应用当前爆炸状态（或在切出时优雅复位并同步 HUD 状态）。

---

### 2.3 光轴展架（第二个产品）拖拽箭头前端美化

#### 现状问题
- 使用了高饱和度纯色 `COLOR_W = 0xc2711d`（琥珀橙）与 `COLOR_H = 0x3d7a4f`（松绿）圆锥（`ConeGeometry`）与圆柱，带 `depthTest: false`，三维穿模且视觉粗糙，严重割裂了 MODULO 建筑制图质感。

#### 美化重构方案（极简工业图纸风）
1. **材质与几何精雕**：
   - 放弃粗糙的纯色高饱和圆锥与长杆。
   - 采用精致的阳极氧化墨灰/碳素深色导轨线，端部改为高精度极简双向箭头端子与磨砂圆环指示器（Ring / Torus / Precision Marker）。
   - 增加舒适的三维拾取碰撞体（透明扩大的 Raycast 包围体），既保持视觉精细纤薄，又让鼠标或手指极易点选抓取。
2. **动态跟随微标签（Hover & Drag Readout）**：
   - 在拖拽手柄附近动态生成轻量高雅的尺寸文字徽标（如 `宽 0.80 m` / `高 1.20 m`），与 `dimensions.js` 中的极简白底胶囊标尺完全呼应。
3. **微交互状态反馈**：
   - 鼠标悬停（Hover）：手柄端子微放大（1.15x），导轨线条高亮；
   - 正在拖拽（Active Dragging）：端子与标签强化对比，指示当前正在改变的模型边界；
   - 拖拽结束平滑淡出多余辅助光晕。

---

### 2.4 底部按钮组 Hover 质感提升

#### 覆盖范围
1. **视口底部浮动控制条（`#hud-right`）**：
   - 正视、侧视、轴测、槽口、节点近看按钮（`.chip`）；
   - 爆炸视图按钮、自转开关按钮（`.chip-toggle`）。
2. **面板底部核心行动按钮**：
   - 加入配置清单按钮（`.cta`）；
   - 导出算料单、导出 3D 模型按钮（`.cta-ghost`）；
   - 复制系统诊断信息按钮（`.btn-diag`）。
3. **其它视口辅助按钮**：
   - 视口左侧缩放工具（`#view-tools button`）；
   - 顶部产品切换胶囊（`.product-tabs button`）。

#### 动效规范
- **微浮起（Subtle Lift）**：Hover 时应用 `transform: translateY(-2px)`，赋予物理按钮的悬浮感；
- **微阴影（Ambient Shadow）**：Hover 时柔和叠加 `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.10)`；
- **微触觉反馈（Active Press）**：点击时 `transform: translateY(0) scale(0.96)`；
- **平滑缓动曲线**：使用 `cubic-bezier(0.2, 0, 0, 1)` 与 180ms 过渡，杜绝生硬闪烁；
- **移动端适配**：通过 `@media (hover: hover)` 规避触屏设备点击后 Hover 样式常驻粘滞问题。

---

## 3. 验证与回归计划

1. **几何与算料基线验证**：
   - 运行 `node rodtest.mjs`，确保光轴展架 4 项基线与尺寸完全一致；
   - 确认型材架基线 177.8 kg / 1956 件 / 104.0 m 毫厘不差；
   - 运行 `npm test`，全部 84 项测试必须 100% 通过。
2. **功能与交互验证**：
   - 移动端（窄屏视口）：进入全屏后 `#viewport` 占满屏幕，点击退出平滑恢复；
   - 爆炸图测试：遍历 6 个产品（铝型材置物架、光轴展架、移动边几、周转箱架、木展车、挂衣架），点击爆炸图开关均能正常顺畅爆炸展开与复位；
   - 光轴拖拽手柄测试：拖动宽度与高度手柄，数值平滑实时刷新，视觉精致无穿模伪影；
   - 按钮 Hover 动效测试：视口底栏与面板底栏所有按钮悬浮手感细腻舒适。
3. **构建产物验证**：
   - `npm run build` 成功输出 `dist/index.html`，验证体积与单文件离线可运行。
