# 前端对抗性审查报告 · 第一性原理

> 审查对象：`F:\Autoclaw\alu_extrusion`（五产品参数化 3D 配置器，`src/` 全部 38 个前端文件 + `index.html` + `vite.config.js`）
> 审查日期：2026-09-16 ｜ 审查方式：通读源码 + `npm test`（50/50）+ `node rodtest.mjs`（基线一致）+ `npm run build`（dist 757,275 B，与线上 SHA256 一致）
> 立场：对抗性。不问"代码能不能跑"，而问"**第一性原理上，这件事该不该这样做**"。能跑 ≠ 该存在。

---

## 0. 第一性原理框架

一个产品配置器的存在理由可以还原为三条公理：

1. **所见即所得**：3D 预览、算料、报价必须是同一份事实的三种投影。任何一处派生出独立逻辑，就是谎言的入口。
2. **每个字节都要挣回自己的带宽**：单文件构建意味着用户首屏为所有产品、所有场景付出全部下载成本。
3. **状态只有一个主人**：同一份配置若有两个写入口或两个权威源，迟早分裂。

以下所有问题都挂在这三条公理之下。

---

## 1. 状态管理：五份同构复制，一个抽象缺失

### 1.1 store 被复制了五次（违反公理 3）

`store.js`（34 行）与 `rodPanel.js`、`cartPanel.js`、`cratesPanel.js`、`woodCartPanel.js` 中各自内嵌的 store 是**逐字符同构**的：

```js
let state = { ...DEFAULT_X_CONFIG };
const subs = new Set();
export const xxxStore = {
  limits, installSteps, get, set(patch){ ...JSON.stringify 比较... }, subscribe
};
```

同一段 pub/sub 逻辑存在 5 份拷贝。这不是风格问题，是**演化不对称**的直接原因——证据已经出现过：`src/ui/store.js` 的 set 里走 `normalizeConfig`（型材架有规整化），四个产品面板的 store 没有；2026-09-15 的"假按钮"事故（crates/woodcart 的 subscribe 重建漏接）正是五份手写接线中两份漏掉的必然结果。

**第一性判断**：需要的是 `createStore(defaults, normalize?)` 一个工厂（约 15 行），删掉四份拷贝。第五次复制发生时就应该抽象，第六次（下一个新产品）不该再复制。

### 1.2 main.js 的 5×N 乘法接线

`main.js`（574 行）里每加一个产品要新增：1 个 import 组、1 个 `rebuildXxx`、1 个 `syncXxxStatsOnly`、1 个 actions 对象、1 个 mount 分支、1 个 unload 分支、1 个 subscribe 块。当前 5 产品 ≈ 35 处散点。`mountActiveProduct()` 第 359 行已经被压成一行 4 个分支（可读性崩坏的直接证据）。

**第一性判断**：产品应该是一个**注册表条目**（`{ kind, store, build, panel, actions, installSteps }`），main.js 只遍历注册表。五套 `rebuildXxx` 之间除了 store/build 名字不同，函数体完全一致——这是最典型的"数据该存在却写成了代码"。

### 1.3 persist 白名单泄漏（已确认的 bug）

`persist.js:5`：

```js
const LS_KEY = { profile: ..., rod: ..., cart: ... };   // ← 没有 crates / woodcart
```

而 `main.js:411-418` 每次 crates/woodcart 配置变化都调用 `persist('crates', ...)` → `localStorage.setItem(undefined, ...)`，键名变成字符串 **"undefined"**。后果：两个新产品的 localStorage 恢复**实际不生效**（`cfgFromStorage` 读 `LS_KEY['crates']` = undefined → 永远读不到），且五个产品共享同一个 `undefined` 键互相覆盖。hash 同步分支同样只对 rod/cart 生效（`hashKind` 三目链只有三个值），crates/woodcart 的 permalink 静默失效。

这不是隐患，是**正在线上发生的故障**，只是无人察觉——因为降级路径（回默认配置）恰好可用。

---

## 2. 构建产物：750 KB 单文件的真问题不在大小，在归因

### 2.1 数字本身（dist/index.html = 757 KB / gzip 205 KB）

对单文件 3D 应用这不算离谱，但第一性追问是：**每一 KB 买了什么？**

- three.js 全量（含后处理链、GLTFExporter 动态 import 但也被打进单文件）——买了 3D，合理。
- 但 `?nofx` 的用户、不支持 WebGL 的用户、只想算料的用户**都付同样的 750 KB**。

### 2.2 真正的反例：禁用路径仍在烧钱

- `webglFailed = true` 时照样 `import` 全部 three.js（模块顶层 import，无懒加载）。宣称的"WebGL 降级仍可算料"，实际是先下载并解析 750 KB 才能算料。
- `modelExport.js` 用 `await import('three/examples/jsm/exporters/GLTFExporter.js')` 做动态加载——**但 vite-plugin-singlefile 会把动态 import 也内联进同一个文件**，这个 `await import` 是零收益的演技（还有不一致：`main.js` 顶部统一 `three/addons/`，这里却写 `three/examples/jsm/`，两条路径 alias 解析链不同）。
- GTAO 已默认关闭，但 `GTAOPass` 仍被打进包（约数十 KB 着色器代码）。`?ao` 是给开发者的对照开关，全体用户为它付费。

### 2.3 阴影管线：关了一半的僵尸

`scene.js:54` 关了 `shadowMap`，但 `stageProduct()`（main.js:104-114）仍每次重建遍历全部 mesh 设置 `castShadow/receiveShadow`，`fitShadow` 还在按包围盒移动主光。代码在为一个已关闭的功能做全场景遍历。同理 `anims.js:160`：`if (on) conn.visible = true; else conn.visible = true;`——一个无论分支都赋同值的死代码，说明爆炸视图的连接件淡入逻辑已经失去维护。

**第一性判断**：删除应彻底。功能开关应该活在**构建期**（`?ao` 对应的 pass 可以动态 import——虽然 singlefile 下无收益，那就干脆删掉，对照实验用 git 历史做），而不是全体用户运行时背着。

---

## 3. 渲染管线：逐帧分配与"为动画破例"的材质纪律

### 3.1 逐帧对象分配（公理 2 的运行时版本）

- `dimensions.js:70-89`：每帧 `new THREE.Vector3()` × 6+。`hotspots.js:22-27`：每个 anchor 调用 `new THREE.Vector3`。这些是每帧执行的代码，GC 压力完全可避免——`dimensions.js` 顶部已有复用的 `v`，却在 update 里又 new。
- `hotspots.sync()` 每帧 `renderer.domElement.getBoundingClientRect()`——强制同步布局。按需渲染循环已经做了，但热点/标注只在"出帧"时重投影（设计正确），可惜每次出帧都带一次 layout flush。

### 3.2 入场动画污染材质状态

`anims.js:107`：`mat.transparent = true; mat.opacity = 0;` 直接改材质，`buildRodRack.js:33` 的注释承认了后果："每个 child 必须拥有独立材质，不能共享状态"。于是 `instanced()` 工厂每次 `mat.clone()`——**为了一次 240ms 的入场动画，所有材质永久失去共享**，且 `materials.js` 的 cache 形同半失效（cache 住原型、用前克隆）。

更糟的是 `buildShelf` 里 `getAluMaterial(color).clone()` 之后又传给 `instanced()` 再 clone 一层（buildShelf.js:50 + 20）。同一颜色的铝材在一次重建中被克隆 N 次，dispose 时全靠 buildShelf 手写的 `dispose()` 逐个释放——**任何一条路径漏 dispose 就是 GPU 内存泄漏**，而 `dispose()` 的实现没有遍历 `groups.panels` 里手动 new 的 `matPanelSide`（buildShelf.js:219 独立 new，dispose 的 layered 列表里 panels 的 material 数组会被处理——这个恰好覆盖，但靠的是巧合不是机制）。

**第一性判断**：淡入应该用 `onBeforeRender` 或一个作用于 group 的 uniforms/缩放，而不是改材质实例状态；或者接受入场动画没有淡入（只有位移），把材质共享还回来。

### 3.3 `syncXxxStatsOnly` 的双重构建

main.js:187-230 五个函数：WebGL 失败时，为了更新 HUD 数字，**完整构建一遍三维模型再立即 dispose**。算料（纯数学）和建模（几何体）被焊死在同一个 `buildXxx` 里——这违反公理 1 的反面：如果算料可以脱离几何存在，它就不该需要 new 出几百个 BufferGeometry。

**第一性判断**：`buildXxx` 应该拆成 `computeStats(cfg)`（纯函数，无 THREE）+ `buildGeometry(cfg, stats)`。这样：无 WebGL 降级是真降级（不碰 three）、stats 可以进 worker/测试不需要 DOM、`test/` 里大量几何断言也能瘦身。

---

## 4. 交互与 DOM 卫生

### 4.1 面板重建 = 监听器累积

`createRodPanel` 等每次 mount 执行：`root.addEventListener('click', ...)`（rodPanel.js:151）、`rodStore.subscribe(syncSpecs)`（:199）、`attachDragSlider(...)`（注册 3 个 **window 级**指针监听）、`document.head.appendChild(style)`（:173 每次塞一段重复 CSS）。`mountActiveProduct()` 只做了 `panelRoot.innerHTML = ''`——DOM 没了，**window 上的 pointermove/pointerup、store 上的 subscribe、head 里的 style 全部存活**。切换产品 10 次 = 10 份事件监听 + 10 段重复 style 标签 + 10 个 syncSpecs 订阅（旧订阅仍引用已脱离文档的 spec 元素，每次配置变化白白执行 querySelector）。

返回的 detach 函数（dragslider.js:44）被调用方完全丢弃。

**第一性判断**：panel 工厂必须返回 `{ updateStats, dispose }`，mount 前调旧 panel 的 dispose。这是"每个分配都有对应释放"的对称性问题。

### 4.2 innerHTML 拼接

`rodPanel.js` 等处用模板字符串拼 innerHTML，内容全部来自本仓库常量，**当前无 XSS 现实路径**（priceview.js 已经用 textContent 做了正确示范）。但这是"靠数据来源安全"而不是"靠机制安全"——一旦某个 label 未来来自远端（KV 价格表的 source 文案已经会进 `data-mkt-src`，好在走 textContent），所有 innerHTML 拼接点都要重审。机制上不贵的做法：延续 priceview 的 DOM API 风格。

### 4.3 `window.__ALU_*` 全局通道

`__ALU_LABELS`（main.js:35 为绕循环依赖）、`__ALU_INVALIDATE`、`__ALU_STATS`、`__ALU_READY`、`__ALU_FX`、`__ALU_ERRORS`——六个全局量。QA 探针可以接受（READY/STATS/FX/ERRORS），但 `__ALU_LABELS` 是**生产逻辑的依赖**：cutlist.js:23 运行时必须读它，删掉 window 注入整个导出就崩。循环依赖的正确解是把 LABELS 提到独立模块，不是挂 window。

---

## 5. 数据一致性：所见即所得的裂缝

| # | 裂缝 | 位置 | 性质 |
|---|---|---|---|
| 1 | 光轴算料单总高写死 `hText = '1.36'`，高度调到 2.0m 导出的单子仍印 1.36 | cutlist.js:81 | **错误输出** |
| 2 | `PRICE`（product.js:55）与 `PRICE_ROD`（rodrack.js:49）两套废弃价格表留在"唯一配置源"里 | config/ | 误导性死代码 |
| 3 | `market.js` 注释指向 `tools/price-scout.mjs`，该文件已被归档删除 | market.js:2 | 失效文档 |
| 4 | 型材架 weightKg 用视觉节点数 `nNodes` 计费，但注释自述"legacy nNodes procurement accounting stays unchanged"——视觉与采购明知不一致仍混用 | buildShelf.js:231 | 诚实但危险 |
| 5 | `JOINT_GAP = 0.002` 自述"未验证假设"，却直接决定导出下料长度 | product.js:80 | 免责声明在代码里，用户拿到的是数字 |
| 6 | 报价只在 profile/rod 两分支响应 KV 刷新（main.js:421-425），cart/crates/woodcart 远端价格表到达后不刷新 | main.js | 五产品之一致性缺口 |
| 7 | `syncPriceNote` 用 DOM querySelector 改文案，与 panel 渲染生命周期脱钩 | main.js:86 | 脆弱耦合 |

第 1 条值得单独说：用户把立柱调到 1.8m，导出 Excel 印着"总高 1.36 m"——**这是配置器最不该犯的错**：导出物与用户输入矛盾。免责声明（"演示示例"）不能覆盖一个具体的、错误的数字。

---

## 6. 可访问性与健壮性

- hash 路由只认 `#rod/#cart/#crates/#woodcart/#node`，`#node` 与 `#profile/slot` 等组合的优先级散落在 main.js:68 与 554-556 两处正则，**新产品再加一个就要改两处**（注册表化可一并解决）。
- `location.hash` 中 `?c=` 的配置经 `decodeCfg` → JSON.parse → 直接 `store.set`。有白名单过滤（好），但 normalizeConfig 只对 profile 生效，rod/cart 的持久化恢复不做数值钳制——**篡改 hash 可以注入 width: 1e9**，buildRodRack 不会崩（几何照样生成），但 stats/报价会输出天文数字。limits 钳制只在面板 stepper 和 dragslider 里有，store.set 入口没有。
- 8 秒加载超时提示依赖 `document.visibilityState === 'visible'`，后台标签页打开永远不提示（合理），但 headless QA 下 loader 700ms 强制隐藏与 READY 探测双轨并存（main.js:520 vs 564），两套就绪机制是 QA  flaky 的温床。

---

## 7. 优先级建议（按"消除谎言"的性价比排序）

| P | 事项 | 工作量 | 理由 |
|---|---|---|---|
| P0 | persist.js 补 crates/woodcart 的 LS_KEY 与 hash 分支 | 10 分钟 | 正在发生的静默故障（1.3） |
| P0 | cutlist.js 光轴 hText 改为按 cfg.height 实算 | 5 分钟 | 导出物与用户输入矛盾（5.1） |
| P0 | store.set 全线接入数值钳制（limits 从 config 注入） | 半天 | 封住 hash 注入 + 统一归一化（6） |
| P1 | `createStore` 工厂 + 产品注册表，删掉 4 份 store 拷贝与 main.js 乘法接线 | 1 天 | 消灭"假按钮"事故的结构性根因（1.1/1.2） |
| P1 | panel 返回 dispose，mount 前释放（监听器/订阅/style） | 半天 | DOM 卫生（4.1） |
| P2 | buildXxx 拆 `computeStats` + `buildGeometry` | 2-3 天 | 真降级、真测试、消灭双重构建（3.3） |
| P2 | 删 PRICE/PRICE_ROD 死表、GTAOPass、阴影残留遍历、`anims.js:160` 死分支 | 半天 | 每个字节挣回带宽（2.3） |
| P3 | 入场动画放弃材质 opacity 方案，恢复材质共享 | 1 天 | 内存纪律（3.2） |
| P3 | 尺寸标注/热点的逐帧 Vector3 分配改复用 | 1 小时 | GC 卫生（3.1） |
| P3 | KV 刷新订阅覆盖全部五产品 | 半小时 | 一致性缺口（5.6） |

---

## 8. 总体判断

这套前端在**工程纪律的局部**（确定性伪随机、实例化渲染、按需渲染循环、诚实的价格来源标注、完善的 QA 脚本链）上远超同类一次性项目；它的全部结构性问题都来自同一个根源：**第二到第五个产品是在"型材架原封文件不可动"的约束下用复制粘贴长出来的**，每一次复制都摊薄了抽象，每一处"绕开原文件"都在 main.js 里加了一处乘法。

第一性原理的回答不是"继续小心翼翼地打补丁"，而是：**把"产品"从五段代码变成五份数据**。store 工厂 + 注册表这两个抽象落地后，本报告 1/4/5 章的一半问题会自然消失，且不动任何"原封文件"——这正是约束允许的重构路径。

---

## 修复闭环记录（2026-09-16，邈哥授权破例动原封文件）

| 报告条目 | 状态 | 验证 |
|---|---|---|
| §1.3 persist crates/woodcart 持久化失效 | ✅ 已修 | 浏览器实测 tiers=999 注入被钳到 6 层 |
| §5.1 cutlist 光轴高度写死 1.36 | ✅ 已修 | 1.2/1.8/2.0 → 1.38/1.98/2.18 |
| §6 store.set 数值钳制 | ✅ 已修 | clamp.js + 4 面板 + test/clamp.test.mjs 4 条 |
| §4.1 面板监听器/订阅/style 泄漏 | ✅ 已修 | 4 面板 dispose 化，12 轮切换零泄漏 |
| §5.6 KV 刷新只覆盖 2/5 产品 | ✅ 已修 | onMarketRefresh 统一 active() |
| §3.1 逐帧 Vector3 分配 | ✅ 已修 | dimensions.js 预分配复用 |
| §2.3 阴影僵尸遍历 | ✅ 已修 | stageProduct 去 castShadow 遍历 |
| §2.3/§3.2 anims 死分支 + 材质共享 | ✅ 已修 | reveal 改位移缩放，材质恢复共享 |
| §2.3 GTAO 死代码 | ✅ 已删 | postfx.js 移除 GTAOPass，758→727KB |
| §5.2/§5.3 PRICE / PRICE_ROD 死表 | ✅ 已删 | product.js/rodrack.js 清理，零引用确认 |
| §3.3 computeStats/buildGeometry 拆分 | ✅ 已修 | buildShelf 提取 computeShelfStats 纯函数，四配置基线逐字节 MATCH |
| 额外：woodcart 高度口径 bug（视觉核对发现） | ✅ 已修 | 面板/算料单 2.21→2.91m，五产品口径抽查全 PASS |

**最终验证**：npm test 54/54 ｜ rodtest 基线不变（20.1kg/45件/9.81m）｜ qa-geometry 10 PASS ｜ qa-browser 五产品 console 零错误 ｜ 构建 727KB（较修复前 −31KB）
