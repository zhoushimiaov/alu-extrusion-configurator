# 部署说明

> 一句话结论：**把代码推送到 GitHub 不会触发任何部署。**
> 线上更新必须显式执行构建 + `wrangler deploy`；Vercel 那一层只是反向代理，不需要重新部署。

---

## 1. 线上架构

```
浏览器
  │
  ▼
rack.means.group ──(CNAME, 纯 DNS)──▶ Vercel 边缘（反向代理，纯 rewrite）
                                        │
                                        ▼
                     <worker-name>.<account-subdomain>.workers.dev
                     （Cloudflare Worker：静态资产 + /api/market 价格表）
```

- 静态资产与价格表由**同一个 Cloudflare Worker** 提供，单一数据源，不复制数据。
- Vercel 侧项目只包含一条 rewrite 规则（`vercel.json`），没有构建产物。
  **不要把它连接到本仓库**：一旦连接，Vercel 会切换为“构建并部署仓库”，
  rewrite 会被覆盖，反代立即失效。
- 之所以要这层反代：Cloudflare 免费托管 IP 段在中国大陆被墙，Vercel 边缘可直连。
- 反代的完整踩坑记录见 [`vercel-reverse-proxy.md`](./vercel-reverse-proxy.md)。

---

## 2. 本地部署（默认方式）

前置：Node 20+、Cloudflare 账号（`npx wrangler login`）。

```powershell
npm ci
npm run build            # 产出单文件 dist/index.html
npx wrangler deploy --config wrangler.local.toml
```

### 两个配置文件的分工

| 文件 | 是否入库 | 内容 |
|---|---|---|
| `wrangler.toml` | 是（公开） | 结构配置：Worker 名称 / 入口 / 静态资源目录 / KV 绑定名，标识符为占位符 |
| `wrangler.local.toml` | 否（已忽略） | 与上面相同，另补全本账号的 account id 与 KV namespace id |

首次在自己账号下部署：

1. 复制 `wrangler.toml` 为 `wrangler.local.toml`
2. 用 `npx wrangler kv namespace create MARKET_KV` 创建 KV，把返回的 `id` 填入
3. 把价格表写进 KV：

```powershell
npx wrangler kv key put --binding=MARKET_KV price_table --path tools/price_table.json --remote
```

> 公开仓库里不放真实的 account id / KV namespace id：它们不是凭据（没有 token 无法使用），
> 但属于账号基础设施标识，没必要外发；同时也能避免别人误用我们的命名空间。

---

## 3. GitHub Actions 自动部署（已启用）

**推送即部署已开启**：任何推送到 `main` 且改动了非文档文件的提交，都会自动构建并部署到
Cloudflare Workers。工作流文件：[.github/workflows/deploy.yml](../.github/workflows/deploy.yml)

### 3.1 需要先配置的 Secrets

仓库 Settings → Secrets and variables → Actions：

| Secret | 必填 | 用途 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 是 | 部署凭据。权限至少：**Workers Scripts: Edit**、**Workers KV Storage: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | 指定账号（该登录态下有多个账号，非交互环境必须显式指定） |
| `MARKET_KV_NAMESPACE_ID` | 否 | 价格表 KV 命名空间 id。**不填也能部署**：工作流会移除 KV 绑定，页面自动回退内置价格表 |

> 未配置前工作流不会报错：它会打印一条提示并跳过部署。配好之后无需再改代码，下次推送自动生效。

### 3.2 触发条件

| 情况 | 是否触发 |
|---|---|
| push 到 `main`，改动了 `src/`、`index.html`、`worker.js`、`wrangler.toml` 等 | ✅ 触发并部署 |
| push 仅改动文档（`*.md`、`docs/`、`md/`、`LICENSE`、`.gitignore`） | ⛔ 不触发（避免无意义部署） |
| 其他分支 push | ⛔ 不触发 |
| Actions 页面手动 Run workflow（`workflow_dispatch`） | ✅ 触发并部署 |
| PR | ⛔ 不触发（只监听 push） |

### 3.3 工作流做了什么

```
checkout → setup-node(20, npm cache)
  → 检查 Secrets（缺失则跳过后续步骤）
  → npm ci
  → npm test          # 50 项单元测试，不通过则不部署
  → npm run build     # 产出单文件 dist/index.html
  → node tools/make-ci-config.mjs   # 由公开 wrangler.toml 生成 wrangler.ci.toml
  → wrangler deploy --config wrangler.ci.toml
  → 写入运行摘要（Worker 名、提交 SHA、触发方式、线上地址）
```

- 并发策略：`concurrency: deploy-workers`，同一时间只跑一个部署，且**不取消进行中的部署**，
  避免线上出现半截状态。
- 凭据只以 Secret 形式注入，生成物 `wrangler.ci.toml` 已被 `.gitignore` 忽略，**不会把标识符写回仓库**。
- 若只想保留手动部署：把 `deploy.yml` 里的 `push:` 段删除，或用
  Settings → Actions → 该工作流 → Disable 临时停用。

### 3.4 与 Cloudflare 自带 Git 集成的取舍

不建议使用 Cloudflare 控制台的 **Workers Builds**：它会让部署入口分叉（控制台配置 + 本仓库文档
记录的命令不一致），且构建环境需要单独配置 KV 绑定。用 GitHub Actions 的好处是
**构建、测试、部署三步都在同一份可版本化的配置文件里**。

## 4. 部署后自检

```powershell
# 线上文件与本地构建产物一致（单文件构建，哈希可直接比）
curl.exe -sS -o online.html https://rack.means.group/
```

浏览器侧建议跑一遍仓库自带的 QA：

```powershell
node tools/qa-browser.mjs        # 五产品渲染 / 交互 / console 错误
node tools/qa-geometry.mjs       # 几何约束断言（无需浏览器）
node tools/qa-export.mjs         # 模型导出形体校验
```

---

## 5. 回滚

全部回滚路径已整理成独立手册：**[rollback.md](./rollback.md)**（Worker 版本 / KV 价格表 /
反代与 DNS / Git 仓库与历史 / 误连 Git 集成 / 下线，六个场景，每个都有症状、命令与验证）。

最常用的两条：

```powershell
npx wrangler deployments list            # 找上一版部署 id
npx wrangler rollback <deployment-id>    # 回到该版本（可反复切换）
```

---

## 6. 版本与归档

| 项 | 值 |
|---|---|
| 自动部署启用日期 | 2026-09-16 |
| 对应提交 | `7afbff3`（ci: 推送 main 自动部署到 Cloudflare Workers） |
| 首次运行记录 | [Actions run #35052160987](https://github.com/zhoushimiaov/alu-extrusion-configurator/actions/runs/35052160987)（未配置 Secrets，按设计跳过部署，结论 success） |
| 配置生成脚本 | `tools/make-ci-config.mjs` |
| 回滚手册 | [rollback.md](./rollback.md) |
| 反代架构记录 | [vercel-reverse-proxy.md](./vercel-reverse-proxy.md) |

本仓库的文档均为长期维护文档：修改后请同步更新本节日期与对应提交号。
