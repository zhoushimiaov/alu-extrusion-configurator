# HANDOVER — MODULO 铝型材置物架配置器

> **该文档为历史交接快照。最新交接文档：[`HANDOVER-LATEST.md`](./HANDOVER-LATEST.md)。**
> 项目路径：`F:\Autoclaw\alu_extrusion`
> 交接人：paw-site-building（QwenPaw agent · site-building）
> 日期：2026-09-07
> 交接对象：接手该项目的任何开发者 / agent

---

## 1. 项目是什么

纯前端单页应用（Vite + Three.js），铝型材置物架的 3D 配置器 + 算料单 + BOM 估价。
**没有后端**：Cloudflare Workers 只是静态资产托管（wrangler.toml `[assets]`），
Vercel 只做 rewrite 反代。所有逻辑在浏览器端。

两个产品模式（底部按钮互切）：
- **铝型材置物架**（默认）：`src/core/buildShelf.js`，2020/2040 参数化装配
- **光轴展架**：`src/core/buildRodRack.js`

外加一个**独立测试模式**（不进生产 BOM）：`src/core/buildGlbFrame.js`，
按参考 `model/alu-frame.glb` 实测坐标重建的装配原型，测试页
`model/glb-node-test.html`。

## 2. 目录速览

```
src/
  main.js              # 入口：场景、双 store 订阅、重建、持久化恢复、降级分支
  config/product.js    # 型材系列、层板类型、颜色、LIMITS、normalizeConfig、beamCutLength
  config/rodrack.js    # 光轴展架配置
  config/market.js     # 市场价表（重要：见 §5 价格数据状态）
  core/profiles.js     # T槽截面工厂（makeTSlotShape）+ 挤出工具
  core/buildShelf.js   # 铝型材架装配 + cutList（含 span/len 双列）
  core/buildRodRack.js # 光轴展架装配
  core/buildGlbFrame.js# GLB 同构装配原型（独立，未接面板）
  core/materials.js    # 材质（切割端面 vs 拉丝侧面）
  ui/store.js          # 极简 pub/sub store ×2（profile/rod）
  ui/panel.js          # 型材架控制面板（报价区块在此）
  ui/rodpanel.js       # 光轴面板
  ui/cutlist.js        # 算料单导出（SpreadsheetML .xml）
  ui/persist.js        # URL hash permalink + localStorage
  ui/marketPrice.js    # BOM×单价估价引擎
  ui/priceview.js      # 报价拆分 + 淘宝/1688 比价链接
model/
  alu-frame.glb           # 用户提供的参考模型（只读，勿改）
  alu-frame.bounds.json   # AABB 解析结果（agy 脚本产出）
  alu-frame.metadata.json # GLB 原始 JSON
  reference-viewer.html   # 原始 GLB 自包含查看器（全景/节点近看）
  glb-node-test.html      # GLB 重建装配测试页（bundle 内联）
test/                    # node --test，28 项
md/                      # 审查报告、回归记录、GLB 对比、handover
```

构建：`npm run build`（vite singlefile，dist/index.html ~603 kB）
测试：`npm test`（node:test，当前 **28/28**）

## 3. 近期演进时间线（已完成）

1. **第一性原理审查**（`md/review-first-principles.md`）：定性为"渲染强、
   算料可信度与商业闭环弱"。致命项：下料长度不减节点占位、价格与算料双公式、
   无 permalink、零测试、国内无稳定入口。
2. **前端修复轮**：下料修正模型 `beamCutLength`（span−postW−2×JOINT_GAP）、
   cutList 增加 span/len 双列、`.xls`→`.xml`、安装说明"钢化玻璃"漂移修正、
   permalink + localStorage、双 store 防抖拆分、5 项单测。
3. **BOM 估价引擎**：`marketPrice.js` 从 cutList/hardware/panes 推导总价，
   替换原独立价格公式；面板显示材料/五金/板件拆分 + 逐项淘宝/1688 搜索链接。
   修复规格匹配优先级（20×20 立柱不再被 2040 字样错匹配）、未知项 unpriced 显式提示。
4. **节点真实化（照片驱动）**：型材端面开孔、梁止于柱侧、梁底角码与内六角
   螺钉、板条实际支承、`#node` 近景视角。25 项几何回归测试。
5. **GLB 参考对齐**：解析 `alu-frame.glb`（AABB 测量 + agy 复核），发现参考
   结构是"一侧通高 30×30 柱 + 另一侧 430mm 分段柱 + 370 进深梁 + 20×20 板条 +
   层间距 0.46"，与现有 2020/2040 拓扑不同。建了独立 `buildGlbFrame.js` 原型，
   未动生产装配。
6. **板条断口修正**：板条在中间立柱两侧独立终止（半宽 15mm + 间隙 5mm），
   加黑色节点块与横向螺栓视觉件。
7. **剖面尝试与回退**：曾按参考图做过非对称导轨剖面 `makeStripShape`
   （单T槽+V筋+双底槽），**用户判定"更不对"**，本轮已完整回退：
   板条回到 `makeTSlotShape(.02,.02)`，函数与对应测试已删除。
   **结论：剖面问题仍未解决，回到 makeTSlotShape 状态。**

## 4. 当前状态快照

- `npm test`：**28/28 通过**（回归基线）
- `npm run build`：通过，dist/index.html **603.16 kB**
- 浏览器验证过：全景渲染、节点近看、混合层板报价、刷新恢复、双产品切换
- 未发布线上（dist 是本地 build，DEPLOYMENTS.md 的部署记录未更新）

## 5. ⚠️ 必须知道的数据状态（防接手人踩坑）

1. **market.js 单价是未核验示例**，不是淘宝实时价。页面已标注"未核验示例"。
   接手人**不要**直接当采购价用；需要卖家 SKU 核验后才可撤标注。
2. **`JOINT_GAP=2mm` 无工程依据**，cutlist 已注明"未验证装配假设的演示结果，
   非加工指令"。真实节点图拿到前不能用于生产下料。
3. **GLB 构件计数未去重**，`alu-frame.bounds.json` 的数量不能直接当 BOM。
4. **al-frame.glb 的连接工法未知**（AABB 只能看外包），隐藏紧固方式全部是视觉
   示意，不构成结构承诺。
5. **价格未从材料量推导的部分**：光轴面板部分报价仍在 stats 未就绪时显示 0，
   由 updateStats 回填。

## 6. 未完成事项（按优先级）

1. **[剖面]** 板条/型材端面与参考图仍不完全一致（用户已两次反馈不满意）。
   现状：`makeTSlotShape` 四面 T 槽 + 中心孔。用户参考图显示板条剖面更复杂
   （曾被做成非对称导轨截面但被判"更不对"）。**下一步建议：请用户提供
   实物测绘尺寸或更清晰剖面照片，按数值建模，不要再凭截图猜比例。**
2. **[入口]** rack 国内 Vercel 反代未做（portfolio 已有方案 p.means.group 可复用）。
   DEPLOYMENTS.md 的 workers.dev 子域在国内多被阻断。
3. **[算料]** 梁下料修正模型需真实节点图支撑；角件/螺栓重复计数待查。
4. **[测试]** 光轴产品缺单测；buildRodRack 的 cutList 修正未覆盖。
5. **[hygiene]** DEPLOYMENTS.md 里的历史凭据段落待清理；无 git tag / release。

## 7. 工具协作备忘（本会话沉淀）

- **subagent 超时两次**（20-30min 任务挂起），后续改用 `agy` CLI 小任务模式。
- **agy 用法**：`agy --print-timeout 90s --print "<任务>"`（cwd 给隔离目录），
  一次只派一个函数级任务（分析/公式/代码生成），返回后由主 agent 审阅、
  应用、测试。已成功用例：GLB 解析脚本、坐标公式复核、剖面轮廓分析。
  失败用例：90s 只读大任务超时——**任务要小**。
- 隔离副本目录：`F:\Autoclaw\agy-smoke\`（勿当生产源码）。
- 浏览器验收：QwenPaw Browser SDK（`Browser.connect()` → `browser.open()`），
  截图保存到工作区 media/；**当前主模型不支持看图**，截图给用户人工确认。

## 8. 修改前备份

- `md/backup-20260905-104557/`：src+test 快照（前端修复轮之前）
- 无 git 仓库；**接手后第一件事建议 `git init` 并打 tag**。

## 9. 快速验证清单（接手 5 分钟自检）

```text
1. npm test                     → 28/28 pass
2. npm run build                → dist/index.html ~603 kB
3. 打开 model/glb-node-test.html → 全景 + 节点近看正常
4. 打开 dist/index.html         → 配置改动 → hash 出现 ?c= → 刷新恢复
5. 导出算料单                   → .xml 文件，Excel/WPS 打开无警告
```

---

*本 handover 由 paw-site-building 生成；事实均来自会话内工具结果，
推测性内容已标注。*
