# MEKIT Review Remediation Implementation Plan

> For agentic workers: use test-first implementation, scoped AGY worktrees, and review each result before integration. No commit, push, merge or deployment.

**Goal:** Resolve the 35 reviewed model, state and handoff defects while preserving the user-owned worktree and protected legacy files.

**Architecture:** Independent worktrees for model groups; root owns animation, persistence, startup routing and final integration. Keep existing immutable files byte-identical and route the application through corrected new geometry factories/wrappers. Geometry, BOM and displayed dimensions must share final assembly data.

**Tech Stack:** Three.js, Node test runner, Playwright, Vite single-file output.

## Owner boundaries

- Host: anims.js, persist.js, main.js, startup/config-list migration, integration and browser verification.
- AGY A: Rod/books/table builders and their dedicated new regression tests; no main/persist changes.
- AGY B: cart/crates/woodcart/hanger/casters builders and dedicated tests.
- AGY C: GLB/sheet builders, corrected profile factory and reviewed standard wrapper; no protected file or main changes.

## Per-finding acceptance checklist

- [ ] X01 P1: 爆炸复位或节点近看会把零件原始装配位置清零，错误继续进入GLB
- [ ] CW-01 P1: 负外伸让层板/顶板离开全部固定夹块
- [ ] CW-02 P1: 经典挂衣架顶板托片接板但不接任何承重圆管
- [ ] CW-03 P1: 经典挂衣架整个下柜悬在底框内孔中
- [ ] CW-04 P2: 可选侧面X拉索八只端件未接立柱
- [ ] CW-05 P2: 矮架多层配置的顶箱唇边穿入固定外轨
- [ ] CW-06 P2: 经典款全部板件没有进入采购BOM
- [ ] CW-07 P2: 经典款型材总长漏加四根斜撑
- [ ] CW-08 P2: 原木款低矮脚轮胎面穿入轮叉横桥3mm
- [ ] CW-09 P2: 原木款脚轮支撑点统计未包含12mm拖尾
- [ ] F01 P2: 当前 GLB 的 20×10 横条截面自交，网格开口且有四面共边
- [ ] F04 P2: 当前 GLB 背板与框架间有 6mm 间隔，模型内没有跨缝挂件
- [ ] F05 P2: GLB rib 层板上的可见陈设统一使用高出板顶 10mm 的落点
- [ ] F07 P2: GLB 背板不进入清单、件数或重量
- [ ] F08 P3: 当前 GLB 亚克力统计每跨比真实板宽多扣 3mm
- [ ] F09 P2: GLB 总尺寸标注回退到名义 bounds，遗漏实际外伸
- [ ] F10 P2: SHEET 新增右端薄板与回折边在不透明源闭合箱体内部，默认外观无效
- [ ] F02 P2: 标准背板首条穿入柱角部
- [ ] F03 P2: 2040 标准底排角件在柱底以下
- [ ] F06 P2: 标准统计保留旧名义长度及五金数量
- [ ] ROD-01 P1: 亚克力屏板夹与立柱断开
- [ ] ROD-02 P1: poster/acrylic底盘横轴与底叉断开
- [ ] ROD-03 P1: poster/acrylic全深镀锌层板悬空
- [ ] ROD-04 P1: 亚克力整屏穿过窄托板和全深层板
- [ ] BOOK-01 P1: 外挂斜托和贯穿杆没有承托到有限层板
- [ ] BOOK-02 P1: 展示塔亚克力前挡穿入默认样书
- [ ] STATE-01 P1: 旧#books长桌分享和本地保存被恢复为展示塔
- [ ] BOOK-03 P2: 展示塔前挡唇与斜板没有接触或连接件
- [ ] ROD-05 P2: panel窄托板四只端夹与T块完全重复
- [ ] ROD-06 P2: panel/acrylic隐藏普通背板仍进入采购清单
- [ ] BOOK-04 P2: TILT倾角控件修改配置却不改变模型
- [ ] TABLE-01 P2: 长桌有真实脚垫却没有支撑标记数据
- [ ] BOM-01 P2: rod底盘杆件的实际几何、总长与重量不一致
- [ ] TABLE-02 P2: 开启玻璃副层板及支承后自重完全不变
- [ ] MODEL-01 P2: rod/tower采购描述带刹车但脚轮模型始终无刹车

## Implementation gates

- [ ] Preserve initial dirty files and baseline rod geometry report.
- [ ] For each independent behavior: write regression, observe expected failure, stage implementation, syntax-check, copy and verify.
- [ ] Collect each AGY result and inspect the full diff against its starting snapshot before copying owned files.
- [ ] Unit tests, matrix probes, all browser tests and Vite single-file build pass.
- [ ] Visually inspect all changed model variants and verify actual GLB exports, including animation round trips.
- [ ] Review every numbered finding against current geometry/state/BOM evidence; explicitly record protected original comparison path.
- [ ] Save local reviewable preview, remediation report and source patch. No remote delivery.
