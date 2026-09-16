# 第一性原理对抗性审查 · MODULO 铝型材置物架配置器

> 注：文中提到的 `DEPLOYMENTS.md` / `TOOLS.md` 是本地运维文档，**未随本仓库发布**；
> 公开侧的部署说明见 [`../docs/deployment.md`](../docs/deployment.md)。

> 审查人：paw-site-building · 2026-09-05
> 范围：`F:\Autoclaw\alu_extrusion` 全部前端源码 + 部署配置 + DEPLOYMENTS.md
> 方法：不问"代码写得对不对"，先问"这个东西存在的理由是否成立，以及它在哪个环节会骗人"。

---

## 0. 一句话结论

**这是一个渲染工程质量很高、但工程可信度和商业闭环都不达标的演示品。**
它最值钱的功能是算料单（用户愿意为"能直接下单切料"付钱），而算料单恰恰是
全项目最弱、最经不起对抗的一环。3D 部分过度投资，可信度部分投资不足——
资源分配与产品的第一性原理（帮用户把架子买对、装起来）是倒挂的。

---

## 1. 第一性原理拆解

置物架配置器的本质是：**用可视化消除购买不确定性，用算料单消除履约不确定性。**

由此推出三条不可妥协的公理：

1. **结构必须站得住** —— 用户买架子就是为了承重。承重不行，一切归零。
2. **算料必须切得出** —— 算料单一旦导致错切，就是真金白银的赔偿与信任清零。
3. **用户必须到得了** —— 页面打不开，转化率是零，不是"略低"。

用这三条去量，三个维度全部失守（见 §2/§3/§6）。

---

## 2. 致命级：结构可信度是空白（公理 1 失守）

- **全项目没有任何结构计算。** 跨宽上限 1.2 m（`LIMITS.bayWidth`），2040 型材
  在 1.2 m 跨距、满载下的挠度是否超标？没有人算过。页面只写"承重为演示示例"
  免责——但对置物架来说，**承重就是产品本身**，免责文案不能替代工程答案。
- **悬挑 60 mm + 托架是拍脑袋结构。** 层板条前端悬挑超出立柱线，靠两片钣金
  托架（BoxGeometry 摆出来的视觉件）承担。力臂、螺栓剪切、托架厚度均无依据。
  如果真实产品没有这个五金件，3D 就是在展示一个不存在的东西。
- **悬挑托架只支撑 rib 层板**（`bracketTops` 只收 rib 层），亚克力整板前端悬空
  无支撑。同一产品两种层板两种结构逻辑，装配说明却没区分——安装步骤第 4 步
  还在写"钢化玻璃"，而配置里的选项早已改成"磨砂亚克力"（`product.js` 的
  `INSTALL_STEPS` 与 `DECK_TYPES` 已漂移）。
- **自重计算的双源问题**：`profiles.js` 用 Shape 参数化生成截面，而截面积
  （`PROFILE_SERIES.area`、`DECK_STRIP.area`）是硬编码常数。改 w/h 不改 area，
  自重和算料静默出错，无任何断言能拦住。

## 3. 致命级：算料单的"精度幻觉"（公理 2 失守）

算料单底部印着 **"下料公差 ±0.5mm"**，但实际切割长度是名义尺寸：

- 背横梁/前支撑梁直接用 `bayWidths[b]` 全长下料，**未减立柱占宽与角件间隙**。
  真实装配中梁必须短于净跨（2040 角件还要吃深度）。系统性偏长 ≈ 每根都切错。
- 侧横梁 `sideLen = 2*zPost - 0.02` 的 20 mm 余量无出处。
- `cutList` 里 section 字符串硬编码 `'2040'`、立柱写死 `'20×20'`——选 2020
  系列时规格列仍然是错值。
- **价格与算料是两套独立公式**（`store.js calcPrice` vs `buildShelf` 统计），
  价格不按材料量推导，改配置时二者必然漂移，用户拿着算料单核不出报价。
- 导出是 SpreadsheetML 却给 `.xls` 后缀，现代 Excel 会弹"格式与扩展名不匹配"
  警告——对 toB 用户这是第一眼信任损耗。要么改名 `.xml`，要么上真 xlsx。

**对抗性结论：这份算料单目前只能当"数量参考"，不能下料。readme 应该明说，
否则就是在用 ±0.5mm 的字样给错误数据背书。**

## 4. 架构误判：项目没有"后端"

按前端/后端两部分审阅的前提是错的。实际架构是：

- **前端**：纯静态 SPA，构建为单文件 `dist/index.html`（~590 KB 全内联）。
- **"后端"**：不存在。Cloudflare Workers 只是静态资产托管（wrangler.toml
  `[assets]`），Vercel 是纯 rewrite 反代。无 API、无数据库、无服务端逻辑。

由此暴露的真实缺口（这些才是"后端"该干的事）：

- **配置不可分享**：状态只在内存，URL hash 只有 `#rod`。配置器没有 permalink，
  等于砍掉了"把配置发给客服/同事"这条最高转化路径。
- **无持久化**：刷新即丢失，`localStorage` 都没用。
- **无线索收集**：导出算料单是本地行为，商家拿不到任何 lead。花这么大力气
  做的获客工具，漏斗底部是漏的。
- `window.__ALU_LABELS` 全局注入是绕循环依赖的 hack，两个产品的配置体系
  （product.js / rodrack.js）已经开始复制粘贴分叉，再加第三个产品会失控。

## 5. 代码层对抗性发现（按严重度排序）

| # | 位置 | 问题 |
|---|---|---|
| 1 | `buildShelf` cutList | 下料长度不减节点占位，系统性偏长（§3） |
| 2 | `product.js` INSTALL_STEPS | "钢化玻璃"与实际"磨砂亚克力"选项漂移，安装说明误导 |
| 3 | `cutlist.js` | `.xls` 后缀 + XML 内容，Excel 弹格式警告 |
| 4 | `main.js` | 单个 `rebuildTimer` 被 store/rodStore 两个订阅共用，快速切产品时互相取消重建（时序竞态，低频但真实） |
| 5 | `buildShelf` 摆件 seed | seed 只含 bays/levels，不含 bayWidths/decks——改跨宽后摆件布局不更新，注释"同配置同布局"不成立 |
| 6 | `buildShelf(cfg, props)` | 参数 `props` 与 `cfg.props` 同名不同义，`buildShelf(cfg, cfg.props)` 调用是混淆源 |
| 7 | `store.set` | `JSON.stringify` 深比较在数组顺序敏感时 OK，但 patch 传 undefined 字段会被 normalize 静默吞掉，无警告 |
| 8 | readme「如何扩展」 | "加 4040 只需一行"是谎言：`buildShelf` 里 `postProf` 写死 2020、cutList section 写死 '2040'、托架/螺栓尺寸全是 2040 假设。文档与代码脱节比没有文档更糟 |
| 9 | `main.js` loader | 700ms 强制 hide + 8s 超时提示两套机制并行，慢设备上 loading 没到一帧渲染就被隐藏，`__ALU_READY` 前的白屏无反馈 |
| 10 | 全局 | **零测试**。package.json 无 test 脚本，QA 靠手工截图对齐参考图和 `#rod/side` hash。几何/算料/报价三个纯函数（buildShelf、calcPrice、buildCutlistWorkbook）都是理想的单测对象，一个都没测 |

## 6. 商业与分发：主要市场打不开（公理 3 失守）

DEPLOYMENTS.md 本身就是一份对抗性证据：

- 4 个 workers.dev 临时子域被 SNI 级逐批阻断；`rack.means.group`（Cloudflare）
  国内直连被墙。**一个中文 UI、兼容 WPS、显然面向国内用户的产品，在国内没有
  稳定入口。** 已验证可行的 Vercel 反代方案（p.means.group）只给了 portfolio，
  没有给 rack 做。这是当前 ROI 最高的一件事，优先级高于任何渲染改进。
- DEPLOYMENTS.md 里记录了多个 claimToken 和一次"用户提供的 CF API token"
  的使用——即使已失效/建议撤销，把凭据写进项目文档的习惯本身就是风险。
  `wrangler.toml` 的 account_id 同理。
- 发布无版本管理：dist 是手 build 手 deploy，DEPLOYMENTS.md 手工记账，
  无 git tag / release / CI。文档说"572.0 kB""597,479 字节"全靠人肉核对，
  必然漂移。

## 7. 反方自检（对抗我自己的审查）

- "这只是演示/landing page，不需要结构计算" —— 反驳：算料单印着 ±0.5mm
  和"按算料单核对型材数量"，已经在诱导用户拿它下料。要么砍了算料单，
  要么把精度做实，中间态最危险。
- "InstancedMesh 性能好、draw call ≤12 是优点" —— 认可，渲染工程质量确实
  高（几何共享、降级分支、REDUCED motion、确定性 seed 都是好实践）。
  但这恰恰证明问题不在能力，在优先级。
- "无后端是有意的零依赖设计" —— 认可其部署简洁性，但 permalink 和
  localStorage 不需要后端，是纯前端就能补的课。

## 8. 行动建议（按 ROI 排序）

1. **[分发] 给 rack 做 Vercel 反代国内入口**（复用 proxy-t2 方案，半天）。
2. **[算料] 修正下料长度模型**：净跨 = 跨宽 − 柱宽 − 角件间隙；每个连接
   类型定义下料修正量；cutList 加"净跨/修正/下料长"三列可追溯。去掉
   ±0.5mm 字样直到模型成立。
3. **[结构] 至少给 2040 @ 1.2m 跨做一次挠度/均布载荷核算**，把结果写进
   LIMITS 的注释里；安装说明与 DECK_TYPES 对齐。
4. **[闭环] 配置序列化进 URL hash**（permalink）+ localStorage 恢复。
5. **[工程] 给 buildShelf / calcPrice / buildCutlistWorkbook 补单测**
   （纯函数，vitest 一天内见效）；价格改为从 cutList 材料量推导。
6. **[ hygiene] ** readme 扩展指南改成与代码一致的实话；`.xls` → 真 xlsx
   或 `.xml`；DEPLOYMENTS.md 里的凭据段落清理。
