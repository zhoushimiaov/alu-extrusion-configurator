// 极简 pub/sub 状态 store
import { DEFAULT_CONFIG, LIMITS, normalizeConfig } from '../config/product.js';
import { calcMarketPrice } from './marketPrice.js';

let state = normalizeConfig({ ...DEFAULT_CONFIG });
const subs = new Set();

export const store = {
  limits: LIMITS,
  installSteps: [],
  get: () => state,
  set(patch) {
    const next = normalizeConfig({ ...state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    for (const fn of subs) fn(state);
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

export function setInstallSteps(steps) {
  store.installSteps = steps;
}

// 报价 = 算料数据 × 市场参考价（淘宝/1688），同一份数据源实时联动。
// stats 未就绪时（首帧前）返回 0，由面板 updateStats 立即回填。
export function calcPrice(cfg, stats) {
  if (stats && stats.cutList) return calcMarketPrice(stats).total;
  return 0;
}

export function fmtPrice(n) {
  return '¥ ' + n.toLocaleString('zh-CN');
}
