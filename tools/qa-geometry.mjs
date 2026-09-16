// 本轮修复的几何/联动验证脚本（node verify-r2.mjs）
// 1) 周转箱：箱体不得越出立柱内表面（用户报的穿模）
// 2) 光轴展架 panel / acrylic：板顶不得高于顶档横杆
// 3) 木展车四个开关：partCount 应随开关变化（证明面板 -> store -> 重建链路存在）
import * as THREE from 'three';
globalThis.document = { createElement: (t) => t === 'canvas' ? { width: 0, height: 0, getContext: () => ({ fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){}, ellipse(){}, arc(){}, drawImage(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }) } : {} };

import { buildCratesRack } from '../src/core/buildCratesRack.js';
import { buildRodRack } from '../src/core/buildRodRack.js';
import { buildWoodCart } from '../src/core/buildWoodCart.js';
import { DEFAULT_CRATES_CONFIG } from '../src/config/crates.js';

const POST_W = 0.04;
const RIM_OUT = 0.013;   // 口沿外扩 + 装配间隙（与 buildCratesRack 保持一致）

console.log('=== 1. 周转箱收纳架：箱体 vs 框架内表面 ===');
for (const cfg of [
  { name: 'default-4t', c: {} },
  { name: '2t-white', c: { tiers: 2, scheme: 'white' } },
  { name: '6t-olive-nopull', c: { tiers: 6, scheme: 'olive', pullOut: false } },
  { name: 'wide-0.9', c: { width: 0.9, depth: 0.62, height: 1.2 } },
]) {
  const { group, stats, config } = buildCratesRack(cfg.c);
  const px = config.width / 2, pz = config.depth / 2;
  const innerX = px - POST_W / 2, innerZ = pz - POST_W / 2;
  const crateBox = new THREE.Box3();
  let crateCount = 0;
  group.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) { crateBox.expandByObject(o); crateCount++; }
  });
  const overX = crateBox.max.x - (innerX - 0.001);
  const overZ = crateBox.max.z - (innerZ - 0.001);
  const underZ = -crateBox.min.z - (innerZ - 0.001);
  const ok = overX <= 0 && overZ <= 0 && underZ <= 0;
  console.log(`[${cfg.name}] 箱体网格=${crateCount} 件=${stats.partCount} 重=${stats.weightKg.toFixed(1)}kg`);
  console.log(`  立柱内表面 X=±${innerX.toFixed(3)} Z=±${innerZ.toFixed(3)}；箱体 X+${crateBox.max.x.toFixed(3)} / Z±${Math.max(crateBox.max.z, -crateBox.min.z).toFixed(3)}`);
  console.log(`  越界量：X ${overX.toFixed(4)} m，Z+ ${overZ.toFixed(4)} m，Z- ${underZ.toFixed(4)} m  → ${ok ? 'PASS 未穿模' : 'FAIL 仍穿模'}`);
}

console.log('\n=== 2. 光轴展架：展板顶边 vs 顶档横杆 ===');
for (const style of ['panel', 'acrylic']) {
  const { group, stats, bounds } = buildRodRack({ style, width: 0.8, height: 1.2 });
  const k = 1.2 / 1.2;
  const yTop = 1.282 * k;          // 顶档横杆（buildRodRack 中的 yTop 公式）
  const boardBox = new THREE.Box3();
  group.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    const m = o.material;
    if (!m) return;
    const isBoard = (m.transmission ?? 0) > 0 || (m.color && Math.abs(m.color.getHex() - 0xf0f1ee) < 0x080808);
    if (isBoard) boardBox.expandByObject(o);
  });
  const top = boardBox.max.y;
  const over = top - (yTop - 0.05);
  console.log(`[${style}] 板顶=${top.toFixed(3)} m，顶档横杆=${yTop.toFixed(3)} m，余量=${(yTop - top).toFixed(3)} m → ${over <= 0.0001 ? 'PASS 未超高' : 'FAIL 超顶杆'}`);
  console.log(`  板件面积=${(stats.panes[0] && stats.panes[0].areaM2)} m²`);
}

console.log('\n=== 3. 光轴木展车：四个开关对零件数的影响 ===');
const base = buildWoodCart({});
console.log(`[全开] 件=${base.stats.partCount} 重=${base.stats.weightKg.toFixed(1)}kg`);
for (const key of ['pegboard', 'topRail', 'sideRail', 'casters']) {
  const off = buildWoodCart({ [key]: false });
  const delta = off.stats.partCount - base.stats.partCount;
  console.log(`[关闭 ${key}] 件=${off.stats.partCount}（Δ${delta}）→ ${delta !== 0 ? 'PASS 开关影响模型' : 'FAIL 开关无影响'}`);
}
