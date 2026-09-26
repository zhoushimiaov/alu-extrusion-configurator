# 前端深入优化升级 · 实施报告（2026-09-25 · 第四轮）

- 执行：ZCode（GLM）。范围：合并第二轮（ZCode）与第三轮（Opus）审阅的全部可落地项。
- 工作流：staging（`.openclaw/tmp/alu-stage`）→ `node --check` → robocopy 进仓库 → build → 审计。
- 结果：**npm test 88/88 通过**（新增 3 条 envelope 测试）、**rodtest 几何基线逐项一致**、
  **18 项自动化审计全绿**、**type材架回归基线不变**。构建 `dist/index.html` 839.80 kB（gzip 255.49 kB）。

## 一、P0 数字可信度（第三轮 §一-1 / §一-2）

**1. 尺寸标注 = 规格卡 = 真实外轮廓，三处归一。**
- 新增 `src/core/envelope.js`：`computeEnvelope(root)` 轴对齐包围盒，**正确展开 InstancedMesh 实例矩阵**
  （three 的 Box3.setFromObject 对 instanced mesh 不做逐实例展开，故自实现）；
- 五个非原封 builder（rod / cart / crates / woodcart / hanger）在返回前挂 `stats.envelope`；
  型材架（原封 panel.js 展示、bounds 语义已一致）保持走 bounds 回退；
- `main.js` 尺寸标注改为 `dims.update(a.stats?.envelope || a.bounds, center)`；
- 五个面板 `syncSpecs` 删除手写 `+0.06 / +0.10 / +0.20` 常数，规格卡 W/H/D 改由
  `updateStats(stats.envelope)` 唯一写入。
- 审计实测六产品「规格卡 vs 尺寸标注」**全部一致**（第三轮表中的 14cm/18cm/三值矛盾全部消除），
  例：木展车 0.86/2.88/0.51、挂衣架 1.42/2.48/0.50（此前 1.43 vs 1.44 vs 1.40 四值同屏）。

**2. 价格不完整态。** `src/ui/priceview.js`（全部产品价格区块的唯一出口，含原封 panel.js 的型材架路径）：
- `complete === false` 时大字降级为 **`¥ N +`**，来源行不再挤未计价小字；
- 新增警示色胶囊 **「另有 N 项待询价」**（`<details>` 语义化展开，逐项列明）；
- 实测：型材架 `¥ 3,499 + [另有 5 项]`、木展车 `¥ 24 + [6 项]`、挂衣架 `¥ 66 + [7 项]`、
  周转箱 `¥ 161 + [3 项]`、边几 `¥ 179 + [6 项]`；光轴架全计价无胶囊。

## 二、P0 爆炸态附属层（第三轮 §一-3）

`main.js` 接线层新增 `applyExplodeAux(hidden)`：爆炸时尺寸线淡出、± 热点层隐藏、
光轴拖拽手柄隐藏（`rodHandles` 新增 `setVisible` API）；复位/切换产品/节点视角时恢复。
实测（光轴架）：爆炸中 `dim opacity=0 / hotspot none / handles none`，复位后全部恢复。
背景像素采样：`[251,251,251]`（设计值 #fbfbfc，见 §四-3）。

## 三、P1 移动端遮挡（第三轮 §三-9/10/11/12/13，六产品全绿）

- **清单按钮被 tabs 盖住**：根因是移动端 `.brand-overlay` 未覆盖桌面 `flex-direction: column`，
  纵向堆叠把清单挤进 tabs 行。补 `flex-direction: row`，品牌居左、按钮组居右；
- **全屏按钮压字标**：`#btn-mobile-fullscreen` 移入品牌行 flex 流（index.html DOM 位置调整 +
  `position: static; margin-left: auto`），废除 `right: 94px` 魔数；
- **沉浸全屏态**：`tabs / 品牌 / 清单` 全部退场，只留「返回编辑」与底部 chip 条（实测三者 display none）；
- **触控热区**：chip 28px 视觉不变，`::before inset -3px` 扩至 34px 命中区（gap 调 6px 保证不相交），
  tabs / 清单 / 全屏按钮 padding 同步加大；
- **1100 档读数×chip 条重叠（10×46px）**：`#hud-left { max-width: calc(50% - 210px) }`——
  注意必须放在基础规则**之后**（首轮修正放媒体块早期被同特异性基础规则反超，审计抓出后已归位）；
- 实测 390px 六产品：清单/全屏 hit-test 全过、零遮挡、零 chip 溢出；1100 零重叠。

## 四、P1 3D 画面质感（第三轮 §二-5/7/8，§二-4 预览）

- **网格两级制图尺度**：旧版一格 0.875m（与任何产品模数无关）改为 **0.1m 细格 + 0.5m 主格**
  （2048px 纹理 + 各向异性过滤），mipmap 随距离自然淡出；
- **轮廓光中性化**：`0x9fc4ff @0.7`（饱和天蓝，把银色压成蓝灰塑料感）→ `0xdfe8f5 @0.45`；
- **背景发灰根治**（第三轮标记 [INFERENCE]，本轮确证并修复）：three 的 ACES（Hill 拟合）
  对 scene.background 一并色调映射，亮灰阶输出上限 ≈#e4e6e9（实测顶部 228,251 不可达，
  纹理侧预补偿数学上不可行）。方案：`scene.backgroundIntensity = 5` + 按 Hill 拟合
  **含 exposure/0.6 因子的精确反算**生成背景纹理色值——单管线、transmission 折射采样与暗角行为全保留。
  采样验证：**顶部 [251,251,251] ≈ #fbfbfc 精确命中**。
  （过程记录：曾试过「composer 后无色调映射直绘层」方案，全屏无深度 quad 把模型整个盖掉，
  已回滚——教训：透明层叠加顺序方案必须先过渲染链审计。）
- **接地接触贴片（`?ground=1` 预览，默认关）**：`src/core/groundContact.js`，四脚各一张径向渐隐
  圆片（半径取产品最小边 ×10% ×2.6，alpha 中心 0.60），零 shadow map 零后期。
  按第三轮要求不直接上线，**待用户拍板**；截图见 `.openclaw/tmp/audit/ground-final-*.png`。

## 五、P2 细节（第三轮 §四 + 第二轮遗留）

- tooltip 统一上移 4px 并加白描边（chip / view-tools / hotspot 三处一致），与尺寸标注区分；
- tabs 渐隐遮罩 18→28px；读数卡（移动端白卡）**点按展开/收起**（`hud.js` + `.expanded` CSS）；
- 抽屉空态 emoji → 细线 SVG、价格折行、1100 tabs×字标（第二轮项，已随 87f8ea6 落地，本轮审计确认保持）。

## 六、明确不做（及原因）

- **层板 LOD（第三轮 §二-6）**：需要新几何模块与性能取舍，属独立立项；摩尔纹问题仍在，列为后续。
- **接地贴片常开**：审美决定，等用户看过 `?ground=1` 预览拍板后决定是否转正/调参。

## 七、验证证据

| 项 | 结果 |
| --- | --- |
| `npm test` | **88/88 通过**（85 存量含 1 条文案断言按新设计更新 + 新增 envelope 3 条） |
| `node rodtest.mjs` | 四组配置 parts/weight/rod/bounds 与基线**逐项一致**（45 件 20.1kg …） |
| 型材架基线 | 177.8 kg / 1956 件 / 104.0 m 不变（regression 测试在套件内通过） |
| 数值一致性审计 | 6 产品 规格卡=尺寸标注，mismatch=0 |
| 浮层碰撞审计 | 桌面 1440 六产品 hudOverlap=0；1100 零重叠；移动端零遮挡零溢出 |
| 移动端 hit-test | 清单/全屏按钮 12/12 命中自身 |
| 爆炸态 | 隐藏/恢复状态机正确（含光轴手柄） |
| 背景采样 | [251,251,251]（期望 #fbfbfc） |
| 构建 | 839.80 kB / gzip 255.49 kB，单文件 |

审计脚本与截图：`.openclaw/tmp/audit/`（audit.mjs 可复跑，需 `npx vite preview --port 4173`）。

## 八、改动文件清单

新增：`src/core/envelope.js`、`src/core/groundContact.js`、`test/envelope.test.mjs`
修改：`src/main.js`、`src/styles.css`、`index.html`、`src/core/scene.js`、`src/core/postfx.js`（本轮改回）、
`src/core/rodHandles.js`、`src/core/build{RodRack,CartTable,CratesRack,WoodCart,Hanger}.js`、
`src/ui/priceview.js`、`src/ui/{rod,cart,crates,woodCart,hanger}Panel.js`、`src/ui/hud.js`、
`test/glb-config-restoration.test.mjs`（文案断言随设计更新）、`test/calc.test.mjs`（DOM 桩补齐）
**未触碰原封文件**：buildShelf.js / profiles.js / panel.js / store.js / product.js / dimensions.js / hotspots.js ✓

## 九、遗留风险

1. 接地贴片待拍板（默认关闭，`?ground=1` 预览）；
2. 型材层板摩尔纹未解（需 LOD 立项）；
3. 背景补偿与 `renderer.toneMappingExposure`/`scene.backgroundIntensity` 以常量耦合
   （scene.js 内 `TONE_EXPOSURE`/`TONE_INTENSITY`，改动曝光必须同步，注释已标明）；
4. 改动未提交 git（19 个文件），建议人工过目后提交。

---

---

## 追加（同日 · 移动端标注打磨）

- **标注×浮层动态避让**：用户实机截图发现手动旋转后 W/D 标签会压进底部读数卡/控件条（相机状态相关，静态偏移不可行）。`main.js` 接线层新增 `nudgeDimLabels()`：每帧渲染后检测 `.dim-label` 与浮层（读数卡/控件条/tabs/清单/全屏按钮）相交则整组抬离——`dims.js` 原封不动。先复位 transform 再测相交，避免抖动闭环。验收：390px × 7×6 磨砂亚克力配置，8 组拖拽 + 2 档缩放，碰撞 0。
- **移动端标注提对比**：`.dim-line` 0.75px/38% → 1.1px/50%，`.dim-label-bg` 92% → 95% 白底，消除「标签孤零零悬在模型上」的观感。


## 追加（同日 · 背板挂装重构）

- **GLB 背板从「整板外挂」改为「分跨嵌入后柱体」**：用户实拍确认外挂整板浮在架后、与框架无连接感。
  `buildGlbFrame.js` 的 `glbBackPanelRows` 改为逐跨生成行，板边嵌入后柱体内部（跨距 - 2mm，板面再内缩 9mm 与柱面错开，消除掠射角共面高光，
  板边距柱中心线 1mm、距柱面 14mm，接缝埋在柱体内不可见）；板厚范围 -0.199..-0.187 完全落在
  后柱体 -0.20..-0.17 内，与层板条尾端、深度连接件、板下横条均留实体间隙，零穿模。
- **`shelfBackPanel.js` 的外撤后处理退役**：嵌入式挂装不再需要（保留函数签名兼容 main.js 调用）。
- **测试语义同步**：背板数量断言改为「每层每跨」（levels × bays），逐层开关边界情形覆盖。
- **验收**：背面视角截图 + 像素级亮缝扫描（墙面 900×350 区域按列取亮度，均值 169 / 峰值 179，
  无任何高于均值+25 的亮列）；零件数 1,288 不变；`npm test` 88/88；rodtest 基线逐项一致。
- 注意：亮缝曾一度归因于装配间隙与柱体受光，用户端复查请**强刷（Ctrl+Shift+R）**排除旧构建缓存。


## 追加（同日 · 背板挂装重构）

- **GLB 背板从「整板外挂」改为「分跨嵌入后柱体」**：用户实拍确认外挂整板浮在架后、与框架无连接感。
  `buildGlbFrame.js` 的 `glbBackPanelRows` 改为逐跨生成行，板边嵌入后柱体内部（跨距 - 2mm，
  板边距柱中心线 1mm、距柱面 14mm，接缝埋在柱体内不可见）；板厚范围 -0.199..-0.187 完全落在
  后柱体 -0.20..-0.17 内，与层板条尾端、深度连接件、板下横条均留实体间隙，零穿模。
- **`shelfBackPanel.js` 的外撤后处理退役**：嵌入式挂装不再需要（保留函数签名兼容 main.js 调用）。
- **测试语义同步**：背板数量断言改为「每层每跨」（levels × bays），逐层开关边界情形覆盖。
- **验收**：背面视角截图 + 像素级亮缝扫描（墙面 900×350 区域按列取亮度，均值 169 / 峰值 179，
  无任何高于均值+25 的亮列）；零件数 1,288 不变；`npm test` 88/88；rodtest 基线逐项一致。
- 注意：亮缝曾一度归因于装配间隙与柱体受光，用户端复查请**强刷（Ctrl+Shift+R）**排除旧构建缓存。


## 追加（同日 · 背板终版：外挂封板式）

- 分跨嵌入方案在用户实机复查中仍被读出「缝」（后柱外露面受光 + 层板条尾端外露，任何嵌入
  深度都无法同时消除竖向柱线与横向条线）。终版改为**外挂封板式**：每层一块整板
  （宽 = W + 0.06，两侧包住端柱外沿 3cm），z 中心 -0.212——比后柱外侧面与层板条尾端
  再靠后 6mm，从背面看是一整块无缝墙面，柱网格与层板端头全部藏于板后；两侧包边消除
  「背板比框架窄一截」的浮板感。
- 连带修复：外挂重构时漏改实例生成的 5 元素解构（w 未定义 → makeScale(NaN)），
  面板实例矩阵含 NaN 导致背面渲染为空——`forEach` 解构与 setPosition 已同步修正。
- **关键运维教训：`vite preview` 启动时把 dist 快照进内存，之后的 rebuild 不会反映到
  已启动的服务器**——用户「强刷两次仍见旧版」的直接原因。每次 build 后必须重启 preview
  （或改用 vite dev）。本轮已重启并验证（served 内容含 -0.212 坐标）。
- 验收：`npm test` 88/88（背板断言：每层一块整板）；rodtest 基线一致；零件数 1,288 不变；
  背面视角截图（flush-back2.png）确认墙面连续无接缝，仅剩层界处层板条的结构性横线。


## 追加（同日 · 背板拉通 + 幻彩饰面，用户需求）

- **背板拉通**：背板全开时整块通高（单实例 slab，y 0..H），零横向接缝；逐层开关时按层分块。
- **幻彩镀锌饰面**：`PANEL_COLORS` 追加 `spangle` 条目（product.js 原封，由可编辑模块
  `backPanelFinishes.js` 在导入期向 const 对象追加属性——panel.js 色板遍历/选中/持久化全链路自动生效）；
  `spangleTexture.js` 程序化锌花纹理（1024² 放射枝晶 + 淡彩干涉斑，Repeat 平铺约 0.55m 一 Tile）。
- **装饰层**：panelDecor 给幻彩色板点做锌花渐变底。
- 验收：`npm test` 88/88（拉通 count=1 / 逐层分块 / y 0..H 断言）；rodtest 基线一致；
  零件数 1,288 不变（背板不计件数与重量，算料基线零影响）；背面/色板截图核验。
- 运维教训（重要）：`vite preview` 启动时把 dist 快照进内存，之后的 rebuild 不反映到已启动的
  服务器——用户「强刷仍见旧版」的直接原因。每次 build 后必须重启 preview；另外 esbuild 会把
  -0.185 压缩成 -.185，对 dist 做字符串验证时 grep 模式要带转义点号。


## 追加（同日 · 幻彩材质调亮）

- 用户实拍反馈幻彩材质「太假/太暗」。根因：map 与材质色双重相乘（0xc6ccd3 × 纹理亮度 ≈
  反照率打 7.3 折）叠加金属反射压暗。修正：spangle 材质色置纯白（纹理独立承载颜色）、
  纹理基色 226 → 243、晶粒色调收窄提亮。实测背面渲染为亮银锌花，与参考照片同质感。


## 追加（同日 · 新产品：光轴书架 ROD BOOKSHELF）

- **新形态**：`#books` 直达 + tab「光轴书架」（展示塔：铬管框架 + 逐层斜面展板含前挡唇、
  可选亚克力前挡、交叉拉索、木箱脚轮基座——Villa Medici 阅读装置参考）。
- 可调：跨数 1-2 / 层数 2-5 / 跨宽 0.8-1.2 / 深度 / 倾角 20-40° / 展板材质（麻灰板、
  **幻彩镀锌**（复用锌花纹理）/ 哑白）/ 框架表面（铬/黑/不锈钢）/ 交叉拉索开关。
- 新文件：`config/bookshelf.js`、`core/buildBookshelf.js`（envelope 同源、算料/自重/件数齐备）、
  `ui/bookshelfPanel.js`；接线：main.js（store/subs/actions/mount/kind 正则/viewMatch）、
  index.html（tab）、hud.js（读数分支）、persist.js（SCHEMA/LS_KEY/KINDS）+ persist-schema 测试登记。
- 已知未完：长桌形态（木台面+玻璃副层板）渲染异常（透射玻璃大色块 + 包络异常），已临时
  隐藏入口（代码保留），需专项调试后上架。
- 验收：`npm test` **89/89**（含 books 持久化登记）；rodtest 基线一致；页面零控制台错误。


## 追加（同日 · 背板拉通 + 幻彩饰面，用户需求）

- **背板拉通**：背板全开时整块通高（单实例 slab，y 0..H），零横向接缝；逐层开关时按层分块。
- **幻彩镀锌饰面**：`PANEL_COLORS` 追加 `spangle` 条目（product.js 原封，由可编辑模块
  `backPanelFinishes.js` 在导入期向 const 对象追加属性——panel.js 色板遍历/选中/持久化全链路自动生效）；
  `spangleTexture.js` 程序化锌花纹理（1024² 放射枝晶 + 淡彩干涉斑，Repeat 平铺约 0.55m 一 Tile）。
- **装饰层**：panelDecor 给幻彩色板点做锌花渐变底。
- 验收：`npm test` 88/88（拉通 count=1 / 逐层分块 / y 0..H 断言）；rodtest 基线一致；
  零件数 1,288 不变（背板不计件数与重量，算料基线零影响）；背面/色板截图核验。
- 运维教训（重要）：`vite preview` 启动时把 dist 快照进内存，之后的 rebuild 不反映到已启动的
  服务器——用户「强刷仍见旧版」的直接原因。每次 build 后必须重启 preview；另外 esbuild 会把
  -0.185 压缩成 -.185，对 dist 做字符串验证时 grep 模式要带转义点号。


## 追加（同日 · 书架横杆巨管 bug 修复）

- 用户实拍确认塔式横杆渲染为「6mm 长 × 2m 直径的巨管」横贯画面。根因：railGeo 为预旋转
  几何（长度轴在局部 X），塔式横杆误用 setDir（按长度在局部 Y 缩放）——len 被乘到半径轴、
  半径轴拿到跨距，杆件变成巨型弧面。修复：塔式横杆全部为 X 向平行杆，直接 setMT 定长缩放
  （中点定位 + (segLen, railR, railR)），不再经过四元数旋转。
- 教训：预旋转几何 + setDir 的「轴约定」必须成对使用；新构建器接入时逐 mesh 实例矩阵
  抽查（本次靠 __ALU_GROUP 遍历 + 实例尺度打印定位）。
- 验收：`npm test` 89/89；rodtest 基线一致；背面/正面截图核验横杆与框架齐平（宽度标注
  从虚假 1.95 回归真实 1.04）。
