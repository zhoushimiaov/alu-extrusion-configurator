// 数值框水平拖拽滑动（3ds Max 风格）：在 .stepper .num 上按住左右拖动改值
// 约定：data-drag="key" data-step="步长" data-min="key|min" data-max="key|max"
// get/set 通过回调注入，避免面板与 store 耦合
export function attachDragSlider(rootEl, { get, set, limits }) {
  let drag = null; // { key, startX, startVal, step }

  function onDown(e) {
    const num = e.target.closest('.stepper .num');
    if (!num || !num.dataset.drag) return;
    e.preventDefault();
    drag = {
      key: num.dataset.drag,
      startX: e.clientX,
      startVal: get()[num.dataset.drag],
      step: parseFloat(num.dataset.step || '0.05'),
      numEl: num,
      moved: false,
    };
    num.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }

  function onMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) < 2 && !drag.moved) return;
    drag.moved = true;
    const lim = limits[drag.key] || [0, 100];
    const v = Math.min(lim[1], Math.max(lim[0], +(drag.startVal + dx * drag.step).toFixed(2)));
    set({ [drag.key]: v });
  }

  function onUp() {
    if (!drag) return;
    drag.numEl.style.cursor = '';
    document.body.style.userSelect = '';
    drag = null;
  }

  rootEl.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  return () => {
    rootEl.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
}
