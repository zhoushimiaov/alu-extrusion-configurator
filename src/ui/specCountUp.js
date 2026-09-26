// 规格数字 count-up：显示层效果。MutationObserver 拦截 .spec-cell .v 的数值变化，
// rAF 插值滚动——不触碰原封 panel.js 的 updateStats 写入路径。
// 纪律：仅在数值变化时占用 rAF（尊重按需渲染）；prefers-reduced-motion 不启用。
export function installSpecCountUp(panelRoot) {
  if (!panelRoot || typeof MutationObserver === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const animating = new Map(); // .v 元素 -> { from, to, t0, dec, comma, node }
  let rafId = 0;

  // .v 内部结构：数字文本节点 + <small>单位</small>。只动画首个文本节点。
  function numberNode(v) {
    const first = v.firstChild;
    return first && first.nodeType === Node.TEXT_NODE ? first : null;
  }
  function parseNum(text) {
    const m = String(text).match(/-?[\d,]+\.?\d*/);
    if (!m) return null;
    const raw = m[0];
    const dec = (raw.split('.')[1] || '').length;
    return { value: parseFloat(raw.replace(/,/g, '')), dec, comma: raw.includes(','), raw };
  }
  function fmt(n, st) {
    return st.comma
      ? n.toLocaleString('zh-CN', { minimumFractionDigits: st.dec, maximumFractionDigits: st.dec })
      : n.toFixed(st.dec);
  }

  function schedule(v) {
    const node = numberNode(v);
    if (!node) return;
    const parsed = parseNum(node.textContent);
    if (!parsed) return;
    const prevRaw = v.dataset.prevNum;
    v.dataset.prevNum = parsed.raw;
    if (prevRaw === undefined) return; // 首次挂载：记录基线，不动画
    const from = parseFloat(prevRaw);
    if (!Number.isFinite(from) || from === parsed.value) return;
    if (animating.has(v)) { animating.get(v).to = parsed.value; return; }
    animating.set(v, { from, to: parsed.value, t0: performance.now(), dec: parsed.dec, comma: parsed.comma, node });
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    for (const [v, st] of [...animating]) {
      if (!v.isConnected) { animating.delete(v); continue; }
      const p = Math.min(1, (now - st.t0) / 380);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      st.node.textContent = fmt(st.from + (st.to - st.from) * e, st);
      if (p >= 1) animating.delete(v);
    }
    rafId = animating.size ? requestAnimationFrame(tick) : 0;
  }

  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      const el = m.target.nodeType === Node.ELEMENT_NODE ? m.target : m.target.parentElement;
      if (!el || !el.isConnected) continue;
      const v = el.closest('.spec-cell') ? el.closest('.spec-cell').querySelector('.v') : null;
      if (!v) continue;
      if (m.type === 'childList' && m.target === v) {
        // .v 子树被整体重写（updateStats 权威写入）：取消进行中的动画、直接采用新值。
        // 否则动画继续写在已被替换的旧文本节点上，可见值会永久停在中间值（如 1,109）。
        animating.delete(v);
        const node = numberNode(v);
        const parsed = node ? parseNum(node.textContent) : null;
        if (parsed) v.dataset.prevNum = parsed.raw;
        continue;
      }
      if (animating.has(v)) continue; // 自写触发，跳过
      schedule(v);
    }
  });
  observer.observe(panelRoot, { subtree: true, childList: true, characterData: true });
}
