import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHotspots } from '../src/core/hotspots.js';

function fixture() {
  const old = globalThis.document;
  const elements = [];
  globalThis.document = {
    createElement(tag) {
      const listeners = {};
      const attrs = {};
      const button = {
        tagName: tag.toUpperCase(), className: '', dataset: {}, style: {}, tabIndex: 0,
        setAttribute(key, value) { attrs[key] = String(value); },
        getAttribute(key) { return attrs[key]; },
        removeAttribute(key) { delete attrs[key]; },
        addEventListener(name, fn) { listeners[name] = fn; },
        click() { listeners.click?.({ stopPropagation() {} }); },
      };
      elements.push(button);
      return button;
    },
  };
  const layer = { appendChild() {} };
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 20);
  camera.position.set(0, 1.3, 6);
  camera.lookAt(0, 1.3, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  let width = 1000;
  const renderer = { domElement: { getBoundingClientRect: () => ({ width, height: 800 }) } };
  let cfg = { bays: 2, levels: 4 };
  const store = {
    get: () => cfg,
    set: patch => { cfg = { ...cfg, ...patch }; },
    limits: { bays: [2, 8], levels: [2, 8] },
  };
  const controls = createHotspots(layer, camera, renderer, store, () => ({ W: 1.4, H: 2.6, D: 0.4 }));
  return { elements, controls, store, get cfg() { return cfg; }, setWidth: v => { width = v; }, restore: () => { globalThis.document = old; } };
}

test('铝型材架高度控件是带层标签的点击步进按钮，不是圆形拖动手柄', () => {
  const f = fixture();
  try {
    const plus = f.elements.find(b => b.dataset.id === 'level+');
    const minus = f.elements.find(b => b.dataset.id === 'level-');
    assert.equal(f.elements.length, 4);
    assert.ok(plus.className.includes('hotspot-level'));
    assert.ok(plus.innerHTML.includes('hotspot-unit'));
    assert.ok(plus.title.includes('点击，不需拖动'));
    f.controls.sync();
    assert.equal(plus.getAttribute('aria-hidden'), 'false');
    assert.equal(plus.tabIndex, 0);
    assert.ok(parseFloat(plus.style.top) < parseFloat(minus.style.top), 'higher stepper placed above lower stepper');
    assert.ok(Math.abs(parseFloat(plus.style.top) - parseFloat(minus.style.top)) > 120,
      'height steppers leave room for the central dimension number');
    plus.click();
    assert.equal(f.cfg.levels, 5);
    minus.click();
    assert.equal(f.cfg.levels, 4);
  } finally { f.restore(); }
});

test('移动端与隐藏的热点不会继续接受触摸或键盘焦点', () => {
  const f = fixture();
  try {
    f.controls.sync();
    f.setWidth(500);
    f.controls.sync();
    for (const b of f.elements) {
      assert.equal(b.getAttribute('aria-hidden'), 'true');
      assert.equal(b.tabIndex, -1);
      assert.equal(b.style.pointerEvents, 'none');
    }
    f.setWidth(1000);
    f.controls.sync();
    f.controls.setHidden(true);
    for (const b of f.elements) {
      assert.equal(b.style.display, 'none');
      assert.equal(b.getAttribute('aria-hidden'), 'true');
      assert.equal(b.tabIndex, -1);
    }
  } finally { f.restore(); }
});
