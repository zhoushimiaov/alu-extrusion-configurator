// 配置持久化：URL hash permalink（可分享）+ localStorage（刷新恢复）
// hash 格式：#rod?c=<b64> / #rod/side?c=<b64> / #?c=<b64>，与既有 #rod 直达、
// #rod/side QA 视角 hash 完全兼容（视图段原样保留）。

const LS_KEY = {
  profile: 'alu.cfg.profile',
  rod: 'alu.cfg.rod',
  cart: 'alu.cfg.cart',
  crates: 'alu.cfg.crates',
  woodcart: 'alu.cfg.woodcart',
  hanger: 'alu.cfg.hanger',
};

// 持久化字段白名单：与各产品 DEFAULT_CONFIG 保持同步（test/persist-schema.test.mjs
// 断言两者一致，新增配置字段漏登记时测试直接失败，避免「配置写入后被静默丢弃」）。
const SCHEMA = {
  profile: ['schemaVersion', 'bays', 'levels', 'series', 'frameMode', 'decks', 'backs', 'bayWidths', 'sidePanels', 'panelColor', 'props', 'color'],
  rod: ['schemaVersion', 'width', 'height', 'style', 'backPanel', 'shelf', 'casters', 'color'],
  cart: ['schemaVersion', 'width', 'depth', 'height', 'glassTop', 'midAcrylic', 'rodRails', 'casters', 'woodFinish'],
  crates: ['schemaVersion', 'width', 'depth', 'height', 'tiers', 'scheme', 'pullOut', 'casters'],
  woodcart: ['schemaVersion', 'width', 'depth', 'height', 'shelves', 'cabinetH', 'pegboard', 'topRail', 'sideRail', 'casters', 'woodTone'],
  hanger: ['schemaVersion', 'width', 'depth', 'height', 'drawers', 'wheels', 'color'],
};

const KINDS = ['rod', 'cart', 'crates', 'woodcart', 'hanger'];

/** 从 hash 解析当前产品 kind（profile 无独立 hash 段，作为兜底）。
 *  匹配需带边界（`#rod` 命中但 `#rods` / `#rodX` 不命中），防止未来新增前缀冲突。 */
function kindFromHash(hash) {
  for (const k of KINDS) if (new RegExp('^#' + k + '(?:[/?#]|$)').test(hash)) return k;
  return 'profile';
}

export function pickPersisted(kind, cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  const out = {};
  for (const key of SCHEMA[kind] || []) {
    if (key in cfg) out[key] = cfg[key];
  }
  return out;
}

export function encodeCfg(obj) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch { return ''; }
}

export function decodeCfg(str) {
  try {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(s))));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  } catch { return null; }
}

function cfgFromHash() {
  const m = location.hash.match(/[?&]c=([A-Za-z0-9_-]+)/);
  return m ? decodeCfg(m[1]) : null;
}

export function migrateProfileConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  if ((cfg.schemaVersion || 0) < 2) return { ...cfg, frameMode: 'glb', schemaVersion: 2 };
  return cfg;
}

function cfgFromStorage(kind) {
  try { return decodeCfg(localStorage.getItem(LS_KEY[kind]) || ''); } catch { return null; }
}

/** 启动时恢复：hash 中的配置优先（分享链接），否则回退 localStorage。未知字段按白名单过滤 + 迁移 */
export function loadSaved(kind) {
  const activeKind = kindFromHash(location.hash);
  let saved = (kind === activeKind ? cfgFromHash() : null) || cfgFromStorage(kind);
  if (kind === 'profile') saved = migrateProfileConfig(saved);
  return pickPersisted(kind, saved);
}

/** 配置变化时调用：写 localStorage 并把配置同步进 hash（保留视图段）。只序列化白名单字段 */
export function persist(kind, cfg) {
  const b64 = encodeCfg(pickPersisted(kind, cfg));
  if (!b64) return;
  if (LS_KEY[kind]) {
    try { localStorage.setItem(LS_KEY[kind], b64); } catch { /* 隐私模式等场景静默 */ }
  }
  const hashKind = kindFromHash(location.hash);
  if (kind !== hashKind) return;
  const base = location.hash.replace(/[?&]c=[A-Za-z0-9_-]+/, '') || (hashKind === 'profile' ? '#' : '#' + hashKind);
  const sep = base.includes('?') ? '&' : '?';
  history.replaceState(null, '', `${base}${sep}c=${b64}`);
}
