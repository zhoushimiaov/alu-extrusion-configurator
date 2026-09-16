from pathlib import Path
P=Path(__file__).resolve().parents[1]
def edit(f,a,b):
 p=P/f;s=p.read_text(encoding='utf-8');assert a in s,(f,a[:60]);p.write_text(s.replace(a,b),encoding='utf-8')
edit('src/ui/marketPrice.js',"return MARKET.rules.find(r => r.match.test(c.section) || r.match.test(c.spec)) || null;","return MARKET.rules.find(r => r.match.test(c.section)) || null;")
edit('src/ui/marketPrice.js','const lines = [];','const lines = [];\n  const unpriced = [];')
edit('src/ui/marketPrice.js','if (!rule) continue;',"if (!rule) { unpriced.push(c.spec); continue; }")
# second loop needs h, not c
edit('src/ui/marketPrice.js',"const rule = matchHwRule(h.name);\n    if (!rule) { unpriced.push(c.spec); continue; }","const rule = matchHwRule(h.name);\n    if (!rule) { unpriced.push(h.name); continue; }")
edit('src/ui/marketPrice.js','const qtyM = +(c.len * c.qty).toFixed(2);','const qtyM = c.len * c.qty;')
edit('src/ui/marketPrice.js','    total: Math.round(material + hardware + panes),','    complete: unpriced.length === 0, unpriced,\n    total: Math.round(material + hardware + panes),')
edit('src/ui/persist.js',"return cfgFromHash() || cfgFromStorage(kind);","const activeKind = /^#rod/.test(location.hash) ? 'rod' : 'profile';\n  return (kind === activeKind ? cfgFromHash() : null) || cfgFromStorage(kind);")
edit('src/ui/persist.js',"  const base = location.hash.replace", "  if (kind !== (/^#rod/.test(location.hash) ? 'rod' : 'profile')) return;\n  const base = location.hash.replace")
edit('src/config/market.js',"source: '淘宝 / 1688 搜索参考价'","source: '未核验示例单价（淘宝 / 1688 仅为搜索入口）'")
edit('src/config/market.js','// 市场价格基础表：淘宝 / 1688 搜索参考价（零售含切割的常见成交区间中值）','// 示例价格表：以下单价、区间未经卖家SKU/计价单位核验，不是实时市场报价。')
edit('src/ui/priceview.js','`市场参考价 · ${q.source} · ${q.updated} 更新`','`${q.source} · 表版本 ${q.updated}${q.complete ? "" : " · 有未计价项：" + q.unpriced.join("、")}`')
edit('src/ui/panel.js','参考价来自淘宝 / 1688 搜索价，仅供比价；承重与正式报价以工程图纸与报价单为准。','单价为未核验示例，搜索链接不代表卖家报价；未含运费、税费、加工费，禁止据此直接下单。')
edit('src/ui/rodpanel.js',"import { calcMarketPrice } from './marketPrice.js';","import { calcMarketPrice } from './marketPrice.js';\nimport { PRICE_MARKET_HTML, updatePriceBlock } from './priceview.js';")
edit('src/ui/rodpanel.js','<span class="price-note">示例报价</span></div>','<span class="price-note">示例材料估价</span></div>\n    ${PRICE_MARKET_HTML}')
edit('src/ui/rodpanel.js',"    priceBlock.querySelector('[data-price]').textContent = fmt(calcRodPrice(c));",'    // 报价由当前算料快照更新。')
edit('src/ui/rodpanel.js','    if (!stats) return;','    if (!stats) return;\n    updatePriceBlock(priceBlock, stats);')
edit('src/ui/main-placeholder' if False else 'src/main.js','calcPrice(cfg))','calcPrice(cfg, panel.lastStats))')
edit('src/main.js','calcRodPrice(cfg).toLocaleString','calcRodPrice(cfg, panel.lastStats).toLocaleString')
edit('src/main.js','if (rodHandles.group.parent)','if (rodHandles?.group.parent)')
edit('src/main.js','() => active?.bounds','() => active()?.bounds')
# Mixed deck: both must be mounted
edit('src/core/buildshelf.js','groups.deck = stripMesh || paneMesh;','groups.deck = stripMesh;\n  groups.pane = paneMesh;')
edit('src/core/buildshelf.js',"['deck', groups.deck],","['deck', groups.deck],\n    ['pane', groups.pane],")
edit('src/core/buildshelf.js',"addCut(series + ' 立柱'","addCut(postProf.label + ' 立柱'")
edit('src/core/buildshelf.js','w * (DEPTH - 0.06)','w * paneDepth')
# Test old cfg-only quote contract migrated to BOM-driven pricing
p=P/'test/calc.test.mjs';s=p.read_text(encoding='utf-8');start=s.index("test('calcPrice 随");end=s.index("test('算料单",start)
s=s[:start]+'''test('calcPrice 从BOM计价并随材料量增长', () => {
 const stats={cutList:[{spec:'梁',section:'20×40',len:1,qty:2}]};
 assert.equal(calcPrice({},stats),32);
 assert.equal(calcPrice({}, {cutList:[{...stats.cutList[0],qty:3}]}),48);
});

'''+s[end:];p.write_text(s,encoding='utf-8')
# Engineering assumption must not be presented as production correction
edit('src/ui/cutlist.js','净跨','名义尺寸（m）')
edit('src/ui/cutlist.js','下料长度已扣除节点占位（立柱占宽 + 两端角件间隙），下料前请以工程图复核。','长度为未验证装配假设的演示结果，非加工指令；需卖家确认节点与公差后重新出图。')
edit('test/calc.test.mjs','/净跨/','/名义尺寸/')
edit('src/config/product.js','// 每端角件装配间隙（米）','// 未验证假设：每端间隙（米），不能用于生产下料')
print('patched')
