# 回滚手册

本文件汇总本项目的全部回滚路径。每个场景都给出：**症状 → 影响面 → 具体命令 → 验证方法**。
命令默认在仓库根目录执行，且需要本机代理（`127.0.0.1:7897`）与已登录的 wrangler。

> 所有回滚命令都只在你自己的账号内操作；文中不出现任何真实账号标识符。

---

## 0. 速查表

| 症状 | 走哪个场景 | 可逆性 |
|---|---|---|
| 新版本上线后有 bug | 场景 A：Worker 版本回滚 | 完全可逆 |
| 价格表写错 / `/api/market` 返回异常 | 场景 B：KV 价格表恢复 | 完全可逆（有备份） |
| `rack.means.group` 打不开或反代异常 | 场景 C：反代回退到 Cloudflare 直连 | 可逆，需改 DNS |
| 仓库内容/历史需要回到某个状态 | 场景 D：Git 层面恢复 | 视情况（见文末影响面） |
| 误把 Vercel 项目连到仓库导致反代失效 | 场景 E：断开 Vercel 的 Git 集成 | 完全可逆 |
| 想彻底停用线上服务 | 场景 F：下线 | 可逆（保留部署记录） |

---

## 1. 场景 A：Worker 版本回滚（最常用）

**何时用**：`npm run build` + `wrangler deploy` 之后发现线上渲染/接口异常，想立刻退回上一版。

**影响面**：只影响 Worker 指向的版本（即 `rack.means.group` 与 `workers.dev` 上游内容），不涉及 DNS、不涉及仓库。

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
# 必设：该登录态下有多个 Cloudflare 账号，wrangler 在非交互模式必须指定账号
$env:CLOUDFLARE_ACCOUNT_ID='<你的账号 id>'
Set-Location F:\Autoclaw\alu_extrusion

# 1) 看部署历史（输出含 Created / Author / Source / Message）
npx wrangler deployments list

# 2) 看版本列表，拿到 Version ID
npx wrangler versions list

# 3) 回滚（wrangler 4.x 实测语法：位置参数就是 Version ID）
npx wrangler rollback <version-id> --name modulo-alu-shelf -m "rollback: 回退到上一版"
```

> 实测环境：wrangler 4.114.0。该版本 `rollback` 的位置参数是 **Version ID**（不是 deployment id），
> 也不接受 `--version-id` 参数；`--name` 指定 Worker 名，`-m` 写回滚原因（会记入部署历史）。

**验证**：

```powershell
# 线上内容应与目标版本一致
curl.exe -sS --max-time 30 -o online.html https://rack.means.group/
# 单文件构建可直接比哈希：与当时的 dist/index.html 对比 SHA256
```

**补充**：`wrangler rollback` 只改「当前生效版本」指针，历史版本都还在，可反复来回切。

**常见报错**：`More than one account available but unable to select one in non-interactive mode`
→ 忘记设 `CLOUDFLARE_ACCOUNT_ID`；带上该环境变量即可。

---

## 2. 场景 B：KV 价格表恢复

**何时用**：改了 `tools/price_table.json` 并推送到 KV 之后发现价格不对。

**影响面**：只影响 `/api/market` 返回的报价数据；页面结构与几何不受影响。回滚通常 5 分钟内生效。

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'

# 0) 先备份当前值（万一还要再切回来）
npx wrangler kv key get --binding=MARKET_KV price_table --remote > price_table.backup.json

# 1) 用仓库里已知正确的版本写回
npx wrangler kv key put --binding=MARKET_KV price_table --path tools/price_table.json --remote
```

**验证**：

```powershell
curl.exe -sS --max-time 30 https://rack.means.group/api/market
# 检查 updated 字段与 rules 条数与预期一致
```

**注意**：KV 本身没有版本历史，所以**唯一可靠的备份就是仓库里的 `tools/price_table.json` 与你手动导出的 backup 文件**。
改价前建议先把当前值导出一次。

---

## 3. 场景 C：反代回退到 Cloudflare 直连

**何时用**：Vercel 侧异常（账号问题、配额、误删项目），需要让 `rack.means.group` 重新由 Cloudflare 提供。

**影响面**：需要改 DNS 与 Worker 自定义域；中国大陆用户会重新变成「需代理访问」。

**步骤**：

1. **Cloudflare DNS**：删除 `rack` 的 CNAME（指向 `cname.vercel-dns.com`）。
2. **恢复 Worker 自定义域**：在 `wrangler.local.toml` 里取消 `routes` 段注释，然后部署：

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
Set-Location F:\Autoclaw\alu_extrusion
npx wrangler deploy --config wrangler.local.toml
```

3. **确认自定义域生效**：Cloudflare 会为该 Worker 重新创建受管的占位记录（`AAAA → 100::`，proxied）。
   如控制台未自动出现，在该 Worker 的 Settings → Domains & Routes 手动添加。
4. **Vercel 侧清理**：`npx vercel@latest domains rm rack.means.group`（在反代项目目录执行）。

**验证**：

```powershell
curl.exe -sS --max-time 30 -D - -o NUL https://rack.means.group/   # 期望 Server: cloudflare / cf-ray
# 若在国内直连，这一步会超时（属预期：已回到被墙的 Cloudflare 免费 IP 段）
```

**反向操作**（回到 Vercel 反代）：见 [`vercel-reverse-proxy.md`](./vercel-reverse-proxy.md) 的部署章节。

---

## 4. 场景 D：仓库内容与历史恢复

**何时用**：误提交、误删文件、需要退回某个已知良好状态。

```powershell
Set-Location F:\Autoclaw\alu_extrusion

# 1) 只看不改：确认远端当前状态
git fetch origin
git log --oneline -10 origin/main

# 2) 单个文件回到某个提交的版本
git checkout <commit-sha> -- <path/to/file>

# 3) 整体回退（保留历史）
git revert <bad-commit-sha>
git push origin main

# 4) 需要强制回到某个远端状态（会丢弃本地历史，谨慎）
git fetch origin
git reset --hard origin/main
```

**影响面与不可逆点**：

- `git revert` 是**安全**做法：产生一个新的反向提交，历史保留。
- `git reset --hard` 会丢弃本地未提交改动，且若随后 `git push --force` 会改写远端历史。
- 本仓库在 2026-09-16 做过一次**历史重写**（清除已发布的运维文档与标识符）：
  重写前的提交 `399b873` 在 GitHub 上可能短期仍可通过 SHA 访问；本地该历史对象已清理，
  `git reflog` 也已过期，**无法从本地恢复**。如需取回旧内容，只能从 GitHub 侧取。
  若要彻底清除旧对象，唯一可靠办法是删除并重建仓库（不可逆，需要你明确确认）。

---

## 5. 场景 E：误把 Vercel 项目连到仓库

**症状**：`rack.means.group` 返回的是仓库源码构建结果，或 404、或与配置器无关的页面。

**原因**：反代项目 `proxy-rack` 一旦绑定 Git 仓库，Vercel 会改为「构建并部署仓库」，把纯 rewrite 规则覆盖掉。

**处置**：

1. Vercel 控制台 → 项目 `proxy-rack` → Settings → Git → 断开连接（Disconnect）。
2. 确认项目仍然只有一个 `vercel.json`（纯 rewrite），重新部署：

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY='http://127.0.0.1:7897'
Set-Location <反代项目目录>
npx vercel@latest deploy --prod --yes
```

**验证**：`curl.exe -sS -D - -o NUL https://rack.means.group/` 应返回 `Server: Vercel`。

---

## 6. 场景 F：下线服务

```powershell
# 1) 移除反代域名，站点不再对外提供
npx vercel@latest domains rm rack.means.group
# 2) （可选）删除 Worker 脚本
npx wrangler delete --name modulo-alu-shelf
```

**保留**：仓库源码、`wrangler.toml` / `wrangler.local.toml`、KV 中价格表。
**恢复**：按 [`deployment.md`](./deployment.md) 重新部署，并重新绑定域名即可。

---

## 7. 回滚后的统一验证清单

| 检查 | 命令 | 期望 |
|---|---|---|
| 站点可达 | `curl.exe -sS -o NUL -w "%{http_code}" https://rack.means.group/` | `200` |
| 服务身份 | 同上加 `-D -` | 反代模式 `Server: Vercel`；直连模式 `cf-ray` |
| 内容一致 | 与本地 `dist/index.html` 比 SHA256 | 一致 |
| 价格接口 | `curl.exe -sS https://rack.means.group/api/market` | JSON，`rules` 条数符合预期 |
| 单元测试 | `npm test` | 50 pass / 0 fail |
| 浏览器自检 | `node tools/qa-browser.mjs` | 五产品正常、console 零错误 |

---

## 8. 台账与交接

- 每一次部署、回滚、DNS/域名变更都应记入**本地**运维台账 `DEPLOYMENTS.md`（不随仓库发布），
  至少包含：时间、动作、对象、版本/部署 id、结果、验证方式。
- 公开仓库只保留本文件与 [`deployment.md`](./deployment.md) 这类**通用**步骤，
  不含具体账号标识符与部署流水。
