# 前端设计审阅报告 · 2026-09-25（第二轮 · 增量）

- 审阅人：ZCode（GLM）
- 审阅方式：`npm run build` 后经 `vite preview` + Playwright（系统 Chrome）实测，
  1440 / 1100 / 390 三档宽度 ×（型材架 / 光轴架 / 周转箱架）+ 抽屉、移动端全屏两个交互态，
  共 11 张截图；对可疑项做了 DOM 数值测量（可复跑脚本见附录）。
- 截图与脚本目录：`.openclaw/tmp/design-review-0925/`（临时文件，可删）。
- 上一轮报告：`md/frontend-design-review-2026-09-25.md`（K3 审阅）。其令牌体系、
  字阶、主题色对齐、tablist 语义、数字微过渡（`.num-updated`）等建议均已落地且效果良好，
  本轮不再重复，只列新发现与仍未收口的问题。

## 总体结论

设计底子已经很好（浅色极简、胶囊控件、发丝线分区、图纸风标注），但本轮实测发现
**2 个功能性硬伤、1 组浮层碰撞体系问题、若干组件细节**。碰撞问题的共性是：
浮层（读数、控件条、全屏按钮、尺寸标注）各自定位，没有统一的"底边占用预算"，
宽度一紧就互相压盖。

---

## P0 · 功能性硬伤（设计意图无法达成）

### 1. 桌面端「清单」按钮完全无法点击

按钮由 `src/ui/configList.js:82` 动态挂进 `.brand-overlay`，而桌面端该容器是
`pointer-events: none`（`src/styles.css:92`），`.config-list-btn` 没有像 `.brand`
那样恢复 `pointer-events: auto`。

实测证据（1440×900）：

- `getComputedStyle(btn).pointerEvents === "none"`
- `document.elementFromPoint(按钮中心)` 命中 `#gl`（canvas）
- Playwright 真实鼠标点击 30s 重试全部被 canvas 拦截，`force:true` 的真实鼠标
  事件同样落在 canvas 上；仅 `el.click()`（绕过 hit-test）能打开抽屉。

移动端因媒体查询里 `.brand-overlay { pointer-events: auto }`（styles.css:981）
恰好幸免（实测 `pe:"auto"`、hit 命中 BUTTON）。

修复（一行 CSS）：

```css
.config-list-btn { pointer-events: auto; }
```

顺带建议：该按钮目前悬在品牌区第三行（y≈115px），与品牌块、价格基准 badge
的从属关系不清。建议移到与 `price-src-badge` 同行右对齐，或并入面板底栏 CTA 区。

### 2. 移动端 chip 条溢出屏幕，「自动旋转」按钮不可达

390px 宽、型材架模式下底部控件条共 7 颗 chip
（front / side / iso / slot / node / 爆炸 / 自转），超出
`#hud-right { max-width: 48vw }`（styles.css:1041）。

实测证据（390×844，型材架）：

```
{ "barRight": 378, "vw": 390, "chips": 7,
  "lastChipRight": 399.8125, "offscreen": ["自动旋转"] }
```

最后一颗 chip 右缘 399.8 > 390，被屏幕边缘裁掉，且已溢出胶囊底板背景——
即「自动旋转」在手机型材架模式下永远点不到。

修法任选其一：

- 型材架移动端隐藏 node chip（`hud.js` 已有按 `c.bays` 隐藏 node 的先例）；
- chip 缩到 28px 并允许 bar 横向滚动（`overflow-x: auto` + 渐隐遮罩）；
- 爆炸/自转收进「更多」弹出。

---

## P1 · 浮层碰撞（三处实测重叠，集中在顶部与底边）

### 3. 桌面 1440 · 光轴架：HUD 读数压进底部控件条

实测：`hudLeft.right=415.5 > hudBar.left=408.3` 且垂直方向重叠
（`hudLeft.bottom=880 > hudBar.top=834`），读数第一行"…海报画面 / 窄托板 / 滚轮"
的尾部被胶囊盖住。

建议：给 `#hud-left .rl-a` 设 `max-width`（如 `min(46vw, 520px)`）超长省略，
或把 `#hud-right` 的 `bottom` 从 18px 提到与读数块错位。

### 4. 移动端 390 · 周转箱架：读数卡与 chip 条重叠 8.4px

实测 `gap = bar.left - hudLeft.right = -8.375px`。根因：两者各占 `max-width: 48vw`
加左右 12px 边距，`48vw×2 + 24px > 100vw`，**必然相撞**，不是巧合。

建议：各收窄到 44vw，读数卡内第二行 `text-overflow: ellipsis`。

### 5. 移动端 · 尺寸标注 × 「全屏看模型」按钮相碰（三例）

- 型材架：`0.40 m` 标注压按钮上沿；
- 光轴架：`0.42 m` 同样；
- 周转箱架：`0.64 m` 直接叠在按钮上。

建议（上一轮提过，本轮升级为必改）：把「全屏看模型」并入 chip 条作一颗
icon chip；或标注投影时做约 12px 的碰撞回避（标注矩形与已知浮层矩形相交时外移）。

### 6. 窄桌面 1100 · 产品 tabs 盖住 MODULO 字标

`.product-tabs` 在 `#viewport` 内水平居中，1100px 时视口仅 760px 宽
（1100 − 面板 340），tabs 总宽约 870px 溢出，左端盖住品牌字标
（截图可见 "MODUL|O" 被胶囊切掉）。

建议：`max-width: calc(100% - 280px)` + `overflow-x: auto`，或在该档位
缩小按钮 padding / 允许换行成两行胶囊组。

---

## P2 · 组件细节

### 7. 价格大数字被折成两行

桌面型材架面板实测 `.price` 高 51px（30px 字号下为两行）："¥ 3,499" 从空格处
断开成 "¥" / "3,499"；右侧 `.price-note` 被挤成 69px 宽的三行窄条。
price-line 的 DOM 在原封 panel.js 里（rod/cart/crates/hanger 面板同构），
只能从 CSS 解（styles.css 可改）：

```css
.price-line .price { white-space: nowrap; flex: none; }
.price-line .price-note { flex: 1; min-width: 0; }
```

### 8. 日期中断行

"表版本 2026-09-05" 多处断成 "2026-" / "09-05"（光轴架 / 周转箱架价格注释均见）。
给 `.price-src` 中的日期包 `white-space: nowrap` 的元素，或整体
`word-break: keep-all`。

### 9. 抽屉空状态 emoji 出戏

`src/ui/configList.js:128` 的 📋 是全站唯一 emoji，与细线 SVG 图标语言不符。
换成 stroke 风格剪贴板 SVG（可直接复用清单按钮已有的那个 icon，24px 放大）。

### 10. 「型材层板6」缺乘号

层板配置分区标题右侧摘要由原封 panel.js 生成、`src/ui/panelDecor.js:51-57`
搬运，文案本身无空格。可在 panelDecor 搬运时对 `.val` 文本做正则改写为
"型材层板 ×6"（接线层允许改）。

---

## P3 · 气质提升（可留待下轮）

- **移动端 tabs 滚动无边缘渐隐**：用户不知道右侧还有"木展车/挂衣架"。
  加 8px 白色渐隐遮罩（mask-image 或伪元素）即可。
- **桌面左侧 ± 热点与 "2.79 m" 标注的纵向队列**仍偏挤（比上轮好），
  hotspot 间距可再放宽 4px。
- **抽屉 header 的 ✕ 关闭按钮**是纯文本字符，建议统一为细线 SVG
  （与 `.drawer-close` 现有字号协调）。
- 深色 toast / 拖拽浮标（rgba(18,18,18,.90)）与浅色体系对比强烈，
  属于刻意的"图纸批注"语言，**保持现状**。

---

## 建议落地顺序

1. **P0 两项 + P1 碰撞**（合计约一天）：改动全部落在 styles.css /
   configList.js / panelDecor.js / main.js 接线层——这些是"用户会直接卡住"的问题。
2. **P2 价格行与日期断行**（约半小时，纯 CSS）。
3. **P3** 下轮与其他视觉迭代打包。

## 附录 · 验证证据

- 构建：`npm run build` → `dist/index.html` 831.81 kB（gzip 253.75 kB），3.42s 通过。
- 截图（`.openclaw/tmp/design-review-0925/`）：
  `desktop-profile-1440 / desktop-rod-1440 / narrow-profile-1100 / narrow-rod-1100 /
  mobile-profile-390 / mobile-rod-390 / mobile-crates-390 / desktop-crates-1440 /
  desktop-drawer-1440 / desktop-panel-bottom-1440 / mobile-fullscreen-390 / narrow-top-crop`。
- 数值测量结论汇总：
  - 清单按钮：`pointerEvents:"none"`，hit-test 命中 `gl`（桌面）；移动端 `auto` 正常。
  - 移动端 chip 溢出：`lastChipRight=399.8 > vw=390`，offscreen=["自动旋转"]。
  - 周转箱架移动端读数卡 gap=-8.375px。
  - 桌面 rod：HUD overlap=true（415.5 > 408.3）。
  - price-line：`.price` 高 51px（两行）、note 宽 69px。
- 复跑脚本：`.openclaw/tmp/design-review-0925/shot.mjs`（截图）、
  `verify.mjs` / `verify2.mjs`（数值），前置 `npx vite preview --port 4173`。

## 约束遵守

- 本次为纯审阅，未改动任何代码；型材架回归基线（177.8 kg / 1956 件 / 104.0 m）不受影响。
- 上述全部修复项均可落在可编辑文件（styles.css / configList.js / panelDecor.js /
  main.js / hud.js）内，不触碰 buildShelf.js / profiles.js / panel.js / store.js /
  product.js / dimensions.js / hotspots.js 原封文件。
