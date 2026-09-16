# 后端与部署链路对抗性审查报告 · 第一性原理

> 审查对象：`worker.js`（27 行）、`wrangler.toml` / `wrangler.local.toml`（本地）、`.github/workflows/deploy.yml`、`tools/make-ci-config.mjs`、Vercel 反代层、`/api/market` KV 价格表链路、`tools/` 运维脚本
> 审查日期：2026-09-16 ｜ 立场：对抗性——假设每一层都会在最坏时刻失效，问"这条链路的**最少必要部件**是什么"。
> 注：本项目"后端"极小：一个 Worker + 一条 KV 读 + 两层托管。因此本报告的大部分篇幅在**部署链路与运维纪律**上——那才是这个系统真实的后端复杂度所在。

---

## 0. 第一性原理框架

把这套"后端"还原到公理：

1. **请求路径上的每个部件都必须有不可替代的职责**。可被静态文件、可被浏览器、可被删除的部件，就是故障面。
2. **数据的权威来源（source of truth）必须恰好一个**。价格表、部署配置、文档记录，各有一个且仅有一个权威副本。
3. **恢复能力 = 已演练的回滚 × 已验证的备份**。没演练过的回滚手册是文学不是工程。
4. **密钥的生命周期（生成→使用→轮换→撤销）必须闭环**。明文出现过一次的 token，没有"建议撤销"，只有"已撤销"和"已泄漏"。

---

## 1. worker.js：27 行里的四个真实缺陷

### 1.1 静态资产兜底逻辑与注释不符

文件头注释写"assets 优先，未命中的 /api/* 由本脚本处理"，但代码是：

```js
if (url.pathname === '/api/market') { ... }
return new Response('Not found', { status: 404 });
```

**任何非 /api/market 的请求都返回 404**——包括 `/api/health`、包括未来的任何 API。它能工作只是因为 Workers 静态资产绑定在 worker 之前先匹配了 assets。也就是说：worker 的兜底语义依赖部署平台的隐含行为，而不是代码自己表达的契约。`wrangler.toml` 里 `[assets]` 没有 `not_found_handling`，SPA 风格的 404 回退也没有（本项目恰好不需要，但注释把读者引向错误的心智模型）。

### 1.2 无缓存层，每次价格读取都打 KV

`/api/market` 响应设了 `cache-control: public, max-age=300`，但：

- KV `get` 每次请求都发生（边缘没有 `caches.default` 或 Cache API 包裹）；
- 价格表更新频率是**人工月度级**，读频率是每次页面加载——读写比悬殊到应该把表直接烘焙进构建、KV 仅作热更新通道；
- Vercel 反代层是纯 rewrite（无缓存配置实测证据），`max-age=300` 只作用于浏览器。CDN 边缘缓存白白浪费。

**第一性判断**：要么加 Cache API（5 行），要么承认"KV 热更新"是伪需求——价格表改一次要人工核验，那就直接走 `npm run build && deploy`，把 KV 整个删掉。现在的形态是**为了一个不存在的运营频率付出的永久运行时复杂度**。

### 1.3 错误信息回传内部细节

```js
catch (err) { return Response.json({ error: String(err) }, { status: 500 }); }
```

`String(err)` 会把 KV 内部错误、绑定名、栈信息片段直接吐给公网。27 行的小 worker 出泄露概率低，但这是模式问题：**对外 API 的错误体应该是枚举，不是异常字符串**。同样，`MARKET_KV not bound`（503）把内部绑定名告诉了任何人。

### 1.4 无方法限制、无 OPTIONS、无版本

- `POST /api/market` 也返回价格表（没有 method 检查）。读接口无害，但契约不干净。
- 响应无 `ETag`/`Last-Modified`，浏览器 300 秒内重复加载页面重复传输同一 JSON（表约数 KB，量小，但免费午餐没吃）。
- 无版本字段校验：`mergeMarket`（marketRemote.js）对远端 JSON 的结构零校验——**KV 里写错一个字段类型，前端合并出的报价就静默错误**，且错误显示为"示例估价"无法与"表坏了"区分。

---

## 2. 部署链路：三层结构是真实需求，但每层都有未闭环

### 2.1 链路本身（先肯定）

```
浏览器 → rack.means.group（Vercel 边缘 sin1，纯 rewrite）
       → <worker>.<account>.workers.dev（CF Worker：assets + /api/market）
```

DEPLOYMENTS.md 用大量实测证明：workers.dev 被 SNI 阻断、CF 自定义域被墙、Vercel 自定义域国内直连可达。三层是**网络现实的必然解**，不是过度设计。回滚手册（docs/rollback.md 六场景）和「推送不部署」的查证（11:20 章节四条检查项）是这套运维里最专业的部分。

### 2.2 单点 1：workers.dev 子域是整条链路的咽喉

反代上游 = `<worker>.<account>.workers.dev`。已有实测记录：**workers.dev 随机子域被分批 SNI 阻断**（toothsome-haircut / season-goldenrod / chiseled-hourglass / dour-waltz 四个全灭）。当前这个子域活着，但它与被灭的四个是同一性质——**被墙是时间问题不是概率问题**。它一断，rack.means.group 整站 502。

第一性追问：上游为什么必须是 workers.dev？答案本应是"CF 自定义域"，但 rack.means.group 的自定义域绑定已经为了腾给 Vercel 而删除。**没有备用上游**：没有第二个自定义域（如 origin-rack.means.group 灰云直连 CF）作 Vercel rewrite 的备胎。回滚手册的"回到 CF 直连"需要改 DNS + 重新绑定自定义域——**演练过吗？** 手册写于 11:20，全程无演练记录。

### 2.3 单点 2：CI 的命门是一个尚未写入的 Secret

当前状态（DEPLOYMENTS.md 12:40/12:45 章节自述）：

- `CLOUDFLARE_ACCOUNT_ID`、`MARKET_KV_NAMESPACE_ID` 已写入 GitHub Secrets；
- **`CLOUDFLARE_API_TOKEN` 未写入**（连接器无权限、OAuth token 过期、浏览器面板不可用，三条自动路径都排除）——所以现在 `git push` 触发的 Actions 每次 success 但**实际零部署**（守卫分支）。

这不是待办，是**系统当前对外宣称的能力（readme：推送 main 自动部署）与实际状态（永不部署）不符**。更微妙的风险：哪天用户把 token 写进去，第一个 push 就会**无人工确认地直接上线**——没有 staging、没有灰度、deploy.yml 里也没有部署后校验步骤（回读线上 SHA256 与本地 dist 对比这一步目前只在人工流程里有）。

**建议**：deploy.yml 补一步 `部署后自检`（curl 线上 → SHA256 对比 dist/index.html → 不一致即告警）。成本 10 行，堵住"CI 静默发布坏包"的最后缺口。

### 2.4 wrangler.toml 双文件漂移

`wrangler.toml`（公开，占位符）与 `wrangler.local.toml`（本地，真值）靠注释互相提醒"必须同步"。CI 又生成了第三份 `wrangler.ci.toml`。三份配置描述同一个 Worker——违反公理 2。make-ci-config.mjs 已经演示了正确方向（从一份生成另一份），**本地侧应该同样用生成而非手工维护**（`make-local-config.mjs` 从一份私密 env 文件生成 local.toml），或者干脆 wrangler 支持的环境变量化（`account_id` 已走 env，KV id 也可以）。

### 2.5 wrangler-action@v3 与 wranglerVersion 4 钉死

`wranglerVersion: '4'` 是主版本钉，不是次版本钉。Wrangler 4.x 历史上多次在 minor 版本改 deploy 行为（assets 绑定就是 3.x→4.x 的大改）。CI 环境每次装最新 4.x——**部署链路的可复现性低于本地**（本地 node_modules 有 lock）。建议钉到精确版本。

---

## 3. 安全与凭据：一个未闭环的泄漏 + 遗留的标识符

### 3.1 CF API token（DNS 权限）：状态是「建议撤销（未确认）」

STATUS.md 待办原文：

> CF API token（DNS 权限）曾出现在对话明文，建议已撤销（未确认）

按公理 4：**没有"建议已撤销"，只有"已撤销"和"已泄漏"**。一个 DNS 权限 token 明文出现在对话里 = 已进入第三方日志系统 = 必须当作泄漏处理。它是本报告里唯一一条"现在就该停下手去做"的事。**立刻在 CF 控制台撤销并轮换**，然后划掉这条待办。对抗性地说：这条在 STATUS.md 里挂了至少一轮迭代没被处理，说明"安全待办"在这个项目的优先级队列里事实上垫底。

### 3.2 基础设施标识符的"半脱敏"

公开仓库用 `<CF_ACCOUNT_ID>` 占位，但 DEPLOYMENTS.md 404-408 行把真实值明文留在本地文件里——这本身合理（本地运维台账），**然而本文件（DEPLOYMENTS.md）曾经入库并被强推历史两次**。历史已重建（对象不可达），GitHub 侧缓存/PR/fork 是否彻底无残留**无验证记录**。account id / KV id 本身不是凭据（无 token 不可用），风险低，但"重建历史就干净了"是一个**未经验证的假设**，和 3.1 是同一种思维模式：把安全动作降级为文字记录。

### 3.3 前端错误上报通道预留

index.html:59 注释里留着 `sendBeacon('/log/error')` 的预留代码。无后端接收端，无害；但同上——这是"为未来功能预留的代码"，违反公理 1，该删。

---

## 4. 数据链路：价格表的治理缺口

### 4.1 KV 价格表：单一权威源，但无审计、无备份、无校验

- **无备份**：`tools/price_table.json` 是初始导出，此后每次 `wrangler kv key put` 直接覆盖线上 KV。改错了没有历史版本（KV 无版本管理）。第一性做法：price_table.json 每次改价提交 git（它已经在仓库里），让 git 当审计日志——**现在改价流程不经过仓库，权威源事实上从 git 漂到了 KV**。
- **无 schema 校验**：worker 原样透传 KV 内容；前端 `mergeMarket` 盲合。一个手滑的 JSON（比如 price 写成字符串）会让全站报价静默错误。worker.js 加 10 行结构检查（rules 是数组、price 是 number）就能挡住。
- **updated 字段靠人写**：`market.js` 的 `updated: '2026-09-05'` 是手维护字符串，KV 侧亦然。没有机制保证它真的对应内容哈希。

### 4.2 价格语义：演示免责与商业诱导之间的一线之隔

页面标注"未核验示例单价"（诚实，值得肯定），但报价区块同时提供淘宝/1688 直达链接、导出带价格的算料单、toast 里显示 ¥ 金额。**用户心智里这就是报价**。后端（价格表治理）与前端（免责声明）之间存在责任真空：没有一个"价格表数据契约"文档说明这些数字的法律性质。这与工程无关，但第一性上，**一个会导出带价格单据的系统，其价格数据的治理级别应与报价单同级**——当前是博客级。

### 4.3 已知的死代码与漂移

- `functions/api/market.js`（Pages Functions 写法）已被 worker.js 取代，STATUS.md 自己标注"可归档"——仍在仓库里（已确认存在于公开仓库历史；本地已归档与否需核实，若还在就是该删的僵尸）。
- `marketRemote.js:6` 注释仍写 "Pages Functions: KV binding"——实现早已是 Worker。注释与实现漂移正是文档腐烂的第一步。
- `tools/export-price.mjs` 从内置 MARKET 导出 JSON 写 KV——方向反了才符合公理 2：应该是 price_table.json 是源、MARKET 由它生成（构建期），或两者同一来源。现在是两份手写同步的数据。

---

## 5. 运维体系：文档化的胜利与它的隐性成本

### 5.1 值得明确肯定的（对抗性审查也应记录强项）

- 部署台账（DEPLOYMENTS.md 572 行）按时间线记录每次部署的版本 ID、验证哈希、失败原因——**这是绝大多数生产系统都没有的**。
- 验证文化：每次部署后有 SHA256 一致性核对、有基线数字（20.1kg/45件/9.81m）、有 `npm test` 50/50 的回归门槛。
- 回滚手册六场景、踩坑记录（Vercel SSO、CF 占位 AAAA、workers.dev 阻断规律）——把隐性知识全部显性化了。
- 敏感信息处理：claimToken 脱敏、历史重建、`.gitignore` 凭据覆盖、本地/公开文档分层。

### 5.2 但第一性追问：这套体系的运转成本

- **五份事实文档**（readme / AGENTS / STATUS / DEPLOYMENTS / docs/deployment.md）之间已经出现过基线数字过期（STATUS.md 自己承认"本页旧基线数字多处过期"）。文档越多，同步面越大。STATUS 与 DEPLOYMENTS 的边界（一个记状态一个记流水）在实际书写中已经互相渗透。
- 部署依赖**单台 Windows 机器 + 本机代理（7897 端口）+ 本机凭据**——机器不在，整条链路停摆。CI（Actions）本是解药，但 token 未写入（2.3），所以目前实质是「CI 外壳 + 人肉内核」。
- `.openclaw/tmp` 221 MB 过程文件等待用户确认清理——本地工作区的卫生同样是恢复能力的一部分（备份、迁移、磁盘）。

---

## 6. 优先级建议

| P | 事项 | 工作量 | 理由 |
|---|---|---|---|
| **P0** | **撤销并轮换曾明文出现的 CF DNS token**，划掉待办并记录撤销时间 | 10 分钟 | 唯一未闭环的真实泄漏（3.1） |
| P0 | GitHub Secrets 写入 `CLOUDFLARE_API_TOKEN`，并在 deploy.yml 加部署后 SHA256 自检 | 30 分钟 | 消除 readme 宣称与现实的差距 + 堵住 CI 静默发坏包（2.3） |
| P1 | worker.js：method 检查 + 错误体枚举化 + 价格表 schema 校验（rules/price 类型） | 1 小时 | 公网 API 契约卫生（1.3/4.1） |
| P1 | 价格表权威源收敛：改价必须改 `tools/price_table.json` 并提交 git，再 kv put | 流程决定 | git 当审计日志，消灭 KV 漂移（4.1） |
| P1 | workers.dev 上游备胎：给 Worker 绑一个灰云自定义域作 Vercel rewrite 的备选，并**实际演练一次**回滚手册场景 3 | 半天 | 唯一的咽喉单点（2.2）；公理 3：没演练的回滚不是回滚 |
| P2 | `/api/market` 加 Cache API 或 ETag；或论证后删除 KV 改走构建期烘焙 | 2 小时 | 读写比悬殊（1.2） |
| P2 | wrangler.local.toml 改为生成物；wrangler-action 钉精确版本 | 1 小时 | 三份配置的漂移面（2.4/2.5） |
| P3 | 删 `functions/api/market.js` 僵尸、修 `marketRemote.js` 过期注释、删 index.html sendBeacon 预留 | 半小时 | 死代码与文档腐烂（4.3/3.3） |
| P3 | worker 错误响应去掉内部绑定名；价格数据契约写一句话进 readme | 半小时 | 信息暴露与责任真空（1.3/4.2） |

---

## 7. 总体判断

这套"后端"的技术本体（27 行 worker + 一条 KV 读）简单到几乎没有犯错的余地——**真正的后端复杂度全部转移到了部署拓扑与运维纪律上**，而项目对后者的处理（台账、回滚手册、验证哈希、脱敏分层）达到了超出规模的专业水准。

剩余的风险集中在三个"未闭环"：

1. **凭据闭环**：明文 token 的撤销停留在"建议"而非"已执行"（3.1）；
2. **能力闭环**：CI 宣称的推送即部署缺最后一个 Secret，且缺少部署后自检（2.3）；
3. **回滚闭环**：六场景手册无任何一次真实演练记录，而上游 workers.dev 的存活依赖运气（2.2）。

三个闭环的共同处方很便宜：**各花半小时到半天，把"写过"变成"做过"**。

---

## 修复闭环记录（2026-09-16）

### 已修复（代码层，本会话内完成并验证）

| 报告条目 | 状态 | 验证 |
|---|---|---|
| **§4.1 价格表 RegExp 序列化线上 bug**（报告低估为 P1「schema 校验」，实为线上崩溃） | ✅ 根治 | `tools/price_table.json` 的 `match` 从 `{}` 改为正则源码字符串；`export-price.mjs` 加序列化+自检；`marketRemote.js` 加清洗层；`marketPrice.js` 加 `safeTest` 容错。复现脚本修复前 `TypeError: r.match.test is not a function`，修复后 `报价正常 ¥70` |
| §1.3/§4.2 worker 错误体枚举化 + 去内部绑定名 | ✅ | `worker.js` 重写：`ERR` 枚举、不回传 `String(err)`/绑定名 |
| §1.4 method 检查 + ETag/协商缓存 | ✅ | 非 GET/HEAD → 405；If-None-Match → 304 |
| §1.2 `/api/market` 无缓存 | ✅ | Cache API 边缘缓存 + SHA-256 ETag；单测验证二次请求不读 KV |
| §4.1 价格表 schema 校验 | ✅ | worker 边缘校验 match 可编译 + price 有限非负，坏表 → 502 不回传 |
| §4.1 价格表权威源收敛 | ✅ | `readme.md` 写明 `price_table.json` 为唯一权威源 + git 审计 + 数据契约 |
| §2.3 deploy.yml 部署后自检 | ✅ | 加「部署后 SHA256 自检」步骤（cache-busting + 5 次重试），钉 wrangler `4.132.0` |
| §2.4 wrangler.local.toml 生成物化 | ✅ | 新增 `tools/make-local-config.mjs`（防误覆盖守卫，现有文件 exit 2 不覆盖） |
| §4.3 删 functions/api/market.js 僵尸 | ✅ | 归档到 `.openclaw/tmp/attic-20260916/`，确认零引用 |
| §3.3 删 index.html sendBeacon 死预留 | ✅ | 移除 |

新增测试：`test/worker.test.mjs`（11 条，覆盖 method/错误枚举/schema/缓存/304）、`test/price-table.test.mjs`（4 条，锁死 RegExp 序列化 bug）。全量 **69/69** 通过，构建 721KB。

**前端已自愈验证**：即使线上 KV 仍是坏表（`match:{}`），`marketRemote.js` 清洗层会丢弃坏 rules 回退内置真 RegExp，`calcMarketPrice` 不再抛 `TypeError`（实测 total=¥70、complete=true）。即：**在用户更新 KV 之前，线上也不会再崩**——两层防御（前端清洗 + 引擎 safeTest）任一即可兜底。

### 仍需你操作（需云端凭据/账号权限，我无法代做）

| 报告条目 | 为什么我做不了 | 你需要做 |
|---|---|---|
| **§3.1 撤销明文 CF DNS token**（P0，唯一真实泄漏） | 连接器无 token 管理权限（`GET /user/tokens` 返回 9109 Unauthorized） | 到 https://dash.cloudflare.com/profile/api-tokens 撤销并轮换，然后在 DEPLOYMENTS.md 划掉该待办 |
| **§2.3 写入 CLOUDFLARE_API_TOKEN Secret**（P0） | 只有你能生成该 token（权限：Workers Scripts Edit + KV Edit） | 生成后 `gh secret set CLOUDFLARE_API_TOKEN --repo zhoushimiaov/alu-extrusion`；写入后 push 即真实部署（自检步骤会兜底） |
| **§2.2 workers.dev 上游备胎 + 演练回滚** | 需 CF DNS/Vercel 域名操作 + 真实流量验证 | 给 Worker 绑一个灰云自定义域作 Vercel rewrite 备选，并实际跑一遍 rollback.md 场景 3 |
| **§1.2 上线后清理 KV 坏数据** | 需 `wrangler kv key put --remote` | 用修好的 `tools/price_table.json` 重新写入 KV：`wrangler kv key put --binding=MARKET_KV price_table --path tools/price_table.json --remote`（否则线上仍是坏表，虽然前端已能回退内置表兜底） |
