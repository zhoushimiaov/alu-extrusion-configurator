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

## 3. 用 GitHub Actions 自动部署（可选）

可以，wrangler 本身就能在 CI 里跑。仓库已提供 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)：

1. 生成 Cloudflare API Token，权限至少包含 **Workers Scripts: Edit** 与 **Workers KV Storage: Edit**
2. 仓库 Settings → Secrets and variables → Actions 添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `MARKET_KV_NAMESPACE_ID`（可选，用于把真实 KV 绑定注入 CI 生成的配置）
3. 工作流默认是**手动触发**（Actions 页面点 Run workflow）；需要 push 自动部署时，
   取消 `deploy.yml` 里 `push:` 段的注释即可。

工作流的做法是：检出 → `npm ci` → `npm run build` → 由 `wrangler.toml`
生成一份带真实 KV id 的临时配置 → `wrangler deploy`。因此 CI 部署不会把
标识符写回仓库。

> 不建议使用 Cloudflare 控制台的 Git 集成（Workers Builds）：那会让部署流程分叉，
> 与本文档记录的命令不一致。

---

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
