// 精确型材截面：槽口模板必须能逐点重建 GLB 实测 2020（同源同精度），2040 由同一模板生成且可三角化
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeGlbStripShape } from '../src/core/profiles.js';
import { templateOutline2020, makeExact2040Shape, makeExact2020Shape } from '../src/core/profilesExact.js';

const area = (shape) => {
  const g = new THREE.ShapeGeometry(shape);
  const p = g.attributes.position, idx = g.index.array;
  let a = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const x1 = p.getX(idx[i]), y1 = p.getY(idx[i]), x2 = p.getX(idx[i + 1]), y2 = p.getY(idx[i + 1]), x3 = p.getX(idx[i + 2]), y3 = p.getY(idx[i + 2]);
    a += Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2;
  }
  g.dispose();
  return a;
};

test('槽口模板重建的 2020 外轮廓与 GLB 实测 44 点逐点一致（容差 10µm）', () => {
  const glb = makeGlbStripShape().extractPoints(1).shape.map((v) => [v.x, v.y]);
  const tpl = templateOutline2020();
  assert.equal(tpl.length, 44);
  // GLB 点序起点不同：逐点找最近点，且一一对应
  const used = new Set();
  for (const [x, y] of tpl) {
    let best = -1, bd = Infinity;
    glb.forEach(([gx, gy], i) => { const d = Math.hypot(gx - x, gy - y); if (d < bd && !used.has(i)) { bd = d; best = i; } });
    assert.ok(bd < 1e-5, `模板点 (${x.toFixed(6)}, ${y.toFixed(6)}) 偏离 GLB ${bd}`);
    used.add(best);
  }
  assert.equal(used.size, 44);
});

test('精确 2040：40.008×20mm（两个 20.004 单元）、6 个槽口、双方孔 + 中腔，可挤出且截面积约为两倍 2020', () => {
  const s = makeExact2040Shape();
  const pts = s.extractPoints(1).shape.slice(0, -1); // 去掉闭合重复点
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 0.040008) < 1e-6);
  assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 0.02) < 1e-6);
  assert.equal(pts.length, 4 + 6 * 10);
  assert.equal(s.holes.length, 3);
  const a40 = area(s), a20 = area(makeExact2020Shape());
  assert.ok(a40 > a20 * 1.7 && a40 < a20 * 2.3, `2040 面积 ${a40} vs 2020 ${a20}`);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  const p = g.attributes.position.array;
  assert.ok(p.length > 0 && p.every(Number.isFinite));
  g.dispose();
});
