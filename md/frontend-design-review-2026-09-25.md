# 前端设计审阅报告 · 2026-09-25

审阅范围：`index.html`、`src/styles.css`、`src/fonts.css`、`src/main.js`（接线层）、
`src/ui/`（panel / panelDecor / hud / rodPanel / dragSlider 等）、`src/core/scene.js`（3D 呈现），
并对线上 rack.means.group 移动端实机截图做了视觉核对。

总体结论：设计底子已经相当好——浅色极简 + 胶囊控件 + 发丝线分区 + 中英文字距体系方向正确，
统一动效曲线 `cubic-bezier(0.16,1,0.3,1)`、按需渲染、`prefers-reduced-motion`、
WCAG 对比度注释等细节说明是认真做过的。以下只列"还能更优雅"的部分，按优先级排列。

## 一、设计令牌：从"有变量"到"成体系"

`:root` 已有基础令牌，但样式中仍散落未收敛的硬编码色值：

| 色值 | 用途 | 位置 |
| --- | --- | --- |
| `#b0aca4` | 分区英文小标 | styles.css `.sec-head .en` |
| `#a8a49c` | 面板免责文字 | styles.css `.panel-disclaimer` |
| `#eef2eb` / `#51633d` | 配置清单标签绿 | styles.css `.dc-tag` |
| `#c0392b` | 抽屉清空按钮红 | styles.css `.df-clear` |
| `#a0682a` | 价格表回退警告 | styles.css `.price-src-badge.fallback` |

建议全部收敛为语义化令牌：`--ink-faint`、`--danger`、`--warning`、
`--accent-soft`、`--accent-deep`。特别地，清单标签的深橄榄绿 `#51633d` 与全局
`--accent #7e8f63` 是两种绿，选中态体系被稀释；建议用
`color-mix(in srgb, var(--accent) 70%, black)` 这类派生方式保证同族。

圆角同理：全站是 999px 胶囊语言，但配置清单抽屉混用 8px 卡片 + 4px 小按钮
+ 6px 底栏按钮，像另一套设计系统拼进来的。建议定义三档令牌并全站替换：

```css
--r-pill: 999px;
--r-card: 12px;
--r-chip: 6px;
```

字号目前有十几档（10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 /
15 / 16 / 21 / 26 / 27 / 30px），建议收敛成 6~7 档 type scale：

```css
--fs-caption: 11px;
--fs-label: 12.5px;
--fs-body: 13px;
--fs-title: 15px;
--fs-display: 21px;
--fs-hero: 27px;
```

## 二、色彩与气质：单一强调色略显平淡

目前全站黑白灰 + 一个灰绿。作为"工业铝型材"品牌，可以让材质本身参与配色：
阳极氧化铝的香槟暖灰、喷砂银的冷灰可成为第二梯度色，用在 spec 大数字、价格、
尺寸标注等"读数"场景，与交互绿（accent）形成功能分工——绿色只表示
"可操作/已选中"，金属色只表示"读数/品牌"。低成本但明显提升设计感。

## 三、布局的具体痛点

**桌面端右面板固定 400px。** 920–1300px 宽度区间 3D 视口被挤压明显而面板留白
过剩。建议：

```css
#layout { grid-template-columns: minmax(0,1fr) clamp(340px, 26vw, 420px); }
```

**field-row 的太空感。** "跨数 BAYS" 与右侧步进器之间隔着巨大空白
（`justify-content: space-between` + 全宽行），标签与控件失去视觉关联。
建议给行设 `max-width`，或让 label 与 stepper 形成隐性两列网格（label 列固定
120px）。

**移动端顶部太厚。** 品牌行 + 全宽 tabs 条占掉约 90px，3D 区在 52dvh 里又被啃掉
一块。实机截图中 tabs 是通栏白长条，气质偏"管理系统"而非"产品展示"。建议：
移动端品牌区极简化（只留 MODULO 字标），tabs 保持桌面同款小胶囊浮于品牌右侧或
下方居中，不要通栏；滚动面板时 tabs 可随视口上滑隐藏。

**移动端右下角拥挤。** 实机截图可见"全屏看模型"按钮与视角 chip 条几乎相碰，
左下读数 + 右下控件 + 全屏按钮 + 热点 ± 按钮四个浮层同时抢底边。建议把
"全屏看模型"合并进 chip 条（一个 icon chip），而不是独立按钮。

**热点按钮与尺寸标注打架。** 截图左侧 ± 热点与 "2.79 m" 标注几乎叠在一起。
尺寸标注投影时应做简单碰撞回避（标注被热点覆盖时向外偏移约 12px），或热点平时
收成小圆点、hover/触摸时展开。

## 四、动效与反馈：配置变化的"爽感"可以更好

交互反馈目前集中在 hover 位移 + 阴影（做得细腻），但**数据层面是静默突变的**：
改层数、跨数时，spec 大数字、价格、自重、HUD 读数全部瞬间跳变。建议给关键数字
加约 200ms 的 count-up 或 opacity/transform 微过渡（数字变化时轻微上浮淡入）。
这会让"参数化实时生成"这一核心卖点被用户真切感知到，是性价比最高的高级感来源。

Loader 目前只有一行"正在生成骨架 …"文字，可加一条 1px 细线不确定进度条
（从左到右呼吸滑动），与图纸风设计语言契合，成本极低。

Toast 固定在 `bottom: 84px`，移动端与 chip 条、全屏按钮在同一竖直区域竞争，
建议移动端移到顶部（tabs 下方滑入）。

## 五、排版细节

中英混排目前依赖手工空格，建议对面板正文启用 `font-feature-settings: "halt"`
或 CSS `text-spacing`（新特性，渐进增强）处理中英文间距。

品牌字标 MODULO 用 0.34em 字距效果好，但中文界面主体依赖系统思源黑/雅黑回退，
Windows 雅黑与 macOS 苹方的字重渲染差异会让设计感打折。如预算允许，给标题级
文字（panel-title、sec-head、大数字）打包思源黑子集 woff2（常用字 + 数字，
约 100–200KB），正文继续走系统栈。

`theme-color` 目前为面板暖白 `#f5f3ef`，与页面主体背景 `--bg #eceff1` 不一致，
移动端浏览器地址栏着色与首屏视口色有轻微跳变，建议与 `--bg` 对齐。

## 六、代码层（影响设计可维护性）

`styles.css` 已超 1000 行且桌面/移动规则交错，建议拆为 `tokens.css`（变量）、
`components.css`（控件）、`layout.css`（布局与响应式）三个文件，构建时仍内联
成单文件 dist，不影响单文件硬目标。

`src/ui/rodPanel.js` 运行时向 head 注入 `<style>` 的拖拽提示样式
（cursor: ew-resize 等）应收回主样式表；样式散落在组件内且只在挂载过光轴面板后
才存在。

`src/main.js` 中 6 份近乎复制的 rebuild/actions 样板可顺着已有 `PRODUCT_SUBS`
注册表思路彻底收敛，新增产品时 UI 行为才不会漏接（2026-09-15 crates/woodcart
漏接事故即此类）。

`styles.css` 移动端 `.dim-label { padding: 2px 5px; }` 对 SVG `<text>` 无效，
属误导性死规则，应删除或改为缩放 bg 矩形。

`#product-tabs` 语义上应为 `role="tablist"` / `role="tab"`；热点 `.tip` 仅 hover
可见，触屏用户无法获取提示，建议触摸时改为短暂自动展示。

## 七、落地优先级

投入产出比最高的三件事：

1. **数字变化微过渡**（约半天）：直接提升核心体验质感。
2. **令牌收敛**（约一天）：accent 同族色 + 圆角三档 + 字号 scale，全站统一感
   立竿见影；之后再调视觉都是改一行变量的事。
3. **移动端顶部减厚 + 右下角浮层合并**（约一天）：移动端观感提升最大。

## 附：本次审阅依据

- 代码：本仓库 `index.html`、`src/styles.css`、`src/main.js`、`src/ui/panelDecor.js`、
  `src/ui/rodPanel.js`、`src/ui/hud.js`、`src/core/scene.js`。
- 视觉核对：线上 rack.means.group 移动端（约 752px 宽）实机截图
  `.openclaw/tmp/shot-home.png`（临时文件，可删）。
- 约束遵守：未改动任何原封文件（buildShelf.js / profiles.js / panel.js /
  store.js / product.js / dimensions.js / hotspots.js）；本报告仅为建议，
  所有优化项均可在 styles.css、index.html 或接线层完成，不触碰原封文件。
