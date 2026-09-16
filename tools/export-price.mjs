// 从内置 MARKET 导出 KV 用的 price_table.json。
// 关键：JSON 无法承载 RegExp —— match 字段必须序列化为「正则源码字符串」，
//       前端 marketRemote.js 会用 new RegExp(source) 还原。历史版本直接
//       JSON.stringify(MARKET) 会把所有 match 变成 {}，导致线上报价引擎
//       调 .test() 时 TypeError（file:// 下走内置表所以本地测试抓不到）。
import { MARKET } from '../src/config/market.js';
import { writeFileSync } from 'fs';

/** 把 match（RegExp）转成可 JSON 化的源码字符串；其余字段原样保留 */
function serializeRule(r) {
  const out = { ...r };
  if (out.match instanceof RegExp) out.match = out.match.source;
  return out;
}

const table = {
  updated: MARKET.updated,
  source: MARKET.source,
  rules: MARKET.rules.map(serializeRule),
  hardware: MARKET.hardware.map(serializeRule),
  acrylicPerM2: MARKET.acrylicPerM2,
  zincPerM2: MARKET.zincPerM2,
  posterFlat: MARKET.posterFlat,
};

const json = JSON.stringify(table, null, 2);
writeFileSync('tools/price_table.json', json, 'utf8');

// 自检：导出物必须能被 JSON.parse 且 match 是可编译的非空字符串
const re = JSON.parse(json);
for (const list of [re.rules, re.hardware]) {
  for (const r of list) {
    if (typeof r.match !== 'string' || !r.match) {
      console.error('导出自检失败：match 不是非空字符串', r.id || r);
      process.exit(1);
    }
    try { new RegExp(r.match); } catch (e) {
      console.error('导出自检失败：match 源码无法编译', r.match, e.message);
      process.exit(1);
    }
  }
}
console.log('price_table.json written:', json.length, 'bytes；match 全部为可编译源码字符串 ✓');
