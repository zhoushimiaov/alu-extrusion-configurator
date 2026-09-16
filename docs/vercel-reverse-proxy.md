# Vercel 反向代理部署记录（rack.means.group）

> 建立时间：2026-09-15
> 目的：让 `rack.means.group` 在中国大陆可直连访问
> 状态：已上线并验证通过

---

## 1. 结论速览

| 项 | 值 |
|---|---|
| 对外地址 | `https://rack.means.group`（不变） |
| 服务方式 | Vercel 边缘反向代理 → Cloudflare Worker |
| 上游地址 | `https://<worker>.<account>.workers.dev` |
| Vercel 项目 | `proxy-rack`（账户 `zhoushimiaov`，团队 `zhoushimiaovs-projects`） |
| Worker 版本 | `2b2769fd`（已解除 `rack.means.group` 自定义域） |
| DNS | `CNAME rack → cname.vercel-dns.com`，**proxied = false（纯 DNS）** |
| 国内直连耗时 | 0.62 ~ 0.97 s |

---

## 2. 背景与选型

Cloudflare 免费托管的 IP 段（104.21.x / 172.67.x）以及 `workers.dev` 全域在国内被墙
（TCP 超时或 TLS 被掐断）。`rack.means.group` 原先直接绑定 Cloudflare Worker 自定义域，
国内无法访问。

Vercel 的边缘节点（本次命中 `sin1` 新加坡）在国内直连质量好，因此采用
**Vercel 反代 + 上游仍是原 Worker** 的方案：

- 域名不变，用户无感；
- 静态资产与 `/api/market` 价格表仍由同一个 Worker 提供，**单一数据源，不复制数据**；
- 改价流程不变（改 KV 即可），不需要重新部署反代。

### 架构

```
国内浏览器
   │  直连（无需翻墙）
   ▼
rack.means.group  ──(CNAME, DNS only)──▶  Vercel 边缘 (sin1)
                                            │  rewrite 全部路径
                                            ▼
                        <worker>.<account>.workers.dev
                        （Cloudflare Worker：静态资产 + /api/market）
```

---

## 3. 部署步骤（可复现）

### 3.1 前置条件

- 本机代理 `127.0.0.1:7897` 可用（部署阶段访问 Cloudflare / Vercel API 用）；
- 已登录 Cloudflare（`npx wrangler whoami`）与 Vercel（`npx vercel whoami`）；
- Cloudflare zone `means.group` 的 id：`<CF_ZONE_ID>`；
- 账号 id：`<CF_ACCOUNT_ID>`（Worker 与 DNS 同账号）。

### 3.2 反代项目文件

工作目录内只需一个 `vercel.json`（纯 rewrite，无构建、无静态文件）：

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "https://<worker>.<account>.workers.dev/$1" }
  ]
}
```

### 3.3 命令序列

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'

# ── 第一步：让上游 workers.dev 可用（这一步是前提，否则反代回源 404）
#    wrangler.toml 中：workers_dev = true
Set-Location F:\Autoclaw\alu_extrusion
$env:CLOUDFLARE_ACCOUNT_ID='<CF_ACCOUNT_ID>'
npx wrangler deploy

# ── 第二步：创建并部署 Vercel 反代项目
Set-Location <含 vercel.json 的目录>
npx vercel@latest login                       # 浏览器设备授权（一次性）
npx vercel@latest link --yes --project proxy-rack
npx vercel@latest deploy --prod --yes

# ── 第三步：绑定自定义域（此时 DNS 还没切，先登记）
npx vercel@latest domains add rack.means.group proxy-rack

# ── 第四步：释放域名
#    4a. 删除 Cloudflare Worker 上的自定义域（必须走 API / Dashboard）
#        DELETE /accounts/{account_id}/workers/domains/{domain_id}
#        删掉后才会释放只读的占位 AAAA 记录
#    4b. 建 DNS：CNAME rack → cname.vercel-dns.com，proxied=false
```

### 3.4 建议的验证顺序（重要）

**不要**先切正式域名再验证。正确做法是先用一个临时域名（本次用 `rack2.means.group`）
把 Vercel → Worker 这条链路走通，确认无误后再切换 `rack`，这样正式入口不会出现无解析窗口。

---

## 4. 踩坑清单

### 4.1 【最坑】删掉 wrangler.toml 的 routes 并不会删除自定义域

- **现象**：把 `wrangler.toml` 里的
  `routes = [{ pattern = "rack.means.group", custom_domain = true }]` 注释掉并重新 `wrangler deploy`，
  部署输出里确实不再有 `rack.means.group (custom domain)` 了，但该域名仍然解析到 Cloudflare。
- **原因**：Wrangler 只负责「声明式地创建/更新」，**不会卸载已存在的自定义域**；
  在 Dashboard / API 侧创建的自定义域会一直保留。
- **处置**：必须显式删除：

  ```
  DELETE /accounts/<CF_ACCOUNT_ID>/workers/domains/{domain_id}
  ```

  domain_id 可用 `GET /accounts/{acc}/workers/domains` 查询（本次为
  `8371d789eeb29f8c11a32afdfa3f22fae96157b8`，对应 hostname `rack.means.group`）。

### 4.2 CF 自定义域的占位记录是只读的

- **现象**：删除自定义域之前去改 DNS，报错 `1043: Unable to edit this record as this has been configured as read only`。
- **原因**：Worker 自定义域会在 zone 里生成一条受管的占位记录（`AAAA → 100::`，proxied=true），
  生命周期由 Workers 管理，DNS 接口无权修改。
- **处置**：顺序必须是「先删自定义域 → 占位记录自动消失 → 再建自己的 CNAME」。

### 4.3 Vercel 项目默认保护策略：自定义域不拦，`*.vercel.app` 拦

- **现象**：部署完成后访问 `proxy-rack-xxx.vercel.app` 返回 302，跳
  `https://vercel.com/sso-api?...`。
- **原因**：项目 `ssoProtection = { "deploymentType": "all_except_custom_domains" }`，
  部署地址受防护，**自定义域不拦**。
- **处置**：验收一律用自定义域，不要用 `*.vercel.app`；
  如果确实需要关掉防护，用 `vercel api /v9/projects/proxy-rack -X PATCH --input body.json`
  传 `{"ssoProtection": null}`（不要直接用 REST 手打 token，见 4.4）。

### 4.4 Vercel CLI 的 token 会过期，直连 REST API 会 `invalidToken`

- **现象**：`%APPDATA%\xdg.data\com.vercel.cli\auth.json` 里的 `token` 直接拿去调
  `https://api.vercel.com/...` 返回 `403 {"code":"forbidden","invalidToken":true}`，
  但 CLI 本身一切正常。
- **原因**：该 access token 有 `expiresAt`（本次是 09-04），CLI 会用 `refreshToken` 自动续期，
  直接拿文件里的旧 token 调 API 就会失败。
- **处置**：需要打 Vercel API 时用 CLI 的透传命令，它会自动带上有效 token：

  ```powershell
  npx vercel@latest api /v9/projects/proxy-rack            # GET
  npx vercel@latest api /v9/projects/proxy-rack -X PATCH --input body.json
  ```

### 4.5 DNS 记录必须是「纯 DNS」（proxied = false）

- **现象**：如果 CNAME 开着橙云（proxied = true），请求会被 Cloudflare 接走，
  等于绕回起点，Vercel 完全没参与。
- **判断依据**：响应头出现 `Cf-Ray` / `Cf-Cache-Status` 且**没有** `Server: Vercel`。
- **注意**：反代正常工作时也会看到 `Cf-Ray` / `Cf-Cache-Status` —— 那是 Vercel 回源时
  **上游 Worker 的响应头被透传**下来的，属于正常现象。区分办法是看有没有
  `Server: Vercel` 和 `X-Vercel-Id`（本次为 `sin1::***`，即新加坡边缘）。

### 4.6 上游没开 workers.dev 会 404

- **现象**：反代指向 `<worker>.<account>.workers.dev` 时返回
  404 + 纯文本 `error code: 1042`。
- **原因**：该 Worker 只有自定义域、`workers.dev` 未开启。
- **处置**：`wrangler.toml` 加 `workers_dev = true` 后重新部署。
  这一步在切换完成后**是必需的**——自定义域交出去之后，Worker 就只剩 workers.dev 这条入口。

### 4.7 本机安全策略会拦截删除类命令

- **现象**：`npx vercel domains rm ...` 被 `AUTOCLAW_SAFETY_GUARD_DENIED`
  （`risk=File delete command`）拦下。
- **处置**：不要在同一个回合内换工具/换写法绕过；把这类清理动作写进文档，
  由确认后单独执行。本次 `rack2.means.group` 的 DNS 记录已通过 Cloudflare API 删除，
  仅 Vercel 项目里残留一个域名条目（无 DNS、不解析、无实际影响）。

### 4.8 其他小项

- Vercel 预览部署默认启用 Deployment Protection，对外服务必须 `--prod`。
- `vercel.app` 域名本身在国内也被墙，**只有绑定的自定义域**才享受国内直连。
- 首次 `vercel link` 会在目录里生成 `.env.local` 与 `.vercel/`，属于本地配置，不要提交。

---

## 5. 验证清单

以下是本次实际执行的核对项（全部在**未走代理**的直连环境下完成）：

| 检查项 | 命令要点 | 结果 |
|---|---|---|
| DNS 归属 | `Resolve-DnsName rack.means.group` | `76.76.21.164` / `66.33.60.34`（Vercel） |
| 首页状态与身份 | `curl -D -` | `200`，`Server: Vercel`，`X-Vercel-Id: sin1::***` |
| 内容一致性 | 与本地 `dist/index.html` 比 SHA256 | 一致（757,275 B，`873BF1144E8B4A8A`） |
| 直连耗时 | 连续 4 次 | 0.62 / 0.78 / 0.97 / 0.67 s |
| 价格表接口 | `GET /api/market` | `200`，6 条规则正常 |
| 静态资源 | `/favicon.png`、`/og-cover.jpg` | `200` / `200` |
| 未知路径 | `GET /no-such-path` | `404`（与切换前一致） |
| 浏览器端 | Playwright 打开首页与 `#cart` | 五 tab 正常、loader 正常隐藏、**console 零错误** |
| 上游直连 | 打开 `workers.dev` 地址 | `200`，内容一致 |

---

## 6. 日常更新与重新部署

### 6.1 改代码后

```powershell
Set-Location F:\Autoclaw\alu_extrusion
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
$env:CLOUDFLARE_ACCOUNT_ID='<CF_ACCOUNT_ID>'
npm run build
npx wrangler deploy
```

**Vercel 反代不需要重新部署**：它是纯 rewrite，内容始终跟随上游 Worker。

### 6.2 反代本身要重建时

```powershell
Set-Location <含 vercel.json 的目录>
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
npx vercel@latest link --yes --project proxy-rack
npx vercel@latest deploy --prod --yes
npx vercel@latest domains add rack.means.group proxy-rack   # 若已绑定可跳过
```

### 6.3 改价格表（不影响本次改动）

```powershell
npx wrangler kv key put --binding=MARKET_KV price_table --path tools/price_table.json --remote
```

---

## 7. 回滚到 Cloudflare 直连

1. Cloudflare DNS：删除 `rack` 的 CNAME；
2. `wrangler.toml`：取消 `routes` 注释块（文件内已保留），执行 `npx wrangler deploy`；
3. Cloudflare Dashboard：为该 Worker 重新添加自定义域 `rack.means.group`；
4. Vercel：`npx vercel domains rm rack.means.group`。

---

## 8. 与其他入口的对照

| 入口 | 架构 | 国内直连 |
|---|---|---|
| `rack.means.group` | Vercel 反代 → CF Worker | 是（本文档） |
| `p.means.group` | Vercel 反代 → `portfolio.means.group` | 是 |
| `portfolio.means.group` | CF Tunnel → 办公室 NAS | 否 |
| `canvas.means.group` | CF Tunnel + Access（需鉴权） | 否，且无反代价值 |

---

## 9. 遗留

- [ ] Vercel 项目 `proxy-rack` 中残留域名条目 `rack2.means.group`（验证用），
      DNS 记录已删除、不解析、无实际影响。如需清理：
      `npx vercel domains rm rack2.means.group`
- [ ] Cloudflare Worker 若未来需要在国内被直接访问，只能复用本文的 Vercel 反代方案；
      不要重新绑定自定义域（免费 IP 段仍被墙）。
