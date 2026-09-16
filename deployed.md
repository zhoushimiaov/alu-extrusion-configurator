# deployed · 自动化部署流程

> 本文档描述 `rack.means.group` **当前实际运行**的自动化部署链路，与仓库内的
> `.github/workflows/deploy.yml`、`tools/make-ci-config.mjs` 一一对应。
> 最后核对：2026-09-16（运行 [#35060866985](https://github.com/zhoushimiaov/alu-extrusion-configurator/actions/runs/35060866985) 成功部署 Worker Version `eb56decb`）。

---

## 1. 一张图看懂

```
你在本地改代码
   │  git add → commit → git push origin main
   ▼
GitHub 仓库（zhoushimiaov/alu-extrusion-configurator）
   │  push 事件触发 .github/workflows/deploy.yml
   ▼
GitHub Actions（ubuntu-latest）
   │  npm ci → 大小写检查 → npm test → npm run build
   │  → node tools/make-ci-config.mjs（生成 wrangler.ci.toml）
   │  → wrangler deploy --config wrangler.ci.toml
   ▼
Cloudflare Worker「modulo-alu-shelf」（静态资产 + /api/market 价格表）
   ▲
   │  纯 rewrite 反向代理（无需重新部署）
rack.means.group ◀── 用户浏览器（国内直连，Vercel 边缘）
```

要点：**推送到 GitHub 就会自动部署**（对非文档改动）；Vercel 那层是透明反代，永远不需要单独部署。

---

## 2. 触发条件

| 情况 | 是否部署 |
|---|---|
| push 到 `main`，改动 `src/`、`index.html`、`worker.js`、`wrangler.toml`、`.github/` 等 | ✅ 自动部署 |
| push 只改文档（`**/*.md`、`docs/**`、`md/**`、`LICENSE`、`.gitignore`） | ⛔ 跳过（`paths-ignore`，避免无意义部署） |
| push 到其他分支 | ⛔ 不触发 |
| Actions 页面手动 **Run workflow** | ✅ 部署 |
| Pull Request | ⛔ 不触发 |

同一时间只有一个部署在跑（`concurrency: deploy-workers`，进行中的不会被取消）。

---

## 3. 每次部署做的 8 件事

| # | 步骤 | 失败会怎样 |
|---|---|---|
| 1 | 检查 Secrets（`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`） | 缺失 → 打印提示并**跳过部署**（不报错、不影响线上） |
| 2 | `npm ci` | 失败 → 不部署 |
| 3 | `node tools/check-import-case.mjs`（导入路径大小写，防 Linux 找不到模块） | 失败 → 不部署 |
| 4 | `npm test`（50 项单元测试） | 失败 → 不部署，线上保持上一版 |
| 5 | `npm run build`（产出单文件 `dist/index.html`） | 失败 → 不部署 |
| 6 | `node tools/make-ci-config.mjs`（由公开 `wrangler.toml` 生成 `wrangler.ci.toml`；有 `MARKET_KV_NAMESPACE_ID` 就注入 KV 绑定，没有就移除绑定并回退内置价格表） | 失败 → 不部署 |
| 7 | `wrangler deploy --config wrangler.ci.toml` | 失败 → 线上保持上一版 |
| 8 | 写入运行摘要（Worker 名 / 提交 SHA / 触发方式 / 线上地址） | — |

---

## 4. 一次部署涉及的三个环境

| 环境 | 角色 | 关键配置 |
|---|---|---|
| GitHub 仓库 | 源码 + 触发器 | `.github/workflows/deploy.yml`；Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`MARKET_KV_NAMESPACE_ID` |
| GitHub Actions | 构建 + 测试 + 部署执行 | Node 20、`npm ci`、wrangler 4（`wrangler-action@v3`） |
| Cloudflare Workers | 线上运行时（被 Vercel 反代） | `wrangler.toml`（公开模板）/ `wrangler.local.toml`（本地真实值，不入库）/ `wrangler.ci.toml`（CI 生成，不入库） |

分支约定：只认 `main`。改文档不影响线上；改代码合入 `main` 即发布。

---

## 5. 本地手动部署（兜底，不需要 GitHub）

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
Set-Location F:\Autoclaw\alu_extrusion
npm run build
npx wrangler deploy --config wrangler.local.toml
```

本地配置文件 `wrangler.local.toml` 含真实账号与 KV 标识符，已被 `.gitignore` 忽略。
改了 `wrangler.toml` 的结构（名称 / 入口 / 资源目录 / 绑定名）时，记得同步 `wrangler.local.toml`。

---

## 6. 部署后自检（30 秒）

```powershell
# 1) 线上与本地构建产物一致
curl.exe -sS --max-time 30 -o online.html https://rack.means.group/
# 与 dist/index.html 比 SHA256

# 2) 价格表接口
curl.exe -sS --max-time 30 https://rack.means.group/api/market

# 3) 仓库自带的三件套
node tools/qa-browser.mjs      # 五产品渲染 / 交互 / console 错误
node tools/qa-geometry.mjs     # 几何约束断言
node tools/qa-export.mjs       # 模型导出形体校验
```

---

## 7. 出问题怎么退

完整回滚手册见 **[rollback.md](./docs/rollback.md)**。最常用的两条：

| 场景 | 命令 |
|---|---|
| 新版本有 bug，回上一版 | `npx wrangler deployments list` → `npx wrangler rollback <version-id> --name modulo-alu-shelf` |
| 只想停掉自动部署 | 仓库 Settings → Actions → 选 Deploy to Cloudflare Workers → **Disable workflow** |

---

## 8. 图片资产说明（本仓库根目录的 .webp）

为方便在 GitHub 上直接预览，仓库根目录新增了一批 `.webp` 图片
（由 `md/glb-reference/` 的原图与 `public/` 的品牌图转出，质量 82）：

| webp（根目录） | 来源 | 原大小 | webp 大小 | 压缩 |
|---|---|---:|---:|---:|
| 01-overview-isometric.webp | md/glb-reference/01-overview-isometric.png | 1264.6 KB | 136.5 KB | 89.2% |
| 02-front-XY.webp | md/glb-reference/02-front-XY.png | 233.5 KB | 78.7 KB | 66.3% |
| 03-side-ZY.webp | md/glb-reference/03-side-ZY.png | 45.1 KB | 17.9 KB | 60.4% |
| 04-top-XZ.webp | md/glb-reference/04-top-XZ.png | 69.9 KB | 20.7 KB | 70.4% |
| 05-left-bottom-joint.webp | md/glb-reference/05-left-bottom-joint.png | 86.1 KB | 22.1 KB | 74.3% |
| 06-fasteners-isolated.webp | md/glb-reference/06-fasteners-isolated.png | 111.7 KB | 37.0 KB | 66.9% |
| 07-deck-section.webp | md/glb-reference/07-deck-section.png | 107.4 KB | 36.6 KB | 66.0% |
| 08-depth-beam-section.webp | md/glb-reference/08-depth-beam-section.png | 172.0 KB | 45.9 KB | 73.3% |
| 09-width-rail-section.webp | md/glb-reference/09-width-rail-section.png | 191.7 KB | 43.5 KB | 77.3% |
| favicon.webp | public/favicon.png | 1.2 KB | 0.6 KB | 53.0% |
| og-cover.webp | public/og-cover.jpg | 71.6 KB | 42.5 KB | 40.6% |

原图保留在原路径未删除；站点运行**不依赖**这些根目录 webp（仅用于浏览）。
批量转换命令：

```powershell
npx --yes sharp-cli -i <原图路径> -o . -f webp --quality 82
```
