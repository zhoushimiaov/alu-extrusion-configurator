// 边几几何冒烟：四配置统计输出（无 DOM 依赖，node 直接跑）
import { buildCartTable } from '../src/core/buildCartTable.js';
// mock DOM：cartMaterials 的木纹 CanvasTexture 需要 document.createElement('canvas')
globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, ellipse(){}, fill(){} }), width: 0, height: 0 }) };
const cases = [
  { name: 'default', cfg: {} },
  { name: 'wide-0.8', cfg: { width: 0.8, depth: 0.6, height: 0.9 } },
  { name: 'no-casters', cfg: { casters: false, rodRails: false, midAcrylic: 'none' } },
  { name: 'minimal', cfg: { glassTop: false, midAcrylic: 'none', rodRails: false, casters: false } },
];
for (const c of cases) {
  const b = buildCartTable(c.cfg);
  console.log(`[${c.name}] parts=${b.stats.partCount} weight=${b.stats.weightKg.toFixed(1)}kg alu=${b.stats.profileLengthM.toFixed(2)}m bounds=${JSON.stringify(b.bounds)}`);
  b.dispose();
}