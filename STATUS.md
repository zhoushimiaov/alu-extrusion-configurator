# STATUS.md

> 项目当前状态快照。更新时间：2026-09-15 18:35（k3 视觉管线升级 + 用户反馈修复轮）

## 2026-09-15 视觉管线升级（本轮）

- **阴影**：已按用户反馈 **关闭**（scene.js 关闭 shadowMap，移除 ShadowMaterial
  承接层；`fitShadow` 降级为按包围盒定位主光，接口保留）。
- **环境**：RoomEnvironment 换为程序化摄影棚 PMREM（中亮灰底 + 顶部柔光箱 +
  双侧后竖条高光 + 三向补光），金属有方向性条状高光，非金属辐照充足。
- **背景**：scene.background 浅色渐变幕布（transmission 材质可正确采样背景）。
- **后期**：src/core/postfx.js —— EffectComposer(MSAA×4) + OutputPass + 轻量暗角。
  **GTAO 默认关闭**：实测其深度/法线预渲染会破坏 transmission 材质的背景采样，
  使玻璃/亚克力呈"黑色半透板"（真机 4080 对照：开 AO 后整帧平均亮度下降约 24）。
  调试开关：`?ao` 显式开启 GTAO，`?nofx` 完全直通，`window.__ALU_FX` 可查询当前模式。
- **材质**：亚克力/玻璃改真实 transmission（货架磨砂层板、边几玻璃顶/橙色
  中板、展架透明压板）；镀铬/不锈钢杆加 clearcoat 清漆层。
- **操控**：左键旋转 / 右键平移 / 滚轮缩放（按用户反馈由 Rhino 式映射改回）+ WASDQE
  键盘平移（Shift 加速，输入框聚焦时不劫持）。
- 验证：npm test 50/50；rodtest 基线一致（20.1kg/45件/9.81m）；五产品
  headless 截图核对通过。勿动文件零触碰。
- 2026-09-15 18:30 用户反馈修复轮（Version 2481ac95）：
  - 鼠标映射改回左键旋转 / 右键平移；阴影管线整体关闭。
  - GTAO 默认关闭（黑色半透板根因）；`?ao` 保留为对照开关。
  - **补齐 cratesStore / woodcartStore 的 subscribe 重建订阅**（此前只有 profile/rod/cart 三组，
    导致木展车四个开关与周转箱面板改动只写数据、场景不重建，表现为"假按钮"）。
  - 模型导出改为**把 InstancedMesh 逐实例展平**为普通 mesh（GLTFExporter 的
    EXT_mesh_gpu_instancing 在通用查看器里会丢零件），并补上 crates/woodcart 的根节点命名。
  - 周转箱尺寸改为约束式求解（立柱内表面 / 抽出距离 / 侧壁倾斜 / 口沿 / 装配间隙全部计入），
    箱底落到滑轨顶面；修复箱体穿出框架。
  - 光轴展架 panel（双联展板）与 acrylic（亚克力展示屏）板高受顶档横杆约束（顶边 ≤ yTop-0.05）。
  - 基线变化：周转箱默认 4 层由 38.2 kg 变为 **33.5 kg**（箱体尺寸收紧后的必然结果）。
  - 新增工具：`tools/qa-geometry.mjs`（几何约束断言，无需浏览器）、
    `tools/qa-browser-gpu.mjs`（真机 GPU 五产品验收）。
- 注意：本页旧基线数字多处过期——型材架当前默认 6×6 大跨为
  **194.7 kg / 1274 件 / 654.2 m**（09-13 改默认配置后未更新文本）；
  周转箱架为 **33.5 kg / 46 件**（09-15 箱体尺寸约束修正后更新）。
  边几 25.5/44、木展车 38.8/38、光轴 20.1/45/9.81 已核对一致。

## 产品线

> 2026-09-14 新增第三产品「移动边几」（#cart）：4×2040 木纹立柱 + 玻璃顶 + 橙色亚克力中板 + 光轴挂杆 + 万向轮；tab 三产品切换。基线 25.5 kg / 44 件。
> 2026-09-14 新增第四产品「周转箱收纳架」（#crates）：2040 铝架 + 抽拉式周转箱，五配色，2-6 层。基线 27.5 kg / 38 件（4 层混搭）。
> 2026-09-15 新增第五产品「光轴木展车」（#woodcart）：胶合板柜体 + 光轴立柱 + 层板挂杆。基线 38.8 kg / 38 件。

| 产品 | 入口 | 状态 |
|---|---|---|
| 铝型材置物架配置器 | `#`（默认）、`#node`（GLB 精确节点视角） | 完成；09-05 结构修复 + 商业化；09-13 新版上线（OG 卡片、深色主题、6×6 大跨） |
| 光轴展架配置器 | `#rod` | 完成（忠实 GLB 逆向结构），基线 20.1 kg / 45 件 / 9.8 m |
| 移动边几配置器 | `#cart` | 完成（09-14，参考图复刻：木纹 2040 柱 + 玻璃顶 + 橙色亚克力中板 + 光轴挂杆 + 万向轮；W/D/H 三向可调）|
| 周转箱收纳架 | `#crates` | 完成（09-14，参考图复刻：2040 铝架 + 抽拉式物流周转箱，五配色方案，层数 2-6 可调，交错抽出展示；09-14 17:30 修正为真实 T-slot 截面 + 正立方箱体）|
| 光轴木展车 | `#woodcart` | 完成（09-15，参考图复刻：胶合板柜体 + 洞洞板背板 + ⌀16 光轴立柱 + 层板 + 顶/侧挂杆 + 万向轮；1-3 层板可调）|

## 线上地址

| 地址 | 用途 | 平台 |
|---|---|---|
| https://rack.means.group | 3D 配置器正式入口（Version 2481ac95）：Vercel 反代 → CF Worker | Vercel 边缘（国内直连，sin1） |
| https://<worker>.<account>.workers.dev | 反代上游（CF Worker 本体：静态资产 + /api/market） | Cloudflare Workers |
| https://p.means.group | 作品集国内直连入口（Vercel 反代 NAS） | Vercel |
| https://portfolio.means.group | 作品集源站 | CF Tunnel → 办公室 NAS |
| https://canvas.means.group | 私有服务（CF Access 鉴权；需翻墙+登录，无反代价值已确认） | CF Tunnel + Access |
| https://means.group / hub.means.group | 主站 | Vercel |

已废弃：toothsome-haircut / season-goldenrod / chiseled-hourglass /
dour-waltz 四个 workers.dev 临时子域（全部被墙阻断）。

## 09-05 k3/astra6 改造轮（已含在 09-13 上线版本中）

> 执行者：k3/astra6 代理链；改动前快照 `md/backup-20260905-104557/`、`backups/`。

### A. 型材架结构可信度修复

- `profiles.js`：2040 菱形封闭中腔 + 4020 定向双孔（真实截面）
- `buildShelf.js`：悬挑承重舌 50→70mm 真实搭接；采购 fixture 冻结对照
- `main.js`：`#node` GLB 精确节点装配模式

### B. 商业闭环 / 定价

- `config/market.js` + `ui/marketPrice.js`：BOM×单价引擎、1688 链接、
  规格匹配修正、未知规格 unpriced
- `ui/priceview.js`：未核验示例来源标注；`ui/persist.js`：按产品隔离持久化
- `cutlist.js` 诚实化：名义尺寸标注、不能用于下料的声明

### C. GLB 对接

- `model/alu-frame.glb` 解析（211 节点/1208 网格）：与参数化结构拓扑不同
- `src/core/buildGlbFrame.js` + `test/glb-layout.test.mjs`；GLB 同型装配
  作为独立模式推进（避免未审核算料替换现有模式）

### D. 09-13 用户迭代版新增（本轮上线内容）

- OG 分享卡片（微信/iMessage/Slack 抓取）、theme-color 深色化
- 6×6 大跨默认配置、GLB 精确节点模式为默认装配选项之一
- 深度尺寸标注、视图 chips（正视/侧视/轴测/槽口/节点近看/爆炸/自转）

## 基础设施状态

- Cloudflare Worker `modulo-alu-shelf`：Version 2b2769fd（09-15），**已不再绑定
  rack.means.group 自定义域**，仅保留 workers.dev 地址作为 Vercel 反代上游；
  MARKET_KV（<MARKET_KV_ID>）正常
- Vercel 项目 `proxy-rack`：纯 rewrite 反代（源 rack.means.group → 上游 workers.dev），
  项目保护策略 all_except_custom_domains（自定义域不拦截）；
  完整部署记录与踩坑清单：`docs/vercel-reverse-proxy.md`
- Vercel 项目 `proxy-t2`：反代 portfolio.means.group → p.means.group
- 源码公开仓库：`https://github.com/zhoushimiaov/alu-extrusion-configurator`（public，main）
  已做凭据脱敏与大文件清理；详细记录见 `DEPLOYMENTS.md` 文末与 `docs/vercel-reverse-proxy.md`
- DNS：means.group zone（CF）；p.means.group CNAME → cname.vercel-dns.com
- 测试：`npm test` 50 pass；采购 fixture 冻结于 test/procurement-before-geometry.json

## 待办 / 已知遗留

- [x] **MARKET_KV 已激活（2026-09-13）**：KV namespace 创建（id
  <MARKET_KV_ID>）并回填 wrangler.toml；新增 worker.js
  处理 /api/market（assets-first，未命中走 worker，替代不生效的 Pages
  Functions 写法）；初始价格表从内置 MARKET 导出
  （tools/export-price.mjs → tools/price_table.json）并写入 KV。
  线上验证：/api/market 返回含 rules/updated 的 JSON。改价流程：
  改 tools/price_table.json → `wrangler kv key put --binding=MARKET_KV
  price_table --path tools/price_table.json --remote`（5 分钟内生效）
- [x] 临时分析脚本已归档（2026-09-13）：tools/ 下 8 个（glb*.mjs、
  gz-analyze*.mjs、sidecheck.mjs、glb-view.html）移入
  `.openclaw/tmp/attic-20260913/`（可回滚）；rodtest.mjs 与
  export-price.mjs 保留；playwright.config.mjs 为 k3 轮测试基建，保留- [ ] 控制工作区 .openclaw/tmp 约 221 MB 过程文件清理——等用户确认
- [x] OG 分享图已生成部署（og-cover.jpg，GLB 节点模式渲染 + 品牌字，73KB）；海报为白色占位面片，等用户提供素材后可换真实贴图
- [ ] CF API token（DNS 权限）曾出现在对话明文，建议已撤销（未确认）
- [ ] B 轮遗留（k3/astra6 自报）：后台实时采价、price-scout.mjs、SKU 对齐、
  正式报价导入未完成；WebGL 降级完整测试未做
- [ ] C 轮遗留：GLB 同型装配与参数化模式的统计/报价统一

## 验证基线速查

```
npm test                  # 50 pass / 0 fail
node rodtest.mjs          # 光轴四配置（20.1kg/45件/9.81m 等）
线上校验 2026-09-15（Vercel 反代后）：rack.means.group 与本地 dist SHA256 一致（873BF1144E8B4A8A）
  （21F5461C32EB8B0F，667,415 B）；#node 视角渲染正常
p.means.group 直连：首页 200，图片 200，边缘缓存 0.37s
```
