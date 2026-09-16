// 配置数值钳制：store.set 的统一防线。
// 面板 stepper / 拖拽滑块各自有钳制，但 hash permalink 与 localStorage 恢复
// 绕开面板直达 store —— 因此在 store 层再做一次，封住注入与脏数据。

/** 生成钳制函数：limits 中声明的数值键全部收敛到 [min, max]，非有限值回退 defaults */
export function makeClamp(limits, defaults = {}) {
  const numericKeys = Object.keys(limits || {}).filter(
    (k) => Array.isArray(limits[k]) && limits[k].length === 2 && typeof (defaults[k]) === 'number'
  );
  return (cfg) => {
    const out = { ...cfg };
    for (const k of numericKeys) {
      const [lo, hi] = limits[k];
      let v = out[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) v = defaults[k];
      out[k] = Math.min(hi, Math.max(lo, v));
    }
    return out;
  };
}
