# 型格铝作 · 五产品参数化 3D 配置器

完全在浏览器端程序化建模的实时产品配置器：全部几何体运行时生成，零外部模型文件，
`npm run build` 产出**单个** `dist/index.html`，可离线双击打开。

在线地址（国内直连）：**https://rack.means.group**

## 产品线

| # | 产品 | 入口 | 说明 |
|---|---|---|---|
| 1 | 工业铝型材置物架 | `#`（默认） | 真实 T-slot 截面，逐层逐跨参数化装配 |
| 2 | 光轴展架 | `#rod` | 单排双柱展示架，三种样式（海报 / 双联展板 / 亚克力展示屏） |
| 3 | 移动边几 | `#cart` | 木纹立柱 + 玻璃台面 + 亚克力中板 + 光轴挂杆 + 万向轮 |
| 4 | 周转箱收纳架 | `#crates` | 铝架 + 抽拉式物流周转箱，多配色、层数可调 |
| 5 | 光轴木展车 | `#woodcart` | 胶合板柜体 + 洞洞板背板 + 光轴立柱 + 层板挂杆 |

> 另有 `#node` 精确节点视角（GLB 同构装配模式），用于对照原始模型结构。
> 产品之间通过右上角标签页或 URL hash 切换。

## 功能

- **参数化装配**：尺寸、层数、跨数、配色、附件开关实时重建，面板与 3D 同步
- **实时算料**：截面净面积 × 长度 × 密度实算自重，算料单导出
  （SpreadsheetML，Excel / WPS 直接打开）
- **材料估价**：BOM × 单价引擎，支持远程价格表（KV）/ 内置表回退，未计价项单独标注
- **模型导出**：当前装配导出 `.glb`（导出前把 InstancedMesh 逐实例展平，
  保证通用查看器里形体完整）
- **3D 交互**：左键旋转 / 右键平移 / 滚轮缩放，WASDQE 键盘平移；
  尺寸标注、± 悬浮热点、多相机预设、爆炸视图、自转
- **渲染管线**：程序化摄影棚环境光照（PMREM）+ ACES 色调映射 + 轻量暗角；
  可选 GTAO 环境光遮蔽（`?ao`）
- **配置持久化**：URL hash permalink + localStorage（按产品隔离）
- **降级与无障碍**：WebGL 不可用时仍可算料；尊重系统「减少动态效果」设置；
  单文件构建离线可用

## 快速开始

```powershell
npm install
npm run dev              # 开发预览
npm run build            # 产出单文件 dist/index.html
npm test                 # 单元测试（node:test）
node tools/qa-browser.mjs   # 真机浏览器 QA：五产品渲染 / 交互 / console 错误
node tools/qa-geometry.mjs  # 几何约束断言（无需浏览器）
node tools/qa-export.mjs    # 模型导出形体校验
```

## 部署

推送 `main` 会自动部署到 Cloudflare Workers（GitHub Actions，见下）；也可以在本地手动部署：

```powershell
npm run build
npx wrangler deploy --config wrangler.local.toml
```

- 线上架构：`rack.means.group` → Vercel 边缘反向代理（纯 rewrite）→ Cloudflare Worker
  （静态资产 + `/api/market` 价格表）。Vercel 那层无需重新部署。
- 自动部署只对「非文档改动」生效，且需要先在仓库配置 2 个 Secrets（缺失时会自动跳过，不报错）
- 详细步骤、配置文件分工、Secrets 清单：见 **[docs/deployment.md](docs/deployment.md)**
- 反代架构与踩坑记录：见 [docs/vercel-reverse-proxy.md](docs/vercel-reverse-proxy.md)
- 出问题怎么退：见 **[docs/rollback.md](docs/rollback.md)**（六个回滚场景）

## 目录结构

```
├── index.html               入口 HTML（含 file:// 跳转守卫）
├── worker.js                Cloudflare Worker：/api/market + 静态资产兜底
├── wrangler.toml            Worker 部署配置（公开版，标识符为占位符）
├── vite.config.js           Vite + vite-plugin-singlefile
├── docs/                    部署说明 / 反代记录 / 设计计划
├── md/                      GLB 逆向参考与评审笔记
├── model/                   结构提取脚本与截面数据
├── public/                  静态资源（favicon、OG 图）
├── test/                    单元测试
├── tools/                   QA 脚本与价格表
└── src/
    ├── main.js              产品接线 / 防抖重建 / 渲染循环
    ├── styles.css           设计 token 与组件样式
    ├── config/              各产品唯一配置源（product 型材 / rodrack 光轴 /
    │                        cart 边几 / crates 周转箱 / woodcart 木展车 / market 价格）
    ├── core/                几何与场景：profiles（T-slot 截面）、各 buildXxx 装配、
    │                        materials、scene、postfx、anims、dimensions、hotspots、joints
    └── ui/                  面板与状态：各 xxxPanel、store、persist、hud、
                             cutlist（算料）、marketPrice（估价）、modelExport、dragSlider
```

## 技术说明

- 自重实算：截面净面积 × 长度 × 密度（铝 2700 / 钢 7850 kg/m³）+ 五金示例单重。
- 大量零件用 `InstancedMesh` 承载，整机 draw call 保持个位数到几十。
- 光轴展架结构基准来自 GLB 逆向数据（`assets_src/guangzhou02-parts.json`），
  改动结构前建议先读它。
- 单文件构建：`vite-plugin-singlefile` 把 JS / CSS / 贴图全部内联。
- 报价与承重均为**演示示例**，页面已标注，不作为加工、采购或承重依据。

## 许可

[MIT](LICENSE)
