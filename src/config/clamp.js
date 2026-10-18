// store.set 的共用边界防线：从 URL / localStorage / 配置清单恢复的值也必须校验。
// 可为产品声明枚举与整数字段，防止绕过 UI 直接输入非法产品选项。
export function makeClamp(limits, defaults = {}, { enums = {}, integerKeys = [] } = {}) {
  const numericKeys = Object.keys(limits || {}).filter(
    (k) => Array.isArray(limits[k]) && limits[k].length === 2 && typeof defaults[k] === 'number'
  );
  const integerSet = new Set(integerKeys);
  return (cfg) => {
    const out = { ...cfg };
    for (const [key, fallback] of Object.entries(defaults)) {
      if (typeof fallback === 'boolean' && typeof out[key] !== 'boolean') out[key] = fallback;
      if (typeof fallback === 'string' && typeof out[key] !== 'string') out[key] = fallback;
    }
    for (const k of numericKeys) {
      const [lo, hi] = limits[k];
      let v = out[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) v = defaults[k];
      if (integerSet.has(k)) v = Math.round(v);
      out[k] = Math.min(hi, Math.max(lo, v));
    }
    for (const [key, allowed] of Object.entries(enums)) {
      if (!Object.prototype.hasOwnProperty.call(allowed, out[key])) out[key] = defaults[key];
    }
    if (Object.prototype.hasOwnProperty.call(defaults, 'schemaVersion')) out.schemaVersion = defaults.schemaVersion;
    if (Object.prototype.hasOwnProperty.call(defaults, 'kind')) out.kind = defaults.kind;
    return out;
  };
}
