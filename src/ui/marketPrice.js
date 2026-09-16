// 比价引擎：从 stats（cutList / hardware / panes）逐项推导市场参考价
// 价格与算料同一份数据源 —— 改配置时报价随材料量实时联动，不存在两套公式。
// 价格表来源：KV 远端（/api/market）优先，回退内置基准；getMarket() 异步解析，
// 拿到远端表前先用内置表同步出首版报价，随后 KV 到达时由订阅方刷新。
import { MARKET } from '../config/market.js';
import { getMarket } from '../config/marketRemote.js';

let current = MARKET; // 同步初始值 = 内置基准；getMarket() 完成后更新
let ready = false;
const listeners = new Set();

getMarket().then((m) => {
  current = m;
  ready = true;
  for (const fn of listeners) fn(m);
}).catch(() => { ready = true; });

/** 订阅价格表刷新（KV 到达 / 失败回退后触发一次） */
export function onMarketRefresh(fn) {
  listeners.add(fn);
  if (ready) fn(current);
}

function matchCutRule(c) {
  return current.rules.find(r => r.match.test(c.section)) || null;
}
function matchHwRule(name) {
  return current.hardware.find(r => r.match.test(name)) || null;
}

/**
 * @param stats buildShelf / buildRodRack 返回的 stats
 * @returns {{ total:number, material:number, hardware:number, panes:number,
 *             lines:Array, updated:string, source:string }}
 */
export function calcMarketPrice(stats) {
  const lines = [];
  const unpriced = [];
  let material = 0, hardware = 0, panes = 0;

  for (const c of stats.cutList || []) {
    if (c.section === '板') continue; // 板件走 panes
    const rule = matchCutRule(c);
    if (!rule) { unpriced.push(c.spec); continue; }
    const qtyM = c.len * c.qty;
    const cost = qtyM * rule.price;
    material += cost;
    lines.push({ label: c.spec, detail: `${qtyM} m × ¥${rule.price}/m`, cost, query: rule.query, range: rule.range });
  }

  for (const h of stats.hardware || []) {
    const rule = matchHwRule(h.name);
    if (!rule) { unpriced.push(h.name); continue; }
    const cost = h.qty * rule.price;
    hardware += cost;
    lines.push({ label: h.name, detail: `${h.qty} 件 × ¥${rule.price}/件`, cost, query: rule.query });
  }

  for (const p of stats.panes || []) {
    if (p.kind === 'poster') {
      panes += current.posterFlat.price;
      lines.push({ label: p.label, detail: `1 张 × ¥${current.posterFlat.price}`, cost: current.posterFlat.price, query: current.posterFlat.query });
    } else {
      const per = p.kind === 'acrylic' ? current.acrylicPerM2 : current.zincPerM2;
      const cost = p.areaM2 * per.price;
      panes += cost;
      lines.push({ label: p.label, detail: `${p.areaM2.toFixed(2)} m² × ¥${per.price}/m²`, cost, query: per.query, range: per.range });
    }
  }

  return {
    complete: unpriced.length === 0, unpriced,
    total: Math.round(material + hardware + panes),
    material: Math.round(material),
    hardware: Math.round(hardware),
    panes: Math.round(panes),
    lines,
    updated: current.updated,
    source: current.source,
    remoteUpdated: current.remoteUpdated || null,
  };
}
